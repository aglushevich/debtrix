import { useEffect, useMemo, useState } from "react";
import { getControlRoomDashboard } from "./api";
import { formatDebtorType } from "./legalLabels";

type Props = {
  cases: any[];
  selectedCaseIds: number[];
  selectedCase: number | null;
  onOpenCase: (caseId: number) => void;
};

type IntelligenceRow = {
  case_id: number;
  debtor_name: string;
  status: string;
  contract_type: string;
  debtor_type: string;
  principal_amount: string;
  due_date: string | null;
  risk_score: number;
  risk_level: string;
  signals: string[];
  routing_bucket: string;
  routing_status: string;
  recommended_action: string | null;
  is_blocked: boolean;
  is_waiting: boolean;
  is_ready_now: boolean;
  is_court_lane: boolean;
  is_enforcement_lane: boolean;
  blocked_reasons: string[];
  is_archived: boolean;
  inn?: string | null;
  ogrn?: string | null;
};

function parseAmount(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function riskLabel(level?: string): string {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return map[level || ""] || level || "—";
}

function routingLabel(code?: string): string {
  const map: Record<string, string> = {
    active_collection: "Активное взыскание",
    waiting: "Ожидание",
    blocked: "Заблокировано",
    court_lane: "Судебный трек",
    enforcement_lane: "Исполнительный трек",
    general: "Общий поток",
    ready: "Готово",
    idle: "Вне активного маршрута",
  };
  return map[code || ""] || code || "—";
}

function buildFallbackRow(item: any): IntelligenceRow {
  const status = String(item?.status || "draft");
  const amount = String(item?.principal_amount || "0.00");
  const isArchived = Boolean(item?.is_archived);

  const waiting = status === "draft";
  const courtLane = status === "court";
  const enforcementLane = ["fssp", "enforcement"].includes(status);
  const readyNow = ["overdue", "pretrial"].includes(status);

  return {
    case_id: item.id,
    debtor_name: item?.debtor_name || "—",
    status,
    contract_type: String(item?.contract_type || "—"),
    debtor_type: String(item?.debtor_type || "—"),
    principal_amount: amount,
    due_date: item?.due_date || null,
    risk_score: readyNow ? 48 : waiting ? 22 : 18,
    risk_level: readyNow ? "medium" : "low",
    signals: [],
    routing_bucket: waiting
      ? "waiting"
      : courtLane
        ? "court_lane"
        : enforcementLane
          ? "enforcement_lane"
          : readyNow
            ? "active_collection"
            : "general",
    routing_status: waiting ? "waiting" : readyNow ? "eligible" : "in_progress",
    recommended_action: readyNow
      ? "Открыть карточку и выполнить следующее действие"
      : waiting
        ? "Контролировать срок перехода"
        : null,
    is_blocked: false,
    is_waiting: waiting,
    is_ready_now: readyNow,
    is_court_lane: courtLane,
    is_enforcement_lane: enforcementLane,
    blocked_reasons: [],
    is_archived: isArchived,
    inn: null,
    ogrn: null,
  };
}

function sortByPriority(a: IntelligenceRow, b: IntelligenceRow): number {
  if (b.risk_score !== a.risk_score) {
    return b.risk_score - a.risk_score;
  }

  const amountDiff = parseAmount(b.principal_amount) - parseAmount(a.principal_amount);
  if (amountDiff !== 0) return amountDiff;

  return b.case_id - a.case_id;
}

function buildRowsFromDashboard(cases: any[], dashboard: any): IntelligenceRow[] {
  const priorityItems = dashboard?.priority_cases?.items || [];
  const priorityMap = new Map<number, any>();

  for (const item of priorityItems) {
    if (typeof item?.case_id === "number") {
      priorityMap.set(item.case_id, item);
    }
  }

  const routingBuckets = dashboard?.routing?.buckets || {};
  const routingMap = new Map<number, { bucket: string; row: any }>();

  for (const bucketKey of ["ready", "waiting", "blocked", "idle"]) {
    const bucketItems = Array.isArray(routingBuckets?.[bucketKey])
      ? routingBuckets[bucketKey]
      : [];

    for (const item of bucketItems) {
      const caseId = Number(item?.case_id);
      if (!Number.isFinite(caseId)) continue;
      routingMap.set(caseId, { bucket: bucketKey, row: item });
    }
  }

  const waitingItems = dashboard?.waiting_preview?.items || [];
  const waitingMap = new Map<number, any[]>();

  for (const item of waitingItems) {
    const caseId = Number(item?.case_id);
    if (!Number.isFinite(caseId)) continue;
    if (!waitingMap.has(caseId)) waitingMap.set(caseId, []);
    waitingMap.get(caseId)!.push(item);
  }

  return (cases || [])
    .map((item: any) => {
      const priority = priorityMap.get(item.id);
      const routing = routingMap.get(item.id);
      const waitingRows = waitingMap.get(item.id) || [];

      if (!priority && !routing) {
        return buildFallbackRow(item);
      }

      const status = String(priority?.status || item?.status || "draft");
      const routingBucket = String(
        routing?.bucket ||
          (priority?.blocked ? "blocked" : waitingRows.length ? "waiting" : "general")
      );

      const blocked = routingBucket === "blocked" || Boolean(priority?.blocked);
      const waiting = routingBucket === "waiting" || waitingRows.length > 0;
      const courtLane = routingBucket === "court_lane" || status === "court";
      const enforcementLane =
        routingBucket === "enforcement_lane" || ["fssp", "enforcement"].includes(status);
      const readyNow =
        (routingBucket === "ready" ||
          routingBucket === "active_collection" ||
          ["overdue", "pretrial"].includes(status)) &&
        !blocked &&
        !waiting;

      const signals: string[] = [];

      if (Array.isArray(priority?.blocked_reasons)) {
        signals.push(...priority.blocked_reasons.map((x: any) => String(x)));
      }

      for (const row of waitingRows) {
        if (row?.reason) signals.push(String(row.reason));
      }

      const dedupSignals = Array.from(new Set(signals.filter(Boolean)));

      return {
        case_id: item.id,
        debtor_name: String(priority?.debtor_name || item?.debtor_name || "—"),
        status,
        contract_type: String(priority?.contract_type || item?.contract_type || "—"),
        debtor_type: String(priority?.debtor_type || item?.debtor_type || "—"),
        principal_amount: String(priority?.principal_amount || item?.principal_amount || "0.00"),
        due_date: priority?.due_date || item?.due_date || null,
        risk_score: Number(priority?.risk_score || 0),
        risk_level: String(priority?.risk_level || "low"),
        signals: dedupSignals,
        routing_bucket: routingBucket,
        routing_status: blocked
          ? "blocked"
          : waiting
            ? "waiting"
            : readyNow
              ? "eligible"
              : "in_progress",
        recommended_action: readyNow
          ? "Открыть карточку и выполнить следующее действие"
          : blocked
            ? "Снять blocker’ы"
            : waiting
              ? "Контролировать eligible_at"
              : courtLane
                ? "Проверить судебный трек"
                : enforcementLane
                  ? "Проверить исполнительный трек"
                  : "Проверить маршрут взыскания",
        is_blocked: blocked,
        is_waiting: waiting,
        is_ready_now: readyNow,
        is_court_lane: courtLane,
        is_enforcement_lane: enforcementLane,
        blocked_reasons: Array.isArray(priority?.blocked_reasons)
          ? priority.blocked_reasons.map((x: any) => String(x))
          : [],
        is_archived: Boolean(priority?.is_archived || item?.is_archived),
        inn: priority?.inn || null,
        ogrn: priority?.ogrn || null,
      };
    })
    .sort(sortByPriority);
}

export default function PortfolioOperationsPanel({
  cases,
  selectedCaseIds,
  selectedCase,
  onOpenCase,
}: Props) {
  const [rows, setRows] = useState<IntelligenceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const result = await getControlRoomDashboard();
        if (cancelled) return;
        setRows(buildRowsFromDashboard(cases || [], result || {}));
      } catch {
        if (cancelled) return;
        setRows((cases || []).map(buildFallbackRow).sort(sortByPriority));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [cases]);

  const selectedRows = useMemo(
    () => rows.filter((item) => selectedCaseIds.includes(item.case_id)),
    [rows, selectedCaseIds]
  );

  const selectedAmount = useMemo(
    () => selectedRows.reduce((acc, item) => acc + parseAmount(item.principal_amount), 0),
    [selectedRows]
  );

  const urgentCases = useMemo(
    () =>
      [...rows]
        .filter(
          (item) =>
            item.is_ready_now || item.is_court_lane || item.risk_level === "critical"
        )
        .sort(sortByPriority)
        .slice(0, 5),
    [rows]
  );

  const blockedCases = useMemo(
    () => [...rows].filter((item) => item.is_blocked).sort(sortByPriority).slice(0, 5),
    [rows]
  );

  const waitingCases = useMemo(
    () => [...rows].filter((item) => item.is_waiting).sort(sortByPriority).slice(0, 5),
    [rows]
  );

  return (
    <section className="panel control-room-ops-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Operational triage</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Операционный triage
          </div>
          <div className="muted">
            Пакетный фокус, срочные кейсы, blocked cleanup и waiting bucket.
          </div>
        </div>
      </div>

      {loading && (
        <div className="empty-box" style={{ marginTop: 16 }}>
          Загружаем операционный срез портфеля…
        </div>
      )}

      <div className="portfolio-mini-stats control-room-ops-stats" style={{ marginTop: 16, marginBottom: 18 }}>
        <div className="portfolio-mini-stat">
          <span>Выбрано в пакет</span>
          <strong>{selectedCaseIds.length}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Сумма пакета</span>
          <strong style={{ fontSize: 16 }}>{formatMoney(selectedAmount)} ₽</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Текущая карточка</span>
          <strong>{selectedCase ? `#${selectedCase}` : "—"}</strong>
        </div>
      </div>

      <div className="portfolio-triage-grid">
        <div className="triage-column">
          <div className="triage-column-head">
            <div className="triage-column-title">Срочно брать в работу</div>
            <div className="triage-column-count">{urgentCases.length}</div>
          </div>

          {urgentCases.length ? (
            <div className="triage-list">
              {urgentCases.map((item) => (
                <button
                  key={item.case_id}
                  className="triage-card"
                  onClick={() => onOpenCase(item.case_id)}
                >
                  <div className="triage-card-top">
                    <strong>Дело #{item.case_id}</strong>
                    <span className={`risk-pill risk-${item.risk_level || "low"}`}>
                      {riskLabel(item.risk_level)} · {item.risk_score}
                    </span>
                  </div>

                  <div className="triage-card-name">{item.debtor_name || "—"}</div>

                  <div className="triage-card-meta">
                    {item.contract_type || "—"} · {formatDebtorType(item.debtor_type)} ·{" "}
                    {item.principal_amount || "—"} ₽
                  </div>

                  <div className="triage-card-hint">
                    {item.recommended_action || "Открыть карточку"}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-box">Срочных дел пока нет.</div>
          )}
        </div>

        <div className="triage-column">
          <div className="triage-column-head">
            <div className="triage-column-title">Blocked cleanup</div>
            <div className="triage-column-count">{blockedCases.length}</div>
          </div>

          {blockedCases.length ? (
            <div className="triage-list">
              {blockedCases.map((item) => (
                <button
                  key={item.case_id}
                  className="triage-card"
                  onClick={() => onOpenCase(item.case_id)}
                >
                  <div className="triage-card-top">
                    <strong>Дело #{item.case_id}</strong>
                    <span className="status-badge status-not-ready">Blocked</span>
                  </div>

                  <div className="triage-card-name">{item.debtor_name || "—"}</div>

                  <div className="triage-card-meta">
                    {item.contract_type || "—"} · {item.principal_amount || "—"} ₽
                  </div>

                  <div className="triage-card-hint">
                    {item.blocked_reasons?.[0] || item.signals?.[0] || "Требуется проверка"}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-box">Явно заблокированных дел нет.</div>
          )}
        </div>

        <div className="triage-column">
          <div className="triage-column-head">
            <div className="triage-column-title">Waiting bucket</div>
            <div className="triage-column-count">{waitingCases.length}</div>
          </div>

          {waitingCases.length ? (
            <div className="triage-list">
              {waitingCases.map((item) => (
                <button
                  key={item.case_id}
                  className="triage-card"
                  onClick={() => onOpenCase(item.case_id)}
                >
                  <div className="triage-card-top">
                    <strong>Дело #{item.case_id}</strong>
                    <span className="status-badge status-draft">Waiting</span>
                  </div>

                  <div className="triage-card-name">{item.debtor_name || "—"}</div>

                  <div className="triage-card-meta">
                    {item.contract_type || "—"} · {item.principal_amount || "—"} ₽
                  </div>

                  <div className="triage-card-hint">{routingLabel(item.routing_bucket)}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-box">Waiting bucket пуст.</div>
          )}
        </div>
      </div>
    </section>
  );
}
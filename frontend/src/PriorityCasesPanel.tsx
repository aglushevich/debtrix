import { formatCaseStatus, formatDebtorType } from "./legalLabels";

type PriorityCaseItem = {
  case_id: number;
  debtor_name?: string;
  status?: string;
  contract_type?: string;
  debtor_type?: string;
  principal_amount?: string;
  due_date?: string | null;
  risk_score?: number;
  risk_level?: string;
  priority_score?: number;
  priority_band?: string;
  priority_band_label?: string;
  priority_reasons?: string[];
  operator_focus?: string;
  blocked?: boolean;
  blocked_reasons?: string[];
  inn?: string | null;
  ogrn?: string | null;
  is_archived?: boolean;
};

export type PriorityPreset = "critical" | "high" | "blocked_cleanup" | "urgent_ready";

type Props = {
  dashboard?: any;
  selectedCase?: number | null;
  onOpenCase: (caseId: number) => void;
  onOpenPreset?: (preset: PriorityPreset) => void;
};

function bandLabel(level?: string, fallback?: string): string {
  if (fallback) return fallback;

  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };

  return map[level || ""] || level || "—";
}

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sortPriorityCases(items: PriorityCaseItem[]): PriorityCaseItem[] {
  return [...items].sort((a, b) => {
    const scoreDiff =
      Number(b?.priority_score || b?.risk_score || 0) -
      Number(a?.priority_score || a?.risk_score || 0);
    if (scoreDiff !== 0) return scoreDiff;

    const amountA = Number(String(a?.principal_amount ?? 0).replace(",", "."));
    const amountB = Number(String(b?.principal_amount ?? 0).replace(",", "."));
    if (amountB !== amountA) return amountB - amountA;

    return Number(b?.case_id || 0) - Number(a?.case_id || 0);
  });
}

export default function PriorityCasesPanel({
  dashboard,
  selectedCase,
  onOpenCase,
  onOpenPreset,
}: Props) {
  const allItems = sortPriorityCases(dashboard?.priority_cases?.items || []);
  const items = allItems.slice(0, 8);

  const criticalCount = allItems.filter((item) => item.priority_band === "critical").length;
  const highCount = allItems.filter((item) => item.priority_band === "high").length;
  const blockedCount = allItems.filter((item) => Boolean(item.blocked)).length;
  const urgentReadyCount = allItems.filter(
    (item) =>
      !item.blocked && ["critical", "high"].includes(String(item.priority_band || ""))
  ).length;

  return (
    <section className="panel control-room-priority-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Top priority cases</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Приоритетные дела
          </div>
          <div className="muted">
            Shortlist из explainable priority engine: не просто крупные суммы, а
            кейсы с самым сильным операционным смыслом.
          </div>
        </div>
      </div>

      {!!onOpenPreset && (
        <div className="action-list" style={{ marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" className="secondary-btn" onClick={() => onOpenPreset("critical")}>
            🔥 Critical ({criticalCount})
          </button>

          <button type="button" className="secondary-btn" onClick={() => onOpenPreset("high")}>
            ⚡ High ({highCount})
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => onOpenPreset("urgent_ready")}
          >
            ✅ Urgent ready ({urgentReadyCount})
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => onOpenPreset("blocked_cleanup")}
          >
            🚧 Blocked ({blockedCount})
          </button>
        </div>
      )}

      {!items.length ? (
        <div className="empty-box" style={{ marginTop: 14 }}>
          Приоритетные дела пока не сформированы.
        </div>
      ) : (
        <div className="priority-case-list" style={{ marginTop: 14 }}>
          {items.map((item, index) => (
            <button
              key={item.case_id}
              className={`priority-case-row ${
                selectedCase === item.case_id ? "is-current" : ""
              }`}
              onClick={() => onOpenCase(item.case_id)}
            >
              <div className="priority-case-rank">{index + 1}</div>

              <div className="priority-case-main">
                <div className="priority-case-topline">
                  <strong>Дело #{item.case_id}</strong>

                  <span className={`status-badge status-${item.status || "draft"}`}>
                    {formatCaseStatus(item.status)}
                  </span>

                  <span
                    className={`risk-pill risk-${item.priority_band || item.risk_level || "low"}`}
                  >
                    {bandLabel(item.priority_band, item.priority_band_label)}
                  </span>

                  {item.blocked ? (
                    <span className="status-badge status-not-ready">Blocked</span>
                  ) : null}

                  {item.is_archived ? (
                    <span className="status-badge status-draft">Архив</span>
                  ) : null}
                </div>

                <div className="priority-case-debtor">{item.debtor_name || "—"}</div>

                <div className="priority-case-meta">
                  <span>{item.contract_type || "—"}</span>
                  <span>·</span>
                  <span>{formatDebtorType(item.debtor_type)}</span>
                  <span>·</span>
                  <span>{formatMoney(item.principal_amount)} ₽</span>
                  <span>·</span>
                  <span>Срок: {item.due_date || "—"}</span>
                </div>

                <div className="priority-case-hint">
                  {item.operator_focus ||
                    item.blocked_reasons?.[0] ||
                    "Открыть карточку дела и продолжить взыскание"}
                </div>

                {!!item.priority_reasons?.length && (
                  <div className="priority-case-meta" style={{ marginTop: 8 }}>
                    {item.priority_reasons.slice(0, 2).map((reason, reasonIndex) => (
                      <span key={`${item.case_id}-reason-${reasonIndex}`}>{reason}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="priority-case-side">
                <div className="priority-risk-score">
                  {item.priority_score ?? item.risk_score ?? 0}
                </div>

                {(item.inn || item.ogrn) && (
                  <div className="priority-routing">
                    {item.inn ? `ИНН: ${item.inn}` : ""}
                    {item.inn && item.ogrn ? " · " : ""}
                    {item.ogrn ? `ОГРН: ${item.ogrn}` : ""}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
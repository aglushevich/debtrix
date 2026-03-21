import {
  formatCaseStatus,
  formatDebtorType,
  formatRoutingStatus,
  formatStageStatus,
} from "./legalLabels";

type Props = {
  dashboard?: any;
};

function renderChipList(items?: string[], emptyText = "Пока пусто.") {
  if (!items?.length) {
    return <div className="compact-empty">{emptyText}</div>;
  }

  return (
    <div className="rail-chip-list">
      {items.map((item, index) => (
        <div className="rail-chip" key={`${item}-${index}`}>
          {item}
        </div>
      ))}
    </div>
  );
}

function stat(value: any, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function riskLabel(level?: string) {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return map[level || ""] || level || "—";
}

function readinessLabel(level?: string) {
  const map: Record<string, string> = {
    ready: "Готово",
    partial: "Частично готово",
    missing: "Недостаточно данных",
    waiting: "Ожидает",
    draft: "Черновик",
    blocked: "Заблокировано",
  };
  return map[level || ""] || level || "—";
}

function formatMoney(value: any) {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return stat(value, "0.00");
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function IntelligencePanel({ dashboard }: Props) {
  const intelligence = dashboard?.debtor_intelligence || {};
  const starterKit = dashboard?.organization_starter_kit || {};
  const routing = dashboard?.routing || {};
  const nextStep = dashboard?.next_step || null;
  const stage = dashboard?.stage || {};
  const debtorRegistry = dashboard?.debtor_registry || {};
  const debtor = intelligence?.debtor || debtorRegistry?.debtor || null;
  const summary = debtorRegistry?.summary || {};
  const caseData = dashboard?.case || {};
  const policyTiming = dashboard?.policy_timing || {};
  const recovery = dashboard?.recovery || null;

  const signals = intelligence?.signals || starterKit?.signals || [];
  const graphHints = intelligence?.graph_hints || starterKit?.graph_hints || [];
  const recommendations = intelligence?.recommendations || starterKit?.recommendations || [];
  const readiness = starterKit?.readiness || {};
  const readinessSummary = starterKit?.summary || {};
  const riskScore = intelligence?.summary?.risk_score;
  const riskLevel = intelligence?.summary?.risk_level;

  const outstandingLike =
    recovery?.outstanding_amount ??
    recovery?.total_amount ??
    recovery?.principal_amount ??
    null;

  return (
    <aside className="intelligence-rail intelligence-rail-decision">
      <section className="rail-panel rail-panel-primary rail-decision-hero">
        <div className="rail-panel-title">Decision rail</div>

        <div className="rail-kpi-list">
          <div className="rail-kpi-card">
            <span className="rail-kpi-label">Следующее рекомендуемое действие</span>
            <strong className="rail-kpi-value">
              {nextStep?.title_ru || nextStep?.title || "Не определено"}
            </strong>
            <div className="muted small" style={{ marginTop: 6 }}>
              {nextStep?.code || "Нет доступного action code"}
            </div>
          </div>

          <div className="rail-kpi-grid">
            <div className="rail-mini-kpi">
              <span>Стадия</span>
              <strong>{formatStageStatus(stage?.status)}</strong>
            </div>
            <div className="rail-mini-kpi">
              <span>Статус дела</span>
              <strong>{formatCaseStatus(caseData?.status)}</strong>
            </div>
            <div className="rail-mini-kpi">
              <span>Risk</span>
              <strong>{riskLabel(riskLevel)}</strong>
            </div>
            <div className="rail-mini-kpi">
              <span>Score</span>
              <strong>{stat(riskScore, "0")} / 100</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Route and eligibility</div>

        <div className="rail-info-list">
          <div className="rail-info-row">
            <span>Корзина маршрутизации</span>
            <strong>{routing?.bucket_code || routing?.routing_status || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Состояние</span>
            <strong>{formatRoutingStatus(routing?.status || routing?.routing_status)}</strong>
          </div>
          <div className="rail-info-row">
            <span>Причина</span>
            <strong>{routing?.reason_code || routing?.reason || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Дата доступности</span>
            <strong>{routing?.eligible_at || routing?.waiting_eligible_at || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Recovery snapshot</div>

        <div className="rail-info-list">
          <div className="rail-info-row">
            <span>Основной долг</span>
            <strong>{formatMoney(caseData?.principal_amount || 0)} ₽</strong>
          </div>
          <div className="rail-info-row">
            <span>Совокупно по должнику</span>
            <strong>{formatMoney(summary?.total_principal_amount || 0)} ₽</strong>
          </div>
          <div className="rail-info-row">
            <span>Связанные дела</span>
            <strong>{stat(summary?.cases_count, "0")}</strong>
          </div>
          <div className="rail-info-row">
            <span>Recovery total</span>
            <strong>
              {outstandingLike !== null ? `${formatMoney(outstandingLike)} ₽` : "—"}
            </strong>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Debtor profile</div>

        <div className="rail-info-list">
          <div className="rail-info-row">
            <span>Наименование</span>
            <strong>{debtor?.name || caseData?.debtor_name || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Тип лица</span>
            <strong>{formatDebtorType(debtor?.debtor_type || caseData?.debtor_type)}</strong>
          </div>
          <div className="rail-info-row">
            <span>ИНН</span>
            <strong>{debtor?.inn || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>ОГРН</span>
            <strong>{debtor?.ogrn || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Руководитель</span>
            <strong>{debtor?.director_name || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Organization readiness</div>

        <div className="rail-info-list">
          <div className="rail-info-row">
            <span>Уровень</span>
            <strong>{readinessLabel(readiness?.level)}</strong>
          </div>
          <div className="rail-info-row">
            <span>Готовность</span>
            <strong>{readiness?.ready ? "Да" : "Нет"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Completion</span>
            <strong>{stat(readinessSummary?.completion_percent, "0")}%</strong>
          </div>
          <div className="rail-info-row">
            <span>Missing fields</span>
            <strong>{stat(readinessSummary?.missing_fields_count, "0")}</strong>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Soft policy timing</div>

        <div className="rail-info-list">
          <div className="rail-info-row">
            <span>Базовая дата</span>
            <strong>{policyTiming?.base_due_date || caseData?.due_date || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>1-е уведомление</span>
            <strong>{policyTiming?.payment_due_notice_eligible_at || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Debt notice</span>
            <strong>{policyTiming?.debt_notice_eligible_at || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Pretension</span>
            <strong>{policyTiming?.pretension_eligible_at || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Сигналы</div>
        {renderChipList(signals, "Сигналы пока не сформированы.")}
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Подсказки по связям</div>
        {renderChipList(graphHints, "Подсказки по структуре пока не сформированы.")}
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Рекомендации</div>
        {renderChipList(recommendations, "Рекомендаций пока нет.")}
      </section>
    </aside>
  );
}
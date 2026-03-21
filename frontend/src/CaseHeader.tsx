import { formatCaseStatus, formatDebtorType } from "./legalLabels";

type Props = {
  selectedCase: number | null;
  selectedCaseCard: any;
  dashboard: any;
};

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function readinessLabel(level?: string | null): string {
  const map: Record<string, string> = {
    ready: "Готово",
    partial: "Частично готово",
    waiting: "Ожидает",
    blocked: "Заблокировано",
    draft: "Черновик",
  };

  return map[String(level || "")] || "Черновик";
}

function readinessClass(level?: string | null): string {
  const map: Record<string, string> = {
    ready: "status-ready",
    partial: "status-draft",
    waiting: "status-waiting",
    blocked: "status-overdue",
    draft: "status-draft",
  };

  return map[String(level || "")] || "status-draft";
}

function formatRoutingLabel(value?: string | null): string {
  const map: Record<string, string> = {
    ready: "Ready",
    waiting: "Waiting",
    blocked: "Blocked",
    idle: "Idle",
    eligible: "Доступно к исполнению",
    in_progress: "В работе",
    active_collection: "Активное взыскание",
    court_lane: "Судебный трек",
    enforcement_lane: "Исполнительный трек",
    general: "Общий поток",
  };

  return map[String(value || "")] || value || "—";
}

function resolveNextStepTitle(nextStep: any): string {
  return nextStep?.title_ru || nextStep?.title || "—";
}

export default function CaseHeader({
  selectedCase,
  selectedCaseCard,
  dashboard,
}: Props) {
  const caseData = dashboard?.case || {};
  const nextStep = dashboard?.next_step || null;
  const smart = caseData?.meta?.smart || caseData?.smart || dashboard?.smart || null;
  const routing = dashboard?.routing || {};

  const debtorName = selectedCaseCard?.debtor_name || caseData?.debtor_name || "—";
  const debtorType = formatDebtorType(caseData?.debtor_type);
  const caseStatus = caseData?.status_title || formatCaseStatus(caseData?.status);
  const contractType = caseData?.contract_type_title || caseData?.contract_type || "—";
  const dueDate = caseData?.due_date || "—";
  const amountText = `${formatMoney(caseData?.principal_amount)} ₽`;

  const smartScore = smart?.readiness_score ?? "—";
  const smartLevel = String(smart?.readiness_level || "draft");
  const smartWarningsCount = Array.isArray(smart?.warnings) ? smart.warnings.length : 0;

  const routingLabel = formatRoutingLabel(
    routing?.status || routing?.routing_status || routing?.bucket_code || null
  );

  const eligibleAt = routing?.eligible_at || routing?.waiting_eligible_at || "—";

  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Case cockpit</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Дело №{selectedCase ?? "—"}
          </div>
          <div className="muted">
            Краткая оперативная сводка перед переходом к playbook, decisioning и execution.
          </div>
        </div>
      </div>

      <div className="case-actions-recommended" style={{ marginTop: 16 }}>
        <div className="case-actions-recommended-label">Следующее рекомендуемое действие</div>
        <div className="case-actions-recommended-title">{resolveNextStepTitle(nextStep)}</div>
        <div className="muted small" style={{ marginTop: 6 }}>
          Код: {nextStep?.code || "—"}
        </div>
      </div>

      <div className="portfolio-mini-stats" style={{ marginTop: 16, marginBottom: 18 }}>
        <div className="portfolio-mini-stat">
          <span>Статус дела</span>
          <strong>{caseStatus}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Smart score</span>
          <strong>{smartScore}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Маршрут</span>
          <strong>{routingLabel}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Warnings</span>
          <strong>{smartWarningsCount}</strong>
        </div>
      </div>

      <div className="info-grid" style={{ marginTop: 16 }}>
        <div className="info-item info-item-wide">
          <span className="label">Должник</span>
          <strong>{debtorName}</strong>
        </div>

        <div className="info-item">
          <span className="label">Тип лица</span>
          <strong>{debtorType}</strong>
        </div>

        <div className="info-item">
          <span className="label">Тип договора</span>
          <strong>{contractType}</strong>
        </div>

        <div className="info-item">
          <span className="label">Сумма долга</span>
          <strong>{amountText}</strong>
        </div>

        <div className="info-item">
          <span className="label">Срок оплаты</span>
          <strong>{dueDate}</strong>
        </div>

        <div className="info-item">
          <span className="label">Готовность кейса</span>
          <strong>
            <span className={`status-badge ${readinessClass(smartLevel)}`}>
              {readinessLabel(smartLevel)}
            </span>
          </strong>
        </div>

        <div className="info-item">
          <span className="label">Routing status</span>
          <strong>{routingLabel}</strong>
        </div>

        <div className="info-item">
          <span className="label">Eligible at</span>
          <strong>{eligibleAt}</strong>
        </div>
      </div>
    </section>
  );
}
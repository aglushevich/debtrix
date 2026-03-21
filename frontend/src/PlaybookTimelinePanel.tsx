type Props = {
  dashboard?: any;
  recommendation?: string;
};

type StepStatus = "done" | "current" | "waiting" | "blocked" | "upcoming";

type PlaybookStep = {
  code: string;
  title: string;
  description: string;
  status: StepStatus;
  eligibleAt?: string | null;
  reason?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

function stepStatusLabel(status: StepStatus) {
  const map: Record<StepStatus, string> = {
    done: "Завершён",
    current: "Текущий",
    waiting: "Ожидает",
    blocked: "Заблокирован",
    upcoming: "Впереди",
  };

  return map[status];
}

function stepBadgeClass(status: StepStatus) {
  const map: Record<StepStatus, string> = {
    done: "status-ready",
    current: "status-pretrial",
    waiting: "status-waiting",
    blocked: "status-not-ready",
    upcoming: "status-draft",
  };

  return map[status];
}

function stepStatusClass(status: StepStatus) {
  const map: Record<StepStatus, string> = {
    done: "is-done",
    current: "is-current",
    waiting: "is-waiting",
    blocked: "is-blocked",
    upcoming: "is-upcoming",
  };

  return map[status];
}

function inferCurrentStepCode(dashboard: any): string {
  const nextCode = String(dashboard?.next_step?.code || "");
  const stageStatus = String(dashboard?.stage?.status || "");
  const caseStatus = String(dashboard?.case?.status || "");

  if (nextCode === "send_payment_due_notice") return "payment_due_notice";
  if (nextCode === "send_debt_notice") return "debt_notice";
  if (nextCode === "send_pretension") return "pretension";
  if (nextCode === "generate_lawsuit" || nextCode === "submit_to_court") return "lawsuit";
  if (nextCode === "send_to_fssp") return "fssp";

  if (caseStatus === "court" || stageStatus === "court") return "lawsuit";
  if (caseStatus === "fssp" || caseStatus === "enforcement" || stageStatus === "fssp") {
    return "fssp";
  }
  if (caseStatus === "pretrial" || stageStatus === "pretrial") return "pretension";
  if (caseStatus === "overdue") return "debt_notice";

  return "payment_due_notice";
}

function buildSteps(dashboard: any): PlaybookStep[] {
  const currentCode = inferCurrentStepCode(dashboard);
  const routing = dashboard?.routing || {};
  const timing = dashboard?.policy_timing || {};
  const stageFlags = dashboard?.stage?.flags || {};

  const waitingReason =
    routing?.reason_code ||
    routing?.reason ||
    routing?.routing_hint ||
    dashboard?.next_step?.reason ||
    null;

  const baseSteps: PlaybookStep[] = [
    {
      code: "payment_due_notice",
      title: "Напоминание о сроке оплаты",
      description: "Первое мягкое касание после наступления due date.",
      eligibleAt: timing?.payment_due_notice_eligible_at || null,
      status: "upcoming",
    },
    {
      code: "debt_notice",
      title: "Уведомление о задолженности",
      description: "Повторное уведомление после фиксации просрочки.",
      eligibleAt: timing?.debt_notice_eligible_at || null,
      status: "upcoming",
    },
    {
      code: "pretension",
      title: "Досудебная претензия",
      description: "Формальный pretrial-этап перед судебным треком.",
      eligibleAt: timing?.pretension_eligible_at || null,
      status: "upcoming",
    },
    {
      code: "lawsuit",
      title: "Иск / подача в суд",
      description: "Переход в court lane и судебное взыскание.",
      status: "upcoming",
    },
    {
      code: "fssp",
      title: "Исполнительное производство / ФССП",
      description: "Переход в enforcement lane после суда.",
      status: "upcoming",
    },
  ];

  const currentIndex = Math.max(
    0,
    baseSteps.findIndex((step) => step.code === currentCode)
  );

  const mappedSteps = baseSteps.map((step, index): PlaybookStep => {
    if (index < currentIndex) {
      return {
        ...step,
        status: "done",
      };
    }

    if (index === currentIndex) {
      if (routing?.status === "blocked") {
        return {
          ...step,
          status: "blocked",
          reason: waitingReason,
        };
      }

      if (routing?.status === "waiting" || routing?.bucket_code === "waiting") {
        return {
          ...step,
          status: "waiting",
          reason: waitingReason,
          eligibleAt: routing?.eligible_at || routing?.waiting_eligible_at || step.eligibleAt,
        };
      }

      return {
        ...step,
        status: "current",
      };
    }

    return {
      ...step,
      status: "upcoming",
    };
  });

  return mappedSteps.map((step): PlaybookStep => {
    if (step.code === "payment_due_notice" && stageFlags.payment_due_notice_sent) {
      return { ...step, status: "done" };
    }

    if (step.code === "debt_notice" && stageFlags.debt_notice_sent) {
      return { ...step, status: "done" };
    }

    if (
      step.code === "pretension" &&
      (stageFlags.pretension_sent || stageFlags.notified)
    ) {
      return { ...step, status: "done" };
    }

    return step;
  });
}

function buildPlaybookTitle(dashboard: any) {
  const contractType =
    dashboard?.case?.contract_type_title ||
    dashboard?.case?.contract_type ||
    "Базовый сценарий";

  return `Recovery playbook · ${contractType}`;
}

function buildBlockers(dashboard: any): string[] {
  const routing = dashboard?.routing || {};
  const blockers: string[] = [];

  if (routing?.status === "blocked" && routing?.reason_code) {
    blockers.push(String(routing.reason_code));
  }

  if (!dashboard?.case?.due_date) blockers.push("missing_due_date");
  if (!dashboard?.case?.principal_amount) blockers.push("missing_principal_amount");
  if (!dashboard?.case?.contract_type) blockers.push("missing_contract_type");

  return Array.from(new Set(blockers));
}

function normalizeBlockerLabel(code: string) {
  const map: Record<string, string> = {
    missing_due_date: "Не указан срок оплаты",
    missing_principal_amount: "Не указана сумма долга",
    missing_contract_type: "Не указан тип договора",
  };

  return map[code] || code;
}

export default function PlaybookTimelinePanel({
  dashboard,
  recommendation,
}: Props) {
  const steps = buildSteps(dashboard);
  const routing = dashboard?.routing || {};
  const nextStep = dashboard?.next_step || null;
  const blockers = buildBlockers(dashboard);

  const currentStep = steps.find(
    (item) =>
      item.status === "current" ||
      item.status === "waiting" ||
      item.status === "blocked"
  );

  return (
    <section className="panel playbook-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Playbook engine</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Playbook timeline
          </div>
          <div className="muted">
            Жизненный цикл взыскания по делу: пройденные шаги, текущая точка и следующий ход.
          </div>
        </div>
      </div>

      <div className="playbook-summary-grid" style={{ marginTop: 16 }}>
        <div className="playbook-summary-card playbook-summary-card-primary">
          <span>Playbook</span>
          <strong>{buildPlaybookTitle(dashboard)}</strong>
          <div className="muted small" style={{ marginTop: 8, color: "rgba(255,255,255,0.76)" }}>
            Routing: {routing?.bucket_code || routing?.status || "general"}
          </div>
        </div>

        <div className="playbook-summary-card">
          <span>Текущий шаг</span>
          <strong>{currentStep?.title || "—"}</strong>
        </div>

        <div className="playbook-summary-card">
          <span>Следующее действие</span>
          <strong>
            {nextStep?.title_ru || nextStep?.title || recommendation || "—"}
          </strong>
        </div>

        <div className="playbook-summary-card">
          <span>Routing status</span>
          <strong>{routing?.status || "—"}</strong>
        </div>
      </div>

      <div className="playbook-steps-list">
        {steps.map((step, index) => (
          <div className="playbook-step-row" key={step.code}>
            <div className={`playbook-step-marker ${stepStatusClass(step.status)}`}>
              {index + 1}
            </div>

            <div className={`playbook-step-card ${stepStatusClass(step.status)}`}>
              <div className="playbook-step-top">
                <div>
                  <div className="playbook-step-title">{step.title}</div>
                  <div className="playbook-step-description">{step.description}</div>
                </div>

                <span className={`status-badge ${stepBadgeClass(step.status)}`}>
                  {stepStatusLabel(step.status)}
                </span>
              </div>

              <div className="playbook-step-meta">
                <div className="playbook-step-meta-item">
                  <span>eligible_at</span>
                  <strong>{formatDate(step.eligibleAt)}</strong>
                </div>

                <div className="playbook-step-meta-item">
                  <span>reason</span>
                  <strong>{step.reason || "—"}</strong>
                </div>
              </div>
            </div>

            {index < steps.length - 1 && <div className="playbook-step-line" />}
          </div>
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid-secondary" style={{ marginTop: 18 }}>
        <div className="playbook-decision-card">
          <div className="playbook-decision-label">Что делать сейчас</div>
          <div className="playbook-decision-title">
            {nextStep?.title_ru ||
              nextStep?.title ||
              recommendation ||
              "Открыть карточку и проверить маршрут"}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            Код действия: {nextStep?.code || "—"}
          </div>
        </div>

        <div className="playbook-blockers-card">
          <div className="playbook-decision-label">Blockers / prerequisites</div>

          {blockers.length ? (
            <div className="playbook-chip-list">
              {blockers.map((item, index) => (
                <span
                  key={`${item}:${index}`}
                  className="playbook-chip playbook-chip-warning"
                >
                  {normalizeBlockerLabel(item)}
                </span>
              ))}
            </div>
          ) : (
            <div className="muted">Явных blocker’ов сейчас не видно.</div>
          )}
        </div>
      </div>
    </section>
  );
}
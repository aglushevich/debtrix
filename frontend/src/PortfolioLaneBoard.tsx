import { formatDebtorType } from "./legalLabels";
import { buildWaitingHint, formatEligibleAt } from "./waitingEngine";

type Props = {
  dashboard?: any;
  onOpenCase: (caseId: number) => void;
};

function laneTitle(key: string): string {
  const map: Record<string, string> = {
    ready: "Ready",
    waiting: "Waiting",
    blocked: "Blocked",
    idle: "Idle",
  };
  return map[key] || key;
}

function laneDescription(key: string): string {
  const map: Record<string, string> = {
    ready: "Кейсы, которые можно двигать прямо сейчас",
    waiting: "Кейсы, ожидающие временного окна или eligible_at",
    blocked: "Кейсы с недостающими данными или blocker’ами",
    idle: "Кейсы вне активного маршрута взыскания",
  };
  return map[key] || "";
}

function statusLabel(status?: string): string {
  const map: Record<string, string> = {
    draft: "Черновик",
    overdue: "Просрочка",
    pretrial: "Досудебно",
    court: "Суд",
    fssp: "ФССП",
    enforcement: "Исполнение",
    closed: "Закрыто",
  };
  return map[status || ""] || status || "—";
}

function bucketHint(key: string, item: any): string {
  if (key === "ready") {
    return "Можно открывать карточку и выполнять следующее действие";
  }

  if (key === "waiting") {
    return buildWaitingHint(item?.waiting_bucket || item);
  }

  if (key === "blocked") {
    return item?.routing_hint || item?.routing_status || "Нужна проверка данных и устранение blocker’ов";
  }

  return item?.routing_hint || item?.routing_status || "Требуется разбор маршрута";
}

export default function PortfolioLaneBoard({ dashboard, onOpenCase }: Props) {
  const routing = dashboard?.routing || {};
  const summary = routing?.summary || {};
  const buckets = routing?.buckets || {};

  const laneKeys = ["ready", "waiting", "blocked", "idle"];

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Routing workspace</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Routing lanes
          </div>
          <div className="muted">
            Операционный board по текущему распределению кейсов в портфеле
          </div>
        </div>
      </div>

      <div
        className="routing-overview-grid"
        style={{ marginTop: 16, marginBottom: 18 }}
      >
        <div className="routing-overview-card is-ready">
          <span>Ready</span>
          <strong>{summary.ready || 0}</strong>
          <div className="muted small">Можно брать в обработку сейчас</div>
        </div>

        <div className="routing-overview-card is-waiting">
          <span>Waiting</span>
          <strong>{summary.waiting || 0}</strong>
          <div className="muted small">Ожидают eligible window</div>
        </div>

        <div className="routing-overview-card is-blocked">
          <span>Blocked</span>
          <strong>{summary.blocked || 0}</strong>
          <div className="muted small">Требуют снятия blocker’ов</div>
        </div>

        <div className="routing-overview-card is-idle">
          <span>Idle</span>
          <strong>{summary.idle || 0}</strong>
          <div className="muted small">Вне активного маршрута</div>
        </div>
      </div>

      <div className="lane-board">
        {laneKeys.map((key) => {
          const items = Array.isArray(buckets?.[key]) ? buckets[key] : [];

          return (
            <div className={`lane-column lane-${key}`} key={key}>
              <div className="lane-column-header">
                <div>
                  <div className="lane-column-title">{laneTitle(key)}</div>
                  <div className="lane-column-subtitle">{laneDescription(key)}</div>
                </div>
                <div className="lane-column-count">{items.length}</div>
              </div>

              <div className="lane-column-body">
                {items.length ? (
                  items.slice(0, 6).map((item: any) => (
                    <button
                      key={`${key}-${item.case_id}`}
                      className="lane-card"
                      onClick={() => onOpenCase(item.case_id)}
                    >
                      <div className="lane-card-top">
                        <strong>Дело #{item.case_id}</strong>
                        <span className={`status-badge status-${item.status || "draft"}`}>
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <div className="lane-card-name">{item.debtor_name || "—"}</div>

                      <div className="lane-card-meta">
                        {item.contract_type || "—"} · {formatDebtorType(item.debtor_type)}
                      </div>

                      <div className="triage-card-hint" style={{ marginTop: 6 }}>
                        {bucketHint(key, item)}
                      </div>

                      {key === "waiting" && item?.waiting_eligible_at && (
                        <div className="muted small" style={{ marginTop: 6 }}>
                          Eligible at: {formatEligibleAt(item.waiting_eligible_at)}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="empty-box lane-empty">Пусто</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
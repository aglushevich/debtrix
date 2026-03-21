export type FocusQueueCode =
  | "urgent_ready"
  | "blocked_cleanup"
  | "waiting_next"
  | "court_lane"
  | "enforcement_lane";

type Props = {
  dashboard?: any;
  selectedCase: number | null;
  onOpenCase: (caseId: number) => void;
  onOpenQueue?: (queueCode: FocusQueueCode) => void;
};

function bandLabel(level?: string): string {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return map[level || ""] || level || "—";
}

function bandClass(level?: string): string {
  const map: Record<string, string> = {
    low: "risk-low",
    medium: "risk-medium",
    high: "risk-high",
    critical: "risk-critical",
  };
  return map[level || ""] || "risk-low";
}

function queueTitle(code: FocusQueueCode): string {
  const map: Record<FocusQueueCode, string> = {
    urgent_ready: "Срочно в работу",
    blocked_cleanup: "Разблокировать",
    waiting_next: "Ожидают окна",
    court_lane: "Судебный трек",
    enforcement_lane: "Исполнительный трек",
  };
  return map[code];
}

function queueHint(code: FocusQueueCode): string {
  const map: Record<FocusQueueCode, string> = {
    urgent_ready: "Самые полезные кейсы для немедленного действия",
    blocked_cleanup: "Снять blocker’ы и вернуть кейсы в throughput",
    waiting_next: "Следить за ближайшими eligible windows",
    court_lane: "Контролировать движение судебного потока",
    enforcement_lane: "Контролировать исполнительные действия",
  };
  return map[code];
}

function queueEmptyHint(code: FocusQueueCode): string {
  const map: Record<FocusQueueCode, string> = {
    urgent_ready: "Сейчас нет кейсов, которые нужно брать немедленно.",
    blocked_cleanup: "Явных блокировок сейчас не видно.",
    waiting_next: "Кейсов в ожидании окна сейчас нет.",
    court_lane: "Судебный трек сейчас пуст.",
    enforcement_lane: "Исполнительный трек сейчас пуст.",
  };
  return map[code];
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

export default function FocusQueuesPanel({
  dashboard,
  selectedCase,
  onOpenCase,
  onOpenQueue,
}: Props) {
  const focusQueues = dashboard?.focus_queues || {};
  const summary = focusQueues?.summary || {};
  const queues = focusQueues?.queues || {};

  const queueOrder: FocusQueueCode[] = [
    "urgent_ready",
    "blocked_cleanup",
    "waiting_next",
    "court_lane",
    "enforcement_lane",
  ];

  function toneClass(code: FocusQueueCode): string {
    if (code === "urgent_ready") return "is-ready";
    if (code === "waiting_next") return "is-waiting";
    if (code === "blocked_cleanup") return "is-blocked";
    return "is-idle";
  }

  function renderSummaryCard(code: FocusQueueCode) {
    const content = (
      <>
        <span>{queueTitle(code)}</span>
        <strong>{Number(summary?.[code] || 0)}</strong>
        <div className="muted small">{queueHint(code)}</div>
      </>
    );

    if (!onOpenQueue) {
      return (
        <div key={code} className={`routing-overview-card ${toneClass(code)}`}>
          {content}
        </div>
      );
    }

    return (
      <button
        type="button"
        key={code}
        className={`routing-overview-card ${toneClass(code)}`}
        onClick={() => onOpenQueue(code)}
        style={{ textAlign: "left", cursor: "pointer" }}
      >
        {content}
      </button>
    );
  }

  return (
    <section className="panel control-room-focus-queues-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Focus queues</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Очереди фокуса
          </div>
          <div className="muted">
            Операторские очереди, из которых видно, что брать сейчас, что
            разблокировать и где нужен постоянный контроль.
          </div>
        </div>
      </div>

      <div className="routing-overview-grid" style={{ marginTop: 16 }}>
        {queueOrder.map(renderSummaryCard)}
      </div>

      <div className="focus-queues-grid" style={{ marginTop: 18 }}>
        {queueOrder.map((code) => {
          const items = Array.isArray(queues?.[code]) ? queues[code] : [];

          return (
            <div className="focus-queue-column" key={code}>
              <div className="focus-queue-column-head">
                <div style={{ flex: 1 }}>
                  {onOpenQueue ? (
                    <button
                      type="button"
                      onClick={() => onOpenQueue(code)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        margin: 0,
                        textAlign: "left",
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      <div className="focus-queue-column-title">{queueTitle(code)}</div>
                      <div className="focus-queue-column-subtitle">{queueHint(code)}</div>
                    </button>
                  ) : (
                    <>
                      <div className="focus-queue-column-title">{queueTitle(code)}</div>
                      <div className="focus-queue-column-subtitle">{queueHint(code)}</div>
                    </>
                  )}
                </div>

                <div
                  className="focus-queue-column-count"
                  style={onOpenQueue ? { cursor: "pointer" } : undefined}
                  onClick={onOpenQueue ? () => onOpenQueue(code) : undefined}
                >
                  {items.length}
                </div>
              </div>

              {items.length ? (
                <div className="focus-queue-list">
                  {items.map((item: any) => (
                    <button
                      key={`${code}-${item.case_id}`}
                      className={`focus-queue-card ${
                        selectedCase === item.case_id ? "is-current" : ""
                      }`}
                      onClick={() => onOpenCase(item.case_id)}
                    >
                      <div className="focus-queue-card-top">
                        <strong>Дело #{item.case_id}</strong>
                        <span
                          className={`risk-pill ${bandClass(
                            item.priority_band || item.risk_level
                          )}`}
                        >
                          {bandLabel(item.priority_band || item.risk_level)} ·{" "}
                          {item.priority_score ?? item.risk_score ?? 0}
                        </span>
                      </div>

                      <div className="focus-queue-card-name">{item.debtor_name || "—"}</div>

                      <div className="focus-queue-card-meta">
                        {item.contract_type || "—"} · {item.status || "—"} ·{" "}
                        {item.principal_amount || "—"} ₽
                      </div>

                      <div className="focus-queue-card-hint">
                        {item.operator_focus ||
                          item.recommended_action ||
                          item.routing_hint ||
                          "Открыть карточку"}
                      </div>

                      {!!item.priority_reasons?.length && (
                        <div className="muted small" style={{ marginTop: 8 }}>
                          {item.priority_reasons[0]}
                        </div>
                      )}

                      {(item.waiting_eligible_at || item.blocked_reasons?.length) && (
                        <div className="muted small" style={{ marginTop: 8 }}>
                          {item.waiting_eligible_at
                            ? `eligible_at: ${formatDateTime(item.waiting_eligible_at)}`
                            : item.blocked_reasons?.[0] || "Есть blocker"}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-box">
                  {queueEmptyHint(code)}
                  {!!onOpenQueue && (
                    <div className="muted small" style={{ marginTop: 8 }}>
                      Можно открыть registry для проверки полного среза.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
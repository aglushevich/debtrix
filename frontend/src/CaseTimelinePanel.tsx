type Props = {
  timeline: any;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU");
}

function resolveTitle(item: any): string {
  return item?.title_ru || item?.title || item?.event_title || item?.event_type || "Событие";
}

function resolveDetails(item: any): string {
  return item?.details || item?.description || item?.payload_text || "Без дополнительного описания.";
}

function resolveEventTypeLabel(value?: string | null): string {
  const map: Record<string, string> = {
    case_created: "Создание дела",
    case_updated: "Обновление дела",
    stage_changed: "Смена стадии",
    stage_action_applied: "Применено действие",
    document_generated: "Сформирован документ",
    document_downloaded: "Скачан документ",
    debtor_identified: "Должник идентифицирован",
    debtor_refreshed: "Профиль должника обновлён",
    soft_policy_updated: "Обновлены настройки soft stage",
    automation_started: "Automation started",
    automation_finished: "Automation finished",
    automation_failed: "Automation failed",
    batch_started: "Batch started",
    batch_finished: "Batch finished",
    batch_failed: "Batch failed",
  };

  return map[String(value || "")] || value || "Событие";
}

function eventBadgeClass(value?: string | null): string {
  const code = String(value || "").toLowerCase();

  if (code.includes("failed") || code.includes("error") || code.includes("blocked")) {
    return "status-overdue";
  }

  if (
    code.includes("finished") ||
    code.includes("completed") ||
    code.includes("generated") ||
    code.includes("applied") ||
    code.includes("identified") ||
    code.includes("refreshed")
  ) {
    return "status-ready";
  }

  if (code.includes("waiting") || code.includes("queued")) {
    return "status-waiting";
  }

  if (code.includes("started") || code.includes("running")) {
    return "status-pretrial";
  }

  return "status-draft";
}

function buildStats(items: any[]) {
  const summary = {
    total: items.length,
    actions: 0,
    documents: 0,
    automation: 0,
    updates: 0,
  };

  for (const item of items) {
    const type = String(item?.event_type || "").toLowerCase();

    if (
      type.includes("action") ||
      type.includes("stage_action") ||
      type.includes("submit") ||
      type.includes("send")
    ) {
      summary.actions += 1;
      continue;
    }

    if (type.includes("document")) {
      summary.documents += 1;
      continue;
    }

    if (type.includes("automation") || type.includes("batch")) {
      summary.automation += 1;
      continue;
    }

    summary.updates += 1;
  }

  return summary;
}

export default function CaseTimelinePanel({ timeline }: Props) {
  const items = Array.isArray(timeline?.items) ? timeline.items : [];
  const stats = buildStats(items);

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Case timeline</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Хронология дела
          </div>
          <div className="muted">
            Последовательность ключевых событий, смены статусов, действий и изменений по делу.
          </div>
        </div>
      </div>

      {!!items.length && (
        <div className="ops-grid ops-grid-compact" style={{ marginTop: 16, marginBottom: 16 }}>
          <div className="ops-card ops-card-accent">
            <div className="ops-card-title">Всего событий</div>
            <div className="ops-card-value">{stats.total}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Действия</div>
            <div className="ops-card-value">{stats.actions}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Документы</div>
            <div className="ops-card-value">{stats.documents}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Automation / batch</div>
            <div className="ops-card-value">{stats.automation}</div>
          </div>
        </div>
      )}

      {!items.length ? (
        <div className="empty-box" style={{ marginTop: 14 }}>
          История дела пока пуста.
        </div>
      ) : (
        <div className="timeline-list" style={{ marginTop: 14 }}>
          {items.map((item: any, index: number) => {
            const eventType = resolveEventTypeLabel(item?.event_type);
            const details = resolveDetails(item);

            return (
              <div
                className="timeline-item"
                key={item?.id || `${item?.event_type || "event"}-${index}`}
              >
                <div className="timeline-item-top">
                  <div>
                    <strong>{resolveTitle(item)}</strong>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {formatDateTime(item?.created_at)}
                    </div>
                  </div>

                  {item?.event_type ? (
                    <span className={`status-badge ${eventBadgeClass(item?.event_type)}`}>
                      {eventType}
                    </span>
                  ) : null}
                </div>

                <div className="muted" style={{ marginTop: 8 }}>{details}</div>

                <div
                  className="participant-meta-grid"
                  style={{
                    marginTop: 12,
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  }}
                >
                  <div className="info-item">
                    <span className="label">Тип события</span>
                    <strong>{item?.event_type || "—"}</strong>
                  </div>

                  <div className="info-item">
                    <span className="label">Время</span>
                    <strong>{formatDateTime(item?.created_at)}</strong>
                  </div>

                  {item?.actor ? (
                    <div className="info-item">
                      <span className="label">Инициатор</span>
                      <strong>{item.actor}</strong>
                    </div>
                  ) : null}

                  {item?.source ? (
                    <div className="info-item">
                      <span className="label">Источник</span>
                      <strong>{item.source}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
import { useEffect, useMemo, useState } from "react";
import { getExecutionHistory } from "./api";
import { formatActionCode, formatExecutionStatus } from "./legalLabels";

type Props = {
  caseId: number;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ru-RU");
}

function statusBadgeClass(status?: string) {
  const map: Record<string, string> = {
    success: "status-ready",
    completed: "status-ready",
    running: "status-pretrial",
    queued: "status-draft",
    pending: "status-draft",
    waiting: "status-waiting",
    blocked: "status-not-ready",
    already_processed: "status-pretrial",
    not_applicable: "status-not-ready",
    failed: "status-overdue",
    error: "status-overdue",
    skipped: "status-draft",
  };

  return map[status || ""] || "status-draft";
}

function buildStats(items: any[]) {
  const summary = {
    total: items.length,
    success: 0,
    running: 0,
    waiting: 0,
    blocked: 0,
    error: 0,
  };

  for (const item of items) {
    const status = String(item?.status || "");
    if (status === "success" || status === "completed") summary.success += 1;
    else if (status === "running" || status === "queued" || status === "pending") summary.running += 1;
    else if (status === "waiting") summary.waiting += 1;
    else if (status === "blocked" || status === "not_applicable") summary.blocked += 1;
    else if (status === "failed" || status === "error") summary.error += 1;
  }

  return summary;
}

export default function ExecutionHistoryPanel({ caseId }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await getExecutionHistory(caseId);
      setItems(res?.items || []);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Не удалось загрузить историю выполнения.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  const stats = useMemo(() => buildStats(items), [items]);

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Case execution log</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            История выполнения действий
          </div>
          <div className="muted">
            Журнал выполненных, запущенных, заблокированных и ожидающих действий по делу.
          </div>
        </div>

        <div className="action-list">
          <button className="secondary-btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

      {!loading && !error && items.length > 0 && (
        <div className="ops-grid ops-grid-compact" style={{ marginBottom: 16 }}>
          <div className="ops-card ops-card-accent">
            <div className="ops-card-title">Всего записей</div>
            <div className="ops-card-value">{stats.total}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Успешно</div>
            <div className="ops-card-value">{stats.success}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">В процессе</div>
            <div className="ops-card-value">{stats.running}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Waiting / blocked / error</div>
            <div className="ops-card-value">
              {stats.waiting + stats.blocked + stats.error}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="empty-box" style={{ marginTop: 14 }}>
          Загружаем execution history…
        </div>
      )}

      {!loading && error && (
        <div className="empty-box" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty-box" style={{ marginTop: 14 }}>
          По делу пока не зафиксированы выполненные или запущенные действия.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="timeline-list" style={{ marginTop: 14 }}>
          {items.map((item) => (
            <div key={item.id} className="timeline-item execution-history-item">
              <div className="timeline-item-top">
                <div>
                  <strong>{formatActionCode(item.action_code)}</strong>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {formatDateTime(item.created_at)}
                  </div>
                </div>

                <span className={`status-badge ${statusBadgeClass(item.status)}`}>
                  {formatExecutionStatus(item.status)}
                </span>
              </div>

              {item.reason && (
                <div className="muted" style={{ marginTop: 8 }}>
                  Основание: {item.reason}
                </div>
              )}

              <div
                className="participant-meta-grid"
                style={{ marginTop: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
              >
                <div className="info-item">
                  <span className="label">Статус выполнения</span>
                  <strong>{formatExecutionStatus(item.status)}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Технический код</span>
                  <strong>{item.action_code || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Создано</span>
                  <strong>{formatDateTime(item.created_at)}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Eligible at</span>
                  <strong>{formatDateTime(item.eligible_at)}</strong>
                </div>

                <div className="info-item info-item-wide">
                  <span className="label">Комментарий</span>
                  <strong>{item.reason || "Без дополнительного комментария"}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
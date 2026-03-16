import { useEffect, useState } from "react";
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
    waiting: "status-draft",
    blocked: "status-not-ready",
    already_processed: "status-pretrial",
    not_applicable: "status-not-ready",
    failed: "status-overdue",
    error: "status-overdue",
    skipped: "status-draft",
  };

  return map[status || ""] || "status-draft";
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
    load();
  }, [caseId]);

  return (
    <section className="panel">
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
      </div>

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
            <div key={item.id} className="timeline-item">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
import { useEffect, useState } from "react";
import { getExecutionHistory } from "./api";
import { formatActionCode, formatExecutionStatus } from "./legal";

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

export default function ExecutionHistoryPanel({ caseId }: Props) {
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    const res = await getExecutionHistory(caseId);
    setItems(res?.items || []);
  }

  useEffect(() => {
    load();
  }, [caseId]);

  return (
    <section className="panel">
      <div className="panel-title">История выполнения действий</div>

      {items.length === 0 && (
        <div className="empty-box">
          По делу пока не зафиксированы выполненные или запущенные действия.
        </div>
      )}

      {items.length > 0 && (
        <div className="timeline-list">
          {items.map((item) => (
            <div key={item.id} className="timeline-item">
              <div className="timeline-item-top">
                <strong>{formatActionCode(item.action_code)}</strong>
                <span className="muted small">{formatDateTime(item.created_at)}</span>
              </div>

              <div className="muted">
                Статус: {formatExecutionStatus(item.status)}
              </div>

              {item.reason && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Основание: {item.reason}
                </div>
              )}

              {item.action_code && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Технический код действия: {item.action_code}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
import { useEffect, useState } from "react";
import { ExecutionConsoleRun, getExecutionConsoleRuns } from "./api";

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    completed: "Завершён",
    running: "Выполняется",
    failed: "С ошибками",
    draft: "Черновик",
  };
  return map[status || ""] || status || "—";
}

export default function ExecutionConsolePanel() {
  const [items, setItems] = useState<ExecutionConsoleRun[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const result = await getExecutionConsoleRuns();
      setItems(result || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="panel">
      <div className="panel-title">Execution Console</div>

      {loading && <div className="empty-box">Загрузка execution history…</div>}

      {!loading && items.length === 0 && (
        <div className="empty-box">История batch execution пока пуста.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="participants-list">
          {items.map((item) => (
            <div className="participant-card" key={item.id}>
              <div className="participant-card-top">
                <div>
                  <div className="participant-role">Run #{item.id}</div>
                  <div className="participant-name">{item.title}</div>
                </div>

                <div className="participant-badges">
                  <span className={`status-badge status-${item.status || "draft"}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
              </div>

              <div className="participant-meta-grid">
                <div className="info-item">
                  <span className="label">Action</span>
                  <strong>{item.action_code}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Создан</span>
                  <strong>{item.created_at}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Всего</span>
                  <strong>{item.total}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Success</span>
                  <strong>{item.success}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Blocked</span>
                  <strong>{item.blocked}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Waiting</span>
                  <strong>{item.waiting}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Errors</span>
                  <strong>{item.errors}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
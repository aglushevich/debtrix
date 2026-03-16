import { useEffect, useState } from "react";
import { getExecutionConsoleRuns } from "./api";

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    completed: "Завершён",
    running: "Выполняется",
    failed: "С ошибками",
    draft: "Черновик",
  };
  return map[status || ""] || status || "—";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU");
}

export default function ExecutionConsolePanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const result = await getExecutionConsoleRuns();
      setData(result || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const items = data?.batch_jobs || [];
  const batchMetrics = data?.batch_metrics || {};
  const automationMetrics = data?.automation_metrics || {};

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Execution monitoring</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Execution Console
          </div>
          <div className="muted">
            Мониторинг batch jobs и automation runs внутри Recovery Control Room.
          </div>
        </div>
      </div>

      {loading && <div className="empty-box">Загрузка execution console…</div>}

      {!loading && (
        <>
          <div className="ops-grid batch-metrics-grid" style={{ marginBottom: 16 }}>
            <div className="ops-card">
              <div className="ops-card-title">Batch jobs</div>
              <div className="ops-card-value">{batchMetrics.total || 0}</div>
              <div className="muted small">
                running: {batchMetrics.running || 0} · completed:{" "}
                {batchMetrics.completed || 0}
              </div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Automation runs</div>
              <div className="ops-card-value">{automationMetrics.total || 0}</div>
              <div className="muted small">
                running: {automationMetrics.running || 0} · completed:{" "}
                {automationMetrics.completed || 0}
              </div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Ошибки batch</div>
              <div className="ops-card-value">{batchMetrics.failed || 0}</div>
              <div className="muted small">Проверь проблемные пакетные запуски</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Ошибки automation</div>
              <div className="ops-card-value">{automationMetrics.failed || 0}</div>
              <div className="muted small">Нужен контроль автоматизаций</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Running всего</div>
              <div className="ops-card-value">
                {(batchMetrics.running || 0) + (automationMetrics.running || 0)}
              </div>
              <div className="muted small">Активная нагрузка execution layer</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Failures всего</div>
              <div className="ops-card-value">
                {(batchMetrics.failed || 0) + (automationMetrics.failed || 0)}
              </div>
              <div className="muted small">Нужен оперативный разбор</div>
            </div>
          </div>

          {!items.length && (
            <div className="empty-box">История batch execution пока пуста.</div>
          )}

          {items.length > 0 && (
            <div className="execution-run-list">
              {items.map((item: any) => (
                <div className="execution-run-card" key={item.id}>
                  <div className="execution-run-top">
                    <div>
                      <div className="participant-role">Запуск #{item.id}</div>
                      <div className="execution-run-title">
                        {item.title || "Без названия"}
                      </div>
                    </div>

                    <div className="participant-badges">
                      <span className={`status-badge status-${item.status || "draft"}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  </div>

                  <div className="execution-run-grid">
                    <div className="info-item">
                      <span className="label">Тип задания</span>
                      <strong>{item.job_type || "—"}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Создан</span>
                      <strong>{formatDateTime(item.created_at)}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Старт</span>
                      <strong>{formatDateTime(item.started_at)}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Завершён</span>
                      <strong>{formatDateTime(item.finished_at)}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Успешно</span>
                      <strong>{item.success || 0}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Blocked</span>
                      <strong>{item.blocked || 0}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Waiting</span>
                      <strong>{item.waiting || 0}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Ошибки</span>
                      <strong>{item.errors || 0}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Не применимо</span>
                      <strong>{item.not_applicable || 0}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Уже обработано</span>
                      <strong>{item.already_processed || 0}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
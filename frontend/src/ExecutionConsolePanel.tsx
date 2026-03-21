import { useEffect, useMemo, useState } from "react";
import { getExecutionConsoleRuns } from "./api";

type Props = {
  refreshKey?: number;
};

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    completed: "Завершён",
    finished: "Завершён",
    running: "Выполняется",
    failed: "С ошибками",
    draft: "Черновик",
    queued: "В очереди",
  };
  return map[status || ""] || status || "—";
}

function statusClass(status?: string) {
  const map: Record<string, string> = {
    completed: "status-ready",
    finished: "status-ready",
    running: "status-pretrial",
    failed: "status-overdue",
    draft: "status-draft",
    queued: "status-waiting",
  };
  return map[status || ""] || "status-draft";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU");
}

export default function ExecutionConsolePanel({ refreshKey = 0 }: Props) {
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
  }, [refreshKey]);

  const items = data?.batch_jobs || [];
  const batchMetrics = data?.batch_metrics || {};
  const automationMetrics = data?.automation_metrics || {};

  const runningTotal = Number(batchMetrics.running || 0) + Number(automationMetrics.running || 0);
  const failedTotal = Number(batchMetrics.failed || 0) + Number(automationMetrics.failed || 0);
  const completedTotal =
    Number(batchMetrics.completed || batchMetrics.finished || 0) +
    Number(automationMetrics.completed || automationMetrics.finished || 0);

  const highlightedItems = useMemo(() => {
    return [...items]
      .sort((a: any, b: any) => {
        const priority = (value: string) => {
          if (value === "running") return 0;
          if (value === "failed") return 1;
          if (value === "queued") return 2;
          if (value === "completed" || value === "finished") return 3;
          return 4;
        };

        return priority(a?.status) - priority(b?.status);
      })
      .slice(0, 8);
  }, [items]);

  return (
    <section className="panel execution-console-panel">
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

        <div className="action-list">
          <button className="secondary-btn" onClick={load} disabled={loading}>
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

      <div className="execution-console-hero">
        <div className="execution-console-hero-main">
          <div className="execution-console-hero-label">Нагрузка execution layer</div>
          <div className="execution-console-hero-value">{runningTotal}</div>
          <div className="execution-console-hero-title">Активных запусков сейчас</div>
          <div className="execution-console-hero-subtitle">
            Это живая загрузка execution layer: текущие batch jobs и automation runs.
          </div>
        </div>

        <div className="execution-console-hero-side">
          <div className="execution-console-mini-card tone-success">
            <span>Completed total</span>
            <strong>{completedTotal}</strong>
          </div>

          <div className="execution-console-mini-card tone-danger">
            <span>Failures total</span>
            <strong>{failedTotal}</strong>
          </div>

          <div className="execution-console-mini-card tone-accent">
            <span>Batch jobs</span>
            <strong>{batchMetrics.total || 0}</strong>
          </div>

          <div className="execution-console-mini-card tone-warning">
            <span>Automation runs</span>
            <strong>{automationMetrics.total || 0}</strong>
          </div>
        </div>
      </div>

      {loading && <div className="empty-box">Загрузка execution console…</div>}

      {!loading && (
        <>
          <div className="ops-grid batch-metrics-grid" style={{ marginTop: 16 }}>
            <div className="ops-card">
              <div className="ops-card-title">Batch jobs</div>
              <div className="ops-card-value">{batchMetrics.total || 0}</div>
              <div className="muted small">
                running: {batchMetrics.running || 0} · completed:{" "}
                {batchMetrics.completed || batchMetrics.finished || 0}
              </div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Automation runs</div>
              <div className="ops-card-value">{automationMetrics.total || 0}</div>
              <div className="muted small">
                running: {automationMetrics.running || 0} · completed:{" "}
                {automationMetrics.completed || automationMetrics.finished || 0}
              </div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Ошибки batch</div>
              <div className="ops-card-value">{batchMetrics.failed || 0}</div>
              <div className="muted small">проверь проблемные пакетные запуски</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Ошибки automation</div>
              <div className="ops-card-value">{automationMetrics.failed || 0}</div>
              <div className="muted small">нужен контроль автоматизаций</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Running всего</div>
              <div className="ops-card-value">{runningTotal}</div>
              <div className="muted small">активная нагрузка execution layer</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Failures всего</div>
              <div className="ops-card-value">{failedTotal}</div>
              <div className="muted small">нужен оперативный разбор</div>
            </div>
          </div>

          {!items.length && (
            <div className="empty-box" style={{ marginTop: 16 }}>
              История batch execution пока пуста.
            </div>
          )}

          {highlightedItems.length > 0 && (
            <section className="panel panel-nested" style={{ marginTop: 16, marginBottom: 16 }}>
              <div className="panel-title">Фокус запуска</div>

              <div className="execution-console-focus-grid">
                {highlightedItems.map((item: any) => (
                  <div className="execution-console-focus-card" key={`focus-${item.id}`}>
                    <div className="participant-card-top">
                      <div>
                        <div className="participant-role">Запуск #{item.id}</div>
                        <div className="participant-name">{item.title || "Без названия"}</div>
                      </div>

                      <span className={`status-badge ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <div className="muted small" style={{ marginTop: 8 }}>
                      {item.job_type || "—"} · создан {formatDateTime(item.created_at)}
                    </div>

                    <div className="execution-console-focus-stats">
                      <div className="mini-stat-box">
                        <span>success</span>
                        <strong>{item.success || 0}</strong>
                      </div>
                      <div className="mini-stat-box">
                        <span>blocked</span>
                        <strong>{item.blocked || 0}</strong>
                      </div>
                      <div className="mini-stat-box">
                        <span>waiting</span>
                        <strong>{item.waiting || 0}</strong>
                      </div>
                      <div className="mini-stat-box">
                        <span>errors</span>
                        <strong>{item.errors || 0}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
                      <span className={`status-badge ${statusClass(item.status)}`}>
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
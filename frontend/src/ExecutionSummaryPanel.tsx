type Props = {
  execution?: any;
};

function stat(value: any, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export default function ExecutionSummaryPanel({ execution }: Props) {
  const batchMetrics = execution?.batch_metrics || {};
  const automationMetrics = execution?.automation_metrics || {};

  const batchRunning = Number(batchMetrics.running || 0);
  const batchCompleted = Number(batchMetrics.completed || batchMetrics.finished || 0);
  const batchFailed = Number(batchMetrics.failed || 0);

  const automationRunning = Number(automationMetrics.running || 0);
  const automationCompleted = Number(
    automationMetrics.completed || automationMetrics.finished || 0
  );
  const automationFailed = Number(automationMetrics.failed || 0);

  const totalRunning = batchRunning + automationRunning;
  const totalFailed = batchFailed + automationFailed;
  const totalCompleted = batchCompleted + automationCompleted;

  return (
    <section className="panel execution-summary-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Execution layer</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Сводка execution-слоя
          </div>
          <div className="muted">
            Верхнеуровневый мониторинг пакетных исполнений и автоматизаций внутри
            операционного контура.
          </div>
        </div>
      </div>

      <div className="execution-summary-hero">
        <div className="execution-summary-hero-main">
          <div className="execution-summary-hero-label">Пульс execution</div>
          <div className="execution-summary-hero-value">{totalRunning}</div>
          <div className="execution-summary-hero-title">Активных исполнений сейчас</div>
          <div className="execution-summary-hero-subtitle">
            Суммарно запущенные batch-пакеты и automation runs, которые сейчас
            нагружают execution-слой.
          </div>
        </div>

        <div className="execution-summary-hero-side">
          <div className="execution-summary-mini-card tone-success">
            <span>Завершено всего</span>
            <strong>{totalCompleted}</strong>
            <div className="muted small">batch + automation</div>
          </div>

          <div className="execution-summary-mini-card tone-danger">
            <span>Ошибок всего</span>
            <strong>{totalFailed}</strong>
            <div className="muted small">нужен оперативный разбор</div>
          </div>

          <div className="execution-summary-mini-card tone-accent">
            <span>Batch в работе</span>
            <strong>{batchRunning}</strong>
            <div className="muted small">активные пакетные исполнения</div>
          </div>

          <div className="execution-summary-mini-card tone-warning">
            <span>Automation в работе</span>
            <strong>{automationRunning}</strong>
            <div className="muted small">активные автоматизации</div>
          </div>
        </div>
      </div>

      <div className="ops-grid ops-grid-compact" style={{ marginTop: 18 }}>
        <div className="ops-card">
          <div className="ops-card-title">Пакетные исполнения</div>
          <div className="ops-card-value">{stat(batchMetrics.total)}</div>
          <div className="muted small">
            в работе: {stat(batchMetrics.running)} · завершено: {stat(batchCompleted)}
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Автоматизации</div>
          <div className="ops-card-value">{stat(automationMetrics.total)}</div>
          <div className="muted small">
            в работе: {stat(automationMetrics.running)} · завершено:{" "}
            {stat(automationCompleted)}
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Ошибки batch</div>
          <div className="ops-card-value">{stat(batchFailed)}</div>
          <div className="muted small">проблемные пакетные исполнения</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Ошибки automation</div>
          <div className="ops-card-value">{stat(automationFailed)}</div>
          <div className="muted small">требуют контроля и разбора</div>
        </div>
      </div>
    </section>
  );
}
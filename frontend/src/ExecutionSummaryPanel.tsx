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

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Execution overview</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Сводка execution layer
          </div>
          <div className="muted">
            Сводный мониторинг batch jobs и automation runs без ухода в детальный console.
          </div>
        </div>
      </div>

      <div className="ops-grid ops-grid-compact" style={{ marginTop: 16 }}>
        <div className="ops-card">
          <div className="ops-card-title">Batch jobs</div>
          <div className="ops-card-value">{stat(batchMetrics.total)}</div>
          <div className="muted small">
            running: {stat(batchMetrics.running)} · completed: {stat(batchMetrics.completed)}
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Automation runs</div>
          <div className="ops-card-value">{stat(automationMetrics.total)}</div>
          <div className="muted small">
            running: {stat(automationMetrics.running)} · completed:{" "}
            {stat(automationMetrics.completed)}
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Ошибки batch</div>
          <div className="ops-card-value">{stat(batchMetrics.failed)}</div>
          <div className="muted small">Проблемные пакетные исполнения</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Ошибки automation</div>
          <div className="ops-card-value">{stat(automationMetrics.failed)}</div>
          <div className="muted small">Нужен контроль автоматизаций</div>
        </div>
      </div>
    </section>
  );
}
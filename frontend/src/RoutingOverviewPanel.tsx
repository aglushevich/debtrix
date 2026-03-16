type Props = {
  routing?: any;
};

export default function RoutingOverviewPanel({ routing }: Props) {
  const summary = routing?.summary || {};
  const buckets = routing?.buckets || {};

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Routing overview</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Обзор маршрутизации
          </div>
          <div className="muted">
            Куда сейчас распределён портфель и где находятся bottleneck’и.
          </div>
        </div>
      </div>

      <div className="routing-overview-grid" style={{ marginTop: 16 }}>
        <div className="routing-overview-card is-ready">
          <span>Ready</span>
          <strong>{summary?.ready || 0}</strong>
          <div className="muted small">
            {Array.isArray(buckets?.ready) ? buckets.ready.length : 0} карточек в активной работе
          </div>
        </div>

        <div className="routing-overview-card is-waiting">
          <span>Waiting</span>
          <strong>{summary?.waiting || 0}</strong>
          <div className="muted small">Временные окна и ожидание eligible_at</div>
        </div>

        <div className="routing-overview-card is-blocked">
          <span>Blocked</span>
          <strong>{summary?.blocked || 0}</strong>
          <div className="muted small">Требуют данных или снятия blocker’ов</div>
        </div>

        <div className="routing-overview-card is-idle">
          <span>Idle</span>
          <strong>{summary?.idle || 0}</strong>
          <div className="muted small">
            Выпали из playbook-потока или не маршрутизированы
          </div>
        </div>
      </div>
    </section>
  );
}
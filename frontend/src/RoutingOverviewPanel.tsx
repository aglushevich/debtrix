export type RoutingBucketCode = "ready" | "waiting" | "blocked" | "idle";

type Props = {
  routing?: any;
  onOpenBucket?: (bucket: RoutingBucketCode) => void;
};

function laneLabel(code: string) {
  const map: Record<string, string> = {
    soft_lane: "Soft lane",
    court_lane: "Court lane",
    enforcement_lane: "Enforcement lane",
    closed_lane: "Closed lane",
  };
  return map[code] || code;
}

function bucketTitle(code: RoutingBucketCode): string {
  const map: Record<RoutingBucketCode, string> = {
    ready: "Ready",
    waiting: "Waiting",
    blocked: "Blocked",
    idle: "Idle",
  };
  return map[code];
}

export default function RoutingOverviewPanel({ routing, onOpenBucket }: Props) {
  const summary = routing?.summary || {};
  const buckets = routing?.buckets || {};
  const laneSummary = routing?.lane_summary || {};

  function renderBucketCard(
    bucket: RoutingBucketCode,
    value: number,
    hint: string,
    className: string
  ) {
    const content = (
      <>
        <span>{bucketTitle(bucket)}</span>
        <strong>{value}</strong>
        <div className="muted small">{hint}</div>
      </>
    );

    if (!onOpenBucket) {
      return (
        <div className={`routing-overview-card ${className}`} key={bucket}>
          {content}
        </div>
      );
    }

    return (
      <button
        type="button"
        key={bucket}
        className={`routing-overview-card ${className}`}
        onClick={() => onOpenBucket(bucket)}
        style={{ textAlign: "left", cursor: "pointer" }}
      >
        {content}
      </button>
    );
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Routing overview</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Обзор маршрутизации
          </div>
          <div className="muted">
            Куда распределён портфель сейчас, где есть рабочая ёмкость и где
            образуются bottleneck’и.
          </div>
        </div>
      </div>

      <div className="routing-overview-grid" style={{ marginTop: 16 }}>
        {renderBucketCard(
          "ready",
          Number(summary?.ready || 0),
          `${
            Array.isArray(buckets?.ready) ? buckets.ready.length : 0
          } кейсов можно брать в работу сейчас`,
          "is-ready"
        )}

        {renderBucketCard(
          "waiting",
          Number(summary?.waiting || 0),
          "Кейсы ждут eligible window или следующего допустимого шага",
          "is-waiting"
        )}

        {renderBucketCard(
          "blocked",
          Number(summary?.blocked || 0),
          "Нужны данные, исправления или снятие blocker’ов",
          "is-blocked"
        )}

        {renderBucketCard(
          "idle",
          Number(summary?.idle || 0),
          "Кейсы выпали из стандартного playbook-потока и требуют разбора",
          "is-idle"
        )}
      </div>

      <div className="portfolio-mini-stats" style={{ marginTop: 18 }}>
        {Object.entries(laneSummary || {}).map(([key, value]) => (
          <div className="portfolio-mini-stat" key={key}>
            <span>{laneLabel(key)}</span>
            <strong>{Number(value || 0)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

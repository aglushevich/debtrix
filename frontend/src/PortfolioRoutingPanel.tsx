import { useEffect, useState } from "react";
import { getPortfolioRouting, PortfolioRoutingBucket } from "./api";

export default function PortfolioRoutingPanel() {
  const [buckets, setBuckets] = useState<PortfolioRoutingBucket[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await getPortfolioRouting();
      setBuckets(res.buckets || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="panel">
      <div className="panel-title">Portfolio routing</div>

      {loading && <div className="empty-box">Загрузка routing…</div>}

      {!loading && (
        <div className="ops-grid">
          {buckets.map((b) => (
            <div className="ops-card" key={b.key}>
              <div className="ops-card-title">{b.title}</div>
              <div className="ops-card-value">{b.count}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
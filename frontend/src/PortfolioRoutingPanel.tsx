import { useEffect, useState } from "react";
import { getPortfolioRouting } from "./api";

type RoutingBucketItem = {
  case_id: number;
  debtor_name?: string;
  contract_type?: string;
  debtor_type?: string;
  status?: string;
  routing_status?: string;
  is_archived?: boolean;
};

type RoutingResponse = {
  summary?: {
    total?: number;
    ready?: number;
    waiting?: number;
    blocked?: number;
    idle?: number;
  };
  buckets?: {
    ready?: RoutingBucketItem[];
    waiting?: RoutingBucketItem[];
    blocked?: RoutingBucketItem[];
    idle?: RoutingBucketItem[];
  };
};

export default function PortfolioRoutingPanel() {
  const [data, setData] = useState<RoutingResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await getPortfolioRouting();
      setData((res || {}) as RoutingResponse);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary || {};
  const buckets = data?.buckets || {};

  const readyItems = Array.isArray(buckets.ready) ? buckets.ready : [];
  const waitingItems = Array.isArray(buckets.waiting) ? buckets.waiting : [];
  const blockedItems = Array.isArray(buckets.blocked) ? buckets.blocked : [];
  const idleItems = Array.isArray(buckets.idle) ? buckets.idle : [];

  return (
    <section className="panel">
      <div className="panel-title">Portfolio routing</div>

      {loading && <div className="empty-box">Загрузка routing…</div>}

      {!loading && (
        <>
          <div className="ops-grid">
            <div className="ops-card">
              <div className="ops-card-title">Всего</div>
              <div className="ops-card-value">{summary.total || 0}</div>
            </div>

            <div className="ops-card ops-card-accent">
              <div className="ops-card-title">Ready</div>
              <div className="ops-card-value">{summary.ready || 0}</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Waiting</div>
              <div className="ops-card-value">{summary.waiting || 0}</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Blocked</div>
              <div className="ops-card-value">{summary.blocked || 0}</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Idle</div>
              <div className="ops-card-value">{summary.idle || 0}</div>
            </div>
          </div>

          <div className="dashboard-grid" style={{ marginTop: 18 }}>
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="panel-title">Ready cases</div>
              {readyItems.length ? (
                <div className="participants-list">
                  {readyItems.slice(0, 8).map((item) => (
                    <div className="participant-card" key={`ready-${item.case_id}`}>
                      <div className="participant-role">Дело #{item.case_id}</div>
                      <div className="participant-name">{item.debtor_name || "—"}</div>
                      <div className="muted small">
                        {item.contract_type || "—"} · {item.status || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Ready-кейсов сейчас нет.</div>
              )}
            </div>

            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="panel-title">Blocked / Waiting / Idle</div>

              <div className="ops-hints-list">
                <div className="ops-hint-card">
                  <strong>Waiting</strong>
                  <div className="muted small">{waitingItems.length} дел</div>
                </div>

                <div className="ops-hint-card">
                  <strong>Blocked</strong>
                  <div className="muted small">{blockedItems.length} дел</div>
                </div>

                <div className="ops-hint-card">
                  <strong>Idle</strong>
                  <div className="muted small">{idleItems.length} дел</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
import { useEffect, useState } from "react";
import { getDebtMap } from "./api";

type Props = {
  caseId: number | null;
  onOpenCase?: (caseId: number) => void;
};

function renderValue(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "—";
    }
  }
  return String(value);
}

export default function DebtMapPanel({ caseId, onOpenCase }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!caseId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await getDebtMap(caseId);
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить debt map");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [caseId]);

  if (!caseId) return null;

  const nodes = data?.nodes || data?.graph?.nodes || [];
  const edges = data?.edges || data?.graph?.edges || [];
  const autoLinks = data?.auto_links || [];
  const relatedCases = data?.related_cases || [];

  return (
    <section className="panel">
      <div className="panel-title">Debt Map</div>

      {loading && <div className="empty-box">Загрузка debt map…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && (
        <>
          <div className="debtor-cases-summary" style={{ marginBottom: 16 }}>
            <div className="summary-card">
              <span className="label">Nodes</span>
              <strong>{nodes.length}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Edges</span>
              <strong>{edges.length}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Auto links</span>
              <strong>{autoLinks.length}</strong>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel-title">Узлы</div>

              {nodes.length ? (
                <div className="participants-list">
                  {nodes.map((node: any) => (
                    <div className="participant-card" key={node.id}>
                      <div className="participant-role">{node.type || "node"}</div>
                      <div className="participant-name">{node.title || node.id}</div>
                      <div className="muted small">{node.subtitle || "—"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Узлы пока не сформированы.</div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">Связи</div>

              {edges.length ? (
                <div className="participants-list">
                  {edges.map((edge: any, index: number) => (
                    <div className="participant-card" key={`${edge.source}-${edge.target}-${index}`}>
                      <div className="participant-name">
                        {edge.source} → {edge.target}
                      </div>
                      <div className="muted small">
                        {edge.label || edge.kind || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Связи пока не сформированы.</div>
              )}
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel-title">Auto links</div>

              {autoLinks.length ? (
                <div className="participants-list">
                  {autoLinks.map((item: any, index: number) => (
                    <div className="participant-card" key={`${item.type}-${item.value}-${index}`}>
                      <div className="participant-card-top">
                        <div>
                          <div className="participant-role">{item.type || "link"}</div>
                          <div className="participant-name">{item.label || item.value}</div>
                        </div>
                      </div>

                      <div className="participant-meta-grid">
                        <div className="info-item">
                          <span className="label">Value</span>
                          <strong>{item.value || "—"}</strong>
                        </div>

                        <div className="info-item">
                          <span className="label">From</span>
                          <strong>{item.from?.title || item.from?.node_id || "—"}</strong>
                        </div>

                        <div className="info-item">
                          <span className="label">To</span>
                          <strong>{item.to?.title || item.to?.node_id || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Auto links пока не найдены.</div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">Связанные дела</div>

              {relatedCases.length ? (
                <div className="related-cases-list">
                  {relatedCases.map((item: any) => (
                    <button
                      key={item.case_id}
                      className={`related-case-card ${item.is_current ? "is-current" : ""}`}
                      onClick={() => onOpenCase?.(item.case_id)}
                    >
                      <div className="related-case-top">
                        <strong>Дело #{item.case_id}</strong>
                        <span className="status-badge status-ready">
                          {item.status || "—"}
                        </span>
                      </div>

                      <div className="muted">
                        {item.contract_type || "—"} · {item.principal_amount || "—"} ₽
                      </div>

                      <div className="muted small">
                        due: {item.due_date || "—"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Связанных дел пока нет.</div>
              )}
            </div>
          </div>

          {data && (
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="panel-title">Raw debt map payload</div>
              <div className="info-item info-item-wide">
                <strong className="code-block">{renderValue(data)}</strong>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
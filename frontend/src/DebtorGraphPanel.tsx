import { useEffect, useState } from "react";
import { getDebtorGraph } from "./api";

type Props = {
  caseId: number | null;
  onOpenCase?: (caseId: number) => void;
};

export default function DebtorGraphPanel({ caseId, onOpenCase }: Props) {
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
      const result = await getDebtorGraph(caseId);
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить debtor graph");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [caseId]);

  if (!caseId) return null;

  const nodes = data?.graph?.nodes || [];
  const edges = data?.graph?.edges || [];
  const autoLinks = data?.auto_links || [];
  const relatedCases = data?.related_cases || [];
  const summary = data?.summary || {};

  return (
    <section className="panel">
      <div className="panel-title">Debtor Graph</div>

      {loading && <div className="empty-box">Загрузка debtor graph…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="debtor-cases-summary" style={{ marginBottom: 16 }}>
            <div className="summary-card">
              <span className="label">Cases</span>
              <strong>{summary?.cases_count ?? relatedCases.length}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Participants</span>
              <strong>{summary?.participants_count ?? "—"}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Risk</span>
              <strong>
                {summary?.risk_level || "—"} / {summary?.risk_score ?? "—"}
              </strong>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel-title">Debtor</div>

              <div className="info-grid">
                <div className="info-item info-item-wide">
                  <span className="label">Name</span>
                  <strong>{data?.debtor?.name || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Тип</span>
                  <strong>{data?.debtor?.debtor_type || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">ИНН</span>
                  <strong>{data?.debtor?.inn || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">ОГРН</span>
                  <strong>{data?.debtor?.ogrn || "—"}</strong>
                </div>

                <div className="info-item info-item-wide">
                  <span className="label">Адрес</span>
                  <strong>{data?.debtor?.address || "—"}</strong>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Signals</div>

              {summary?.signals?.length ? (
                <div className="participants-list">
                  {summary.signals.map((item: string, index: number) => (
                    <div className="participant-card" key={`${item}-${index}`}>
                      <div className="participant-name">{item}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Сигналов пока нет.</div>
              )}
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel-title">Graph nodes</div>

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
                <div className="empty-box">Узлы графа пока пусты.</div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">Graph edges</div>

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
                <div className="empty-box">Связи графа пока пусты.</div>
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
                      <div className="participant-role">{item.type || "link"}</div>
                      <div className="participant-name">{item.label || item.value}</div>
                      <div className="muted small">
                        {item.from?.title || item.from?.node_id || "—"} →{" "}
                        {item.to?.title || item.to?.node_id || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Auto links пока отсутствуют.</div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">Related cases</div>

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
                <div className="empty-box">Связанных дел не найдено.</div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
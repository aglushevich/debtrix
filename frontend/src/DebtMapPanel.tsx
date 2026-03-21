import { useEffect, useMemo, useState } from "react";
import { getDebtMap } from "./api";
import { formatCaseStatus } from "./legalLabels";

type Props = {
  caseId: number | null;
  onOpenCase?: (caseId: number) => void;
};

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return String(value ?? "—");

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeStatusClass(status?: string) {
  return `status-badge status-${String(status || "draft")}`;
}

function summaryLabel(key: string) {
  const map: Record<string, string> = {
    nodes_count: "Количество узлов",
    edges_count: "Количество связей",
    auto_links_count: "Автосвязки",
    related_cases_count: "Связанные дела",
    total_amount: "Общая сумма",
  };

  return map[key] || key;
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
      setData(result || null);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить debt map.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  const nodes = useMemo(() => data?.nodes || data?.graph?.nodes || [], [data]);
  const edges = useMemo(() => data?.edges || data?.graph?.edges || [], [data]);
  const autoLinks = useMemo(() => data?.auto_links || [], [data]);
  const relatedCases = useMemo(() => data?.related_cases || [], [data]);
  const summary = data?.summary || null;

  if (!caseId) return null;

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Debt structure</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Debt Map
          </div>
          <div className="muted">
            Карта структуры долга, автосвязки и связанные кейсы по текущему делу.
          </div>
        </div>

        <div className="action-list">
          <button className="secondary-btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

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

            <div className="summary-card">
              <span className="label">Связанных дел</span>
              <strong>{relatedCases.length}</strong>
            </div>
          </div>

          {summary && (
            <div className="panel panel-nested" style={{ marginBottom: 16 }}>
              <div className="panel-title" style={{ marginBottom: 10 }}>
                Краткая сводка
              </div>

              <div className="info-grid">
                {Object.entries(summary).map(([key, value]) => (
                  <div className="info-item" key={key}>
                    <span className="label">{summaryLabel(key)}</span>
                    <strong>
                      {String(key).includes("amount")
                        ? `${formatMoney(value)} ₽`
                        : String(value ?? "—")}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-grid dashboard-grid-secondary">
            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Узлы</div>

              {nodes.length ? (
                <div className="participants-list">
                  {nodes.map((node: any) => (
                    <div className="participant-card" key={node.id}>
                      <div className="participant-card-top">
                        <div>
                          <div className="participant-role">{node.type || "node"}</div>
                          <div className="participant-name">{node.title || node.id}</div>
                        </div>

                        {node.is_current && (
                          <div className="participant-badges">
                            <span className="status-badge status-ready">Текущий</span>
                          </div>
                        )}
                      </div>

                      <div className="participant-meta-grid">
                        <div className="info-item info-item-wide">
                          <span className="label">Описание</span>
                          <strong>{node.subtitle || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Узлы пока не сформированы.</div>
              )}
            </div>

            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Связи</div>

              {edges.length ? (
                <div className="participants-list">
                  {edges.map((edge: any, index: number) => (
                    <div className="participant-card" key={`${edge.source}-${edge.target}-${index}`}>
                      <div className="participant-card-top">
                        <div>
                          <div className="participant-role">{edge.kind || "edge"}</div>
                          <div className="participant-name">
                            {edge.source} → {edge.target}
                          </div>
                        </div>
                      </div>

                      <div className="participant-meta-grid">
                        <div className="info-item info-item-wide">
                          <span className="label">Описание</span>
                          <strong>{edge.label || edge.kind || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Связи пока не сформированы.</div>
              )}
            </div>
          </div>

          <div className="dashboard-grid dashboard-grid-secondary" style={{ marginTop: 16 }}>
            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Auto links</div>

              {autoLinks.length ? (
                <div className="participants-list">
                  {autoLinks.map((item: any, index: number) => (
                    <div className="participant-card" key={`${item.type}-${item.value}-${index}`}>
                      <div className="participant-card-top">
                        <div>
                          <div className="participant-role">{item.type || "link"}</div>
                          <div className="participant-name">
                            {item.label || item.value || "—"}
                          </div>
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

            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
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
                        <span className={safeStatusClass(item.status)}>
                          {formatCaseStatus(item.status)}
                        </span>
                      </div>

                      <div className="muted">
                        {item.contract_type || "—"} ·{" "}
                        {item.principal_amount != null
                          ? `${formatMoney(item.principal_amount)} ₽`
                          : "—"}
                      </div>

                      <div className="muted small">
                        Срок оплаты: {item.due_date || "—"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Связанных дел пока нет.</div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
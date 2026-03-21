import { useEffect, useMemo, useState } from "react";
import { getDebtorGraph } from "./api";
import { formatCaseStatus, formatDebtorType } from "./legalLabels";

type Props = {
  caseId: number | null;
  onOpenCase?: (caseId: number) => void;
};

function riskLabel(level?: string) {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return map[level || ""] || level || "—";
}

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
      setData(result || null);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить debtor graph.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  const nodes = useMemo(() => data?.graph?.nodes || [], [data]);
  const edges = useMemo(() => data?.graph?.edges || [], [data]);
  const autoLinks = useMemo(() => data?.auto_links || [], [data]);
  const relatedCases = useMemo(() => data?.related_cases || [], [data]);
  const summary = data?.summary || {};
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const signals = Array.isArray(data?.signals) ? data.signals : summary?.signals || [];

  if (!caseId) return null;

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Debtor intelligence</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Debtor Graph
          </div>
          <div className="muted">
            Intelligence-срез по должнику: связи, сигналы, риски и связанные кейсы.
          </div>
        </div>

        <div className="action-list">
          <button className="secondary-btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

      {loading && <div className="empty-box">Загрузка debtor graph…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="debtor-cases-summary" style={{ marginBottom: 16 }}>
            <div className="summary-card">
              <span className="label">Связанных дел</span>
              <strong>{summary?.cases_count ?? relatedCases.length}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Участников</span>
              <strong>{summary?.participants_count ?? "—"}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Auto links</span>
              <strong>{summary?.auto_links_count ?? autoLinks.length}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Риск</span>
              <strong>
                {riskLabel(summary?.risk_level)} / {summary?.risk_score ?? "—"}
              </strong>
            </div>
          </div>

          <div className="dashboard-grid dashboard-grid-secondary">
            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Карточка должника</div>

              <div className="info-grid">
                <div className="info-item info-item-wide">
                  <span className="label">Наименование</span>
                  <strong>{data?.debtor?.name || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Тип</span>
                  <strong>{formatDebtorType(data?.debtor?.debtor_type)}</strong>
                </div>

                <div className="info-item">
                  <span className="label">ИНН</span>
                  <strong>{data?.debtor?.inn || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">ОГРН</span>
                  <strong>{data?.debtor?.ogrn || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Руководитель</span>
                  <strong>{data?.debtor?.director_name || "—"}</strong>
                </div>

                <div className="info-item info-item-wide">
                  <span className="label">Адрес</span>
                  <strong>{data?.debtor?.address || "—"}</strong>
                </div>
              </div>
            </div>

            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Сигналы</div>

              {signals.length ? (
                <div className="participants-list">
                  {signals.map((item: string, index: number) => (
                    <div className="participant-card" key={`${item}-${index}`}>
                      <div className="participant-card-top">
                        <div>
                          <div className="participant-role">Signal</div>
                          <div className="participant-name">{item}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Сигналов пока нет.</div>
              )}
            </div>
          </div>

          <div className="dashboard-grid dashboard-grid-secondary" style={{ marginTop: 16 }}>
            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Graph nodes</div>

              {nodes.length ? (
                <div className="participants-list">
                  {nodes.map((node: any) => (
                    <div className="participant-card" key={node.id}>
                      <div className="participant-card-top">
                        <div>
                          <div className="participant-role">{node.type || "node"}</div>
                          <div className="participant-name">{node.title || node.id}</div>
                        </div>
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
                <div className="empty-box">Узлы графа пока пусты.</div>
              )}
            </div>

            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Graph edges</div>

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
                <div className="empty-box">Связи графа пока пусты.</div>
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
                          <div className="participant-name">{item.label || item.value || "—"}</div>
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
                <div className="empty-box">Auto links пока отсутствуют.</div>
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
                <div className="empty-box">Связанных дел не найдено.</div>
              )}
            </div>
          </div>

          <section className="panel panel-nested" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="panel-title">Рекомендации intelligence engine</div>

            {recommendations.length ? (
              <div className="participants-list">
                {recommendations.map((item: string, index: number) => (
                  <div className="participant-card" key={`${item}-${index}`}>
                    <div className="participant-card-top">
                      <div>
                        <div className="participant-role">Recommendation</div>
                        <div className="participant-name">{item}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-box">Рекомендаций пока нет.</div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

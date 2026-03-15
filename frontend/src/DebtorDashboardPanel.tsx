import { useEffect, useState } from "react";
import { getDebtorDashboard } from "./api";

type Props = {
  debtorId: number | null;
  onOpenCase?: (caseId: number) => void;
};

export default function DebtorDashboardPanel({ debtorId, onOpenCase }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!debtorId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await getDebtorDashboard(debtorId);
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить debtor dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [debtorId]);

  if (!debtorId) return null;

  const cases = data?.cases || [];
  const summary = data?.summary || {};
  const debtor = data?.debtor || {};

  return (
    <section className="panel">
      <div className="panel-title">Debtor Dashboard</div>

      {loading && <div className="empty-box">Загрузка debtor dashboard…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="debtor-cases-summary" style={{ marginBottom: 16 }}>
            <div className="summary-card">
              <span className="label">Дел</span>
              <strong>{summary?.cases_count ?? cases.length}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Активных</span>
              <strong>{summary?.active_cases_count ?? "—"}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Общая сумма</span>
              <strong>{summary?.total_principal_amount ?? "—"} ₽</strong>
            </div>
          </div>

          <div className="info-grid" style={{ marginBottom: 16 }}>
            <div className="info-item info-item-wide">
              <span className="label">Должник</span>
              <strong>{debtor?.name || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">Тип</span>
              <strong>{debtor?.debtor_type || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">ИНН</span>
              <strong>{debtor?.inn || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">ОГРН</span>
              <strong>{debtor?.ogrn || "—"}</strong>
            </div>

            <div className="info-item info-item-wide">
              <span className="label">Адрес</span>
              <strong>{debtor?.address || "—"}</strong>
            </div>
          </div>

          {cases.length ? (
            <div className="related-cases-list">
              {cases.map((item: any) => (
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
            <div className="empty-box">По должнику пока нет связанных дел.</div>
          )}
        </>
      )}
    </section>
  );
}
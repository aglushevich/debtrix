import { useEffect, useState } from "react";
import { getOrganizationStarterKit } from "./api";

type Props = {
  caseId: number | null;
  onOpenCase?: (caseId: number) => void;
};

function readinessLabel(level?: string) {
  const map: Record<string, string> = {
    ready: "Готово",
    partial: "Частично готово",
    missing: "Недостаточно данных",
  };
  return map[level || ""] || level || "—";
}

export default function OrganizationPanel({ caseId, onOpenCase }: Props) {
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
      const result = await getOrganizationStarterKit(caseId);
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить organization starter kit");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [caseId]);

  if (!caseId) return null;

  return (
    <section className="panel">
      <div className="panel-title">Organization Starter Kit</div>

      {loading && <div className="empty-box">Загрузка starter kit…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="debtor-cases-summary" style={{ marginBottom: 16 }}>
            <div className="summary-card">
              <span className="label">Готовность</span>
              <strong>{readinessLabel(data?.readiness?.level)}</strong>
            </div>

            <div className="summary-card">
              <span className="label">Completion</span>
              <strong>{data?.summary?.completion_percent ?? "—"}%</strong>
            </div>

            <div className="summary-card">
              <span className="label">Readiness score</span>
              <strong>{data?.summary?.readiness_score ?? "—"}</strong>
            </div>
          </div>

          <div className="info-grid" style={{ marginBottom: 16 }}>
            <div className="info-item info-item-wide">
              <span className="label">Организация</span>
              <strong>{data?.organization?.name_full || data?.organization?.name || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">ИНН</span>
              <strong>{data?.organization?.inn || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">ОГРН</span>
              <strong>{data?.organization?.ogrn || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">КПП</span>
              <strong>{data?.organization?.kpp || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">Директор</span>
              <strong>{data?.organization?.director_name || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">Статус</span>
              <strong>{data?.organization?.status || "—"}</strong>
            </div>

            <div className="info-item info-item-wide">
              <span className="label">Адрес</span>
              <strong>{data?.organization?.address || "—"}</strong>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel-title">Проверки готовности</div>

              {data?.readiness?.checks?.length ? (
                <div className="participants-list">
                  {data.readiness.checks.map((item: any, index: number) => (
                    <div className="participant-card" key={`${item.code || index}`}>
                      <div className="participant-card-top">
                        <div>
                          <div className="participant-role">{item.code || "check"}</div>
                          <div className="participant-name">{item.label || "—"}</div>
                        </div>

                        <div className="participant-badges">
                          <span
                            className={`status-badge ${
                              item.ok ? "status-ready" : "status-not-ready"
                            }`}
                          >
                            {item.ok ? "OK" : "Нет"}
                          </span>
                        </div>
                      </div>

                      <div className="participant-meta-grid">
                        <div className="info-item">
                          <span className="label">Значение</span>
                          <strong>{item.value || "—"}</strong>
                        </div>

                        <div className="info-item info-item-wide">
                          <span className="label">Подсказка</span>
                          <strong>{item.hint || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Проверки пока не сформированы.</div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">Связанные дела</div>

              {data?.linked_cases?.length ? (
                <div className="related-cases-list">
                  {data.linked_cases.map((item: any) => (
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
                        {item.debtor_name || "—"}
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
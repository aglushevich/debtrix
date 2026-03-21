import { useEffect, useMemo, useState } from "react";
import { getOrganizationStarterKit } from "./api";
import { formatCaseStatus } from "./legalLabels";

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

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return String(value ?? "—");

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeStatusClass(status?: string, isCurrent?: boolean) {
  if (isCurrent) return "status-badge status-ready";
  return `status-badge status-${String(status || "draft")}`;
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
      setData(result || null);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить organization starter kit.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  const missingFields = useMemo(() => {
    return Array.isArray(data?.readiness?.missing_fields) ? data.readiness.missing_fields : [];
  }, [data]);

  if (!caseId) return null;

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Organization layer</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Organization Starter Kit
          </div>
          <div className="muted">
            Готовность профиля организации, readiness checks и связанные кейсы по должнику.
          </div>
        </div>

        <div className="action-list">
          <button className="secondary-btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

      {loading && <div className="empty-box">Загрузка starter kit…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="ops-grid ops-grid-compact" style={{ marginBottom: 16 }}>
            <div className="ops-card ops-card-accent">
              <div className="ops-card-title">Готовность</div>
              <div className="ops-card-value">{readinessLabel(data?.readiness?.level)}</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Completion</div>
              <div className="ops-card-value">{data?.summary?.completion_percent ?? "—"}%</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Readiness score</div>
              <div className="ops-card-value">{data?.summary?.readiness_score ?? "—"}</div>
            </div>

            <div className="ops-card">
              <div className="ops-card-title">Missing fields</div>
              <div className="ops-card-value">{missingFields.length}</div>
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

            <div className="info-item">
              <span className="label">Регистрация</span>
              <strong>{data?.organization?.registration_date || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">ОКВЭД</span>
              <strong>{data?.organization?.okved_main || "—"}</strong>
            </div>

            <div className="info-item info-item-wide">
              <span className="label">Адрес</span>
              <strong>{data?.organization?.address || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">Источник</span>
              <strong>{data?.organization?.source || "—"}</strong>
            </div>

            <div className="info-item">
              <span className="label">Активна</span>
              <strong>{data?.organization?.is_active ? "Да" : "Нет / неизвестно"}</strong>
            </div>
          </div>

          {!!missingFields.length && (
            <div className="panel panel-nested" style={{ marginBottom: 16 }}>
              <div className="panel-title" style={{ marginBottom: 10 }}>
                Недостающие поля
              </div>

              <div className="action-list" style={{ flexWrap: "wrap" }}>
                {missingFields.map((field: string, index: number) => (
                  <span key={`${field}-${index}`} className="status-badge status-not-ready">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-grid dashboard-grid-secondary">
            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
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

            <div className="panel panel-nested" style={{ marginBottom: 0 }}>
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
                        <span className={safeStatusClass(item.status, item.is_current)}>
                          {formatCaseStatus(item.status)}
                        </span>
                      </div>

                      <div className="muted">
                        {item.contract_type || "—"} ·{" "}
                        {item.principal_amount != null
                          ? `${formatMoney(item.principal_amount)} ₽`
                          : "—"}
                      </div>

                      <div className="muted small">{item.debtor_name || "—"}</div>
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
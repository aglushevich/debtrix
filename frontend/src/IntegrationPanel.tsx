import { useEffect, useMemo, useState } from "react";
import {
  CaseIntegrationItem,
  checkFsspIntegration,
  getCaseIntegrations,
  syncFnsIntegration,
} from "./api";

type Props = {
  caseId: number | null;
};

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    idle: "Не запускалось",
    synced: "Синхронизировано",
    checked: "Проверено",
    error: "Ошибка",
    not_connected: "Не подключено",
    connected: "Подключено",
    authorized: "Авторизовано",
    pending: "В ожидании",
  };

  return map[String(status || "")] || status || "—";
}

function statusClass(status?: string) {
  const map: Record<string, string> = {
    idle: "status-draft",
    synced: "status-ready",
    checked: "status-ready",
    error: "status-overdue",
    not_connected: "status-not-ready",
    connected: "status-pretrial",
    authorized: "status-ready",
    pending: "status-waiting",
  };

  return map[String(status || "")] || "status-draft";
}

function providerLabel(provider?: string) {
  const map: Record<string, string> = {
    fns: "ФНС",
    fssp: "ФССП",
    esia: "ЕСИА",
  };

  return map[String(provider || "")] || provider || "—";
}

function modeLabel(mode?: string | null) {
  const map: Record<string, string> = {
    manual: "Ручной режим",
    sync: "Синхронизация",
    external_auth: "Внешняя авторизация",
    polling: "Периодическая проверка",
  };

  return map[String(mode || "")] || mode || "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU");
}

function stringifyData(data?: Record<string, any> | null) {
  if (!data || !Object.keys(data).length) return "—";

  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return "—";
  }
}

function integrationHealthTitle(item?: CaseIntegrationItem) {
  const status = String(item?.status || "");

  if (["synced", "checked", "authorized", "connected"].includes(status)) {
    return "Стабильное состояние";
  }

  if (status === "error") {
    return "Нужен разбор";
  }

  if (["idle", "pending", "not_connected"].includes(status)) {
    return "Требует внимания";
  }

  return "Промежуточное состояние";
}

export default function IntegrationPanel({ caseId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    if (!caseId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await getCaseIntegrations(caseId);
      setData(result || null);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить интеграции");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [caseId]);

  async function handleFnsSync() {
    if (!caseId) return;

    try {
      setBusy("fns");
      setError("");
      await syncFnsIntegration(caseId);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Не удалось синхронизировать ФНС");
    } finally {
      setBusy("");
    }
  }

  async function handleFsspCheck() {
    if (!caseId) return;

    try {
      setBusy("fssp");
      setError("");
      await checkFsspIntegration(caseId);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Не удалось проверить ФССП");
    } finally {
      setBusy("");
    }
  }

  const providerEntries: [string, CaseIntegrationItem][] = useMemo(() => {
    return Object.entries(data?.providers || {});
  }, [data]);

  const summary = useMemo(() => {
    const items = providerEntries.map(([, item]) => item);

    return {
      total: items.length,
      healthy: items.filter((item) =>
        ["synced", "checked", "authorized", "connected"].includes(String(item?.status || ""))
      ).length,
      errors: items.filter((item) => String(item?.status || "") === "error").length,
      pending: items.filter((item) =>
        ["idle", "pending", "not_connected"].includes(String(item?.status || ""))
      ).length,
    };
  }, [providerEntries]);

  if (!caseId) return null;

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Provider connections</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Интеграции
          </div>
          <div className="muted">
            Состояние подключений по делу: синхронизация, проверка провайдеров и технический статус.
          </div>
        </div>
      </div>

      <div className="ops-grid ops-grid-compact" style={{ marginBottom: 16 }}>
        <div className="ops-card ops-card-accent">
          <div className="ops-card-title">Всего провайдеров</div>
          <div className="ops-card-value">{summary.total}</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Стабильные</div>
          <div className="ops-card-value">{summary.healthy}</div>
          <div className="muted small">synced / checked / authorized</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Ошибки</div>
          <div className="ops-card-value">{summary.errors}</div>
          <div className="muted small">нужен технический разбор</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Требуют внимания</div>
          <div className="ops-card-value">{summary.pending}</div>
          <div className="muted small">idle / pending / not_connected</div>
        </div>
      </div>

      <div className="action-list" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <button
          className="secondary-btn"
          onClick={handleFnsSync}
          disabled={busy === "fns"}
        >
          {busy === "fns" ? "Синхронизация…" : "Синхронизировать ФНС"}
        </button>

        <button
          className="secondary-btn"
          onClick={handleFsspCheck}
          disabled={busy === "fssp"}
        >
          {busy === "fssp" ? "Проверка…" : "Проверить ФССП"}
        </button>

        <button
          className="secondary-btn"
          onClick={() => void loadData()}
          disabled={loading}
        >
          {loading ? "Обновляем…" : "Обновить статус"}
        </button>
      </div>

      {loading && <div className="empty-box">Загрузка интеграций…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && (
        <>
          {providerEntries.length ? (
            <div className="participants-list">
              {providerEntries.map(([key, item]) => (
                <div className="participant-card" key={key}>
                  <div className="participant-card-top">
                    <div>
                      <div className="participant-role">
                        {providerLabel(item.provider || key)}
                      </div>
                      <div className="participant-name">{statusLabel(item.status)}</div>
                    </div>

                    <div className="participant-badges">
                      <span className={`status-badge ${statusClass(item.status)}`}>
                        {modeLabel(item.mode)}
                      </span>
                    </div>
                  </div>

                  <div className="muted small" style={{ marginTop: 8 }}>
                    {integrationHealthTitle(item)}
                  </div>

                  <div className="participant-meta-grid">
                    <div className="info-item">
                      <span className="label">Внешний ID</span>
                      <strong>{item.external_id || "—"}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Последняя синхронизация</span>
                      <strong>{formatDate(item.last_synced_at)}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Обновлено</span>
                      <strong>{formatDate(item.updated_at)}</strong>
                    </div>

                    <div className="info-item">
                      <span className="label">Создано</span>
                      <strong>{formatDate(item.created_at)}</strong>
                    </div>

                    <div className="info-item info-item-wide">
                      <span className="label">Последняя ошибка</span>
                      <strong>{item.last_error || "—"}</strong>
                    </div>

                    <div className="info-item info-item-wide">
                      <span className="label">Технические данные</span>
                      <strong className="code-block">{stringifyData(item.data)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box">
              Интеграции по делу пока не зафиксированы.
            </div>
          )}
        </>
      )}
    </section>
  );
}
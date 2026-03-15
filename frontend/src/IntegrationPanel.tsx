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
  };
  return map[status || ""] || status || "—";
}

function providerLabel(provider?: string) {
  const map: Record<string, string> = {
    fns: "ФНС",
    fssp: "ФССП",
    esia: "ЕСИА",
  };
  return map[provider || ""] || provider || "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return value;
}

function stringifyData(data?: Record<string, any> | null) {
  if (!data || !Object.keys(data).length) return "—";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return "—";
  }
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
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить интеграции");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
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

  if (!caseId) return null;

  return (
    <section className="panel">
      <div className="panel-title">Интеграции</div>

      <div className="debtor-cases-summary" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <span className="label">ФНС</span>
          <strong>{statusLabel(data?.providers?.fns?.status)}</strong>
        </div>

        <div className="summary-card">
          <span className="label">ФССП</span>
          <strong>{statusLabel(data?.providers?.fssp?.status)}</strong>
        </div>

        <div className="summary-card">
          <span className="label">ЕСИА</span>
          <strong>{statusLabel(data?.providers?.esia?.status)}</strong>
        </div>
      </div>

      <div className="action-list" style={{ marginBottom: 16 }}>
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
                        {providerLabel(item.provider)}
                      </div>
                      <div className="participant-name">
                        {statusLabel(item.status)}
                      </div>
                    </div>

                    <div className="participant-badges">
                      <span className="status-badge status-ready">
                        {item.mode || "—"}
                      </span>
                    </div>
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

                    <div className="info-item info-item-wide">
                      <span className="label">Ошибка</span>
                      <strong>{item.last_error || "—"}</strong>
                    </div>

                    <div className="info-item info-item-wide">
                      <span className="label">Технические данные</span>
                      <strong style={{ whiteSpace: "pre-wrap" }}>
                        {stringifyData(item.data)}
                      </strong>
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
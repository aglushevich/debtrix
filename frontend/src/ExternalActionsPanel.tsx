import { useEffect, useMemo, useState } from "react";
import {
  authorizeEsiaSession,
  dispatchExternalAction,
  getExternalActions,
  prepareExternalAction,
  startEsiaSession,
} from "./api";

type Props = {
  caseId: number | null;
};

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    pending_auth: "Ждёт ЕСИА",
    authorized: "ЕСИА подтверждена",
    prepared: "Подготовлено",
    sent: "Отправлено",
    failed: "Ошибка",
    expired: "Истекло",
    cancelled: "Отменено",
  };

  return map[String(status || "")] || status || "—";
}

function actionLabel(code?: string) {
  const map: Record<string, string> = {
    send_to_fssp: "Отправка в ФССП",
    send_russian_post_letter: "Письмо через Почту России",
    submit_to_court: "Подача в суд",
  };

  return map[String(code || "")] || code || "—";
}

function providerLabel(provider?: string) {
  const map: Record<string, string> = {
    fssp: "ФССП",
    russian_post: "Почта России",
    court: "Суд",
  };

  return map[String(provider || "")] || provider || "—";
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

function statusClass(status?: string) {
  const map: Record<string, string> = {
    pending_auth: "status-waiting",
    authorized: "status-ready",
    prepared: "status-pretrial",
    sent: "status-ready",
    failed: "status-overdue",
    expired: "status-not-ready",
    cancelled: "status-not-ready",
  };

  return map[String(status || "")] || "status-draft";
}

function actionFlowHint(item: any): string {
  const status = String(item?.status || "");

  if (status === "pending_auth") {
    return "Сначала пользователь должен пройти внешний auth flow.";
  }

  if (status === "authorized") {
    return "Авторизация подтверждена. Можно отправлять во внешний канал.";
  }

  if (status === "prepared") {
    return "Действие подготовлено и ждёт отправки.";
  }

  if (status === "sent") {
    return "Внешняя отправка уже выполнена.";
  }

  if (status === "failed") {
    return "В цепочке внешнего исполнения возникла ошибка.";
  }

  return item?.description || "Внешний action flow по делу.";
}

export default function ExternalActionsPanel({ caseId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!caseId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await getExternalActions(caseId);
      setData(res || null);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить внешние действия");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  async function prepare(code: string) {
    if (!caseId) return;

    try {
      setBusy(`prepare:${code}`);
      setError("");
      await prepareExternalAction(caseId, code);
      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось подготовить действие");
    } finally {
      setBusy("");
    }
  }

  async function startAuth(actionId: number) {
    try {
      setBusy(`auth:${actionId}`);
      setError("");

      const session = await startEsiaSession(actionId);
      const sessionId = session?.session?.id;

      if (session?.session?.redirect_url) {
        window.open(session.session.redirect_url, "_blank");
      }

      if (sessionId) {
        await authorizeEsiaSession(sessionId);
      }

      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось выполнить ESIA flow");
    } finally {
      setBusy("");
    }
  }

  async function dispatch(actionId: number) {
    try {
      setBusy(`dispatch:${actionId}`);
      setError("");
      await dispatchExternalAction(actionId);
      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить действие во внешний канал");
    } finally {
      setBusy("");
    }
  }

  const summary = useMemo(() => {
    const actions = data?.actions || [];

    return {
      total: actions.length,
      pending_auth: actions.filter((item: any) => item?.status === "pending_auth").length,
      prepared: actions.filter((item: any) => item?.status === "prepared").length,
      sent: actions.filter((item: any) => item?.status === "sent").length,
      failed: actions.filter((item: any) => item?.status === "failed").length,
    };
  }, [data]);

  if (!caseId) return null;

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">External execution</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Внешние действия
          </div>
          <div className="muted">
            Подготовка, авторизация и отправка действий во внешние каналы по кейсу.
          </div>
        </div>
      </div>

      <div className="ops-grid ops-grid-compact" style={{ marginBottom: 16 }}>
        <div className="ops-card ops-card-accent">
          <div className="ops-card-title">Всего действий</div>
          <div className="ops-card-value">{summary.total}</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Ждут ЕСИА</div>
          <div className="ops-card-value">{summary.pending_auth}</div>
          <div className="muted small">нужно подтверждение пользователя</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Подготовлены</div>
          <div className="ops-card-value">{summary.prepared}</div>
          <div className="muted small">готовы к dispatch</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Sent / failed</div>
          <div className="ops-card-value">
            {summary.sent} / {summary.failed}
          </div>
          <div className="muted small">внешний результат исполнения</div>
        </div>
      </div>

      <div className="action-list" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <button
          className="secondary-btn"
          onClick={() => prepare("send_to_fssp")}
          disabled={busy === "prepare:send_to_fssp"}
        >
          {busy === "prepare:send_to_fssp"
            ? "Подготовка…"
            : "Подготовить отправку в ФССП"}
        </button>

        <button
          className="secondary-btn"
          onClick={() => prepare("send_russian_post_letter")}
          disabled={busy === "prepare:send_russian_post_letter"}
        >
          {busy === "prepare:send_russian_post_letter"
            ? "Подготовка…"
            : "Подготовить письмо Почтой России"}
        </button>

        <button
          className="secondary-btn"
          onClick={() => prepare("submit_to_court")}
          disabled={busy === "prepare:submit_to_court"}
        >
          {busy === "prepare:submit_to_court"
            ? "Подготовка…"
            : "Подготовить подачу в суд"}
        </button>

        <button
          className="secondary-btn"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Обновляем…" : "Обновить"}
        </button>
      </div>

      {loading && <div className="empty-box">Загрузка внешних действий…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && !error && (
        <>
          {data?.actions?.length ? (
            <div className="participants-list">
              {data.actions.map((item: any) => {
                const canStartEsia =
                  item.status === "pending_auth" && item.requires_user_auth;

                const canDispatch =
                  item.status === "authorized" || item.status === "prepared";

                return (
                  <div className="participant-card" key={item.id}>
                    <div className="participant-card-top">
                      <div>
                        <div className="participant-role">
                          {item.title || actionLabel(item.action_code)}
                        </div>
                        <div className="participant-name">
                          {statusLabel(item.status)}
                        </div>
                      </div>

                      <div className="participant-badges">
                        <span className={`status-badge ${statusClass(item.status)}`}>
                          {providerLabel(item.provider)}
                        </span>
                      </div>
                    </div>

                    <div className="muted small" style={{ marginTop: 8 }}>
                      {actionFlowHint(item)}
                    </div>

                    <div className="participant-meta-grid">
                      <div className="info-item">
                        <span className="label">Код действия</span>
                        <strong>{item.action_code || "—"}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Авторизация</span>
                        <strong>{item.auth_type || "—"}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Требует ЕСИА</span>
                        <strong>{item.requires_user_auth ? "Да" : "Нет"}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Внешняя ссылка</span>
                        <strong>{item.external_reference || "—"}</strong>
                      </div>

                      <div className="info-item info-item-wide">
                        <span className="label">Описание</span>
                        <strong>{item.description || "—"}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Истекает</span>
                        <strong>{formatDate(item.expires_at)}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Подтверждено</span>
                        <strong>{formatDate(item.confirmed_at)}</strong>
                      </div>

                      <div className="info-item info-item-wide">
                        <span className="label">Redirect URL</span>
                        <strong style={{ whiteSpace: "pre-wrap" }}>
                          {item.redirect_url || "—"}
                        </strong>
                      </div>

                      <div className="info-item info-item-wide">
                        <span className="label">Ошибка</span>
                        <strong>{item.error_message || "—"}</strong>
                      </div>

                      <div className="info-item info-item-wide">
                        <span className="label">Payload</span>
                        <strong className="code-block">{stringifyData(item.payload)}</strong>
                      </div>

                      <div className="info-item info-item-wide">
                        <span className="label">Result</span>
                        <strong className="code-block">{stringifyData(item.result)}</strong>
                      </div>
                    </div>

                    <div className="document-actions" style={{ marginTop: 12 }}>
                      {canStartEsia && (
                        <button
                          className="secondary-btn"
                          onClick={() => startAuth(item.id)}
                          disabled={busy === `auth:${item.id}`}
                        >
                          {busy === `auth:${item.id}`
                            ? "Запускаем ЕСИА…"
                            : "Запустить ЕСИА"}
                        </button>
                      )}

                      {canDispatch && (
                        <button
                          className="primary-btn"
                          onClick={() => dispatch(item.id)}
                          disabled={busy === `dispatch:${item.id}`}
                        >
                          {busy === `dispatch:${item.id}`
                            ? "Отправка…"
                            : "Отправить во внешний канал"}
                        </button>
                      )}

                      {item.status === "sent" && (
                        <span className="status-badge status-ready">Уже отправлено</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-box">
              Внешние действия по делу пока не подготовлены.
            </div>
          )}
        </>
      )}
    </section>
  );
}
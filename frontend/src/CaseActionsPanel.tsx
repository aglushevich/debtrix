import { useMemo, useState } from "react";
import { formatActionCode } from "./legalLabels";

type Props = {
  dashboard: any;
  actionBusy: string;
  onRunAction: (code: string) => Promise<void> | void;
};

type ActionFeedback = {
  code: string;
  status: "success" | "failed" | "running";
  message: string;
  at: string;
};

function toArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function resolveActionCode(item: any): string {
  return String(item?.code || item?.action_code || item?.key || "").trim();
}

function resolveActionTitle(item: any): string {
  return (
    item?.title_ru ||
    item?.title ||
    item?.label ||
    formatActionCode(resolveActionCode(item))
  );
}

function resolveActionHint(item: any): string {
  return item?.hint || item?.description || item?.reason || item?.blocked_reason || "";
}

function isActionReady(item: any): boolean {
  if (typeof item?.ready === "boolean") return item.ready;
  if (typeof item?.is_available === "boolean") return item.is_available;
  if (typeof item?.available === "boolean") return item.available;
  if (typeof item?.enabled === "boolean") return item.enabled;
  if (item?.status === "blocked") return false;
  return true;
}

function isActionRecommended(item: any, nextCode?: string | null): boolean {
  const code = resolveActionCode(item);
  if (!code) return false;
  return code === nextCode;
}

function badgeClass(kind: string) {
  const map: Record<string, string> = {
    ready: "status-ready",
    blocked: "status-not-ready",
    running: "status-pretrial",
    success: "status-ready",
    failed: "status-overdue",
    recommended: "status-pretrial",
  };
  return map[kind] || "status-draft";
}

function formatTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

function feedbackTitle(status?: string) {
  if (status === "success") return "Выполнено";
  if (status === "failed") return "Ошибка";
  if (status === "running") return "Выполняется";
  return "Неизвестно";
}

export default function CaseActionsPanel({
  dashboard,
  actionBusy,
  onRunAction,
}: Props) {
  const [feedback, setFeedback] = useState<ActionFeedback[]>([]);

  const nextCode = String(dashboard?.next_step?.code || "").trim() || null;
  const rawActions = toArray(dashboard?.actions);

  const actions = useMemo(() => {
    const normalized = rawActions
      .map((item: any) => {
        const code = resolveActionCode(item);
        return {
          raw: item,
          code,
          title: resolveActionTitle(item),
          hint: resolveActionHint(item),
          ready: isActionReady(item),
          recommended: isActionRecommended(item, nextCode),
        };
      })
      .filter((item: any) => item.code);

    normalized.sort((a: any, b: any) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      if (a.ready && !b.ready) return -1;
      if (!a.ready && b.ready) return 1;
      return a.title.localeCompare(b.title, "ru");
    });

    return normalized;
  }, [rawActions, nextCode]);

  const readyCount = actions.filter((item: any) => item.ready).length;
  const blockedCount = actions.filter((item: any) => !item.ready).length;

  async function handleRun(code: string) {
    try {
      setFeedback((prev) => [
        {
          code,
          status: "running",
          message: "Действие отправлено в исполнение.",
          at: new Date().toISOString(),
        },
        ...prev.filter((item) => item.code !== code),
      ]);

      await onRunAction(code);

      setFeedback((prev) => [
        {
          code,
          status: "success",
          message: "Действие выполнено или принято backend в обработку.",
          at: new Date().toISOString(),
        },
        ...prev.filter((item) => item.code !== code),
      ]);
    } catch (e: any) {
      setFeedback((prev) => [
        {
          code,
          status: "failed",
          message: e?.message || "Не удалось выполнить действие.",
          at: new Date().toISOString(),
        },
        ...prev.filter((item) => item.code !== code),
      ]);
    }
  }

  return (
    <section className="panel case-actions-dock">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Action dock</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Исполнение по делу
          </div>
          <div className="muted">
            Операционный слой: что можно запускать сейчас, что заблокировано и какой
            результат был у последнего действия.
          </div>
        </div>
      </div>

      <div className="case-actions-summary">
        <div className="ops-card ops-card-accent">
          <div className="ops-card-title">Всего действий</div>
          <div className="ops-card-value">{actions.length}</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Доступно сейчас</div>
          <div className="ops-card-value">{readyCount}</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Заблокировано</div>
          <div className="ops-card-value">{blockedCount}</div>
        </div>
      </div>

      {nextCode && (
        <div className="case-actions-recommended">
          <div className="case-actions-recommended-label">
            Рекомендуемое следующее действие
          </div>
          <div className="case-actions-recommended-title">
            {dashboard?.next_step?.title_ru ||
              dashboard?.next_step?.title ||
              formatActionCode(nextCode)}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Код: {nextCode}
          </div>
        </div>
      )}

      {actions.length === 0 ? (
        <div className="empty-box" style={{ marginTop: 14 }}>
          Для этого дела сейчас нет доступных action handlers.
        </div>
      ) : (
        <div className="case-action-list">
          {actions.map((item: any) => {
            const isBusy = actionBusy === item.code;
            const lastFeedback = feedback.find((entry) => entry.code === item.code);

            return (
              <div
                key={item.code}
                className={`case-action-card ${item.recommended ? "is-recommended" : ""}`}
              >
                <div className="case-action-card-top">
                  <div>
                    <div className="case-action-card-title">{item.title}</div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {item.code}
                    </div>
                  </div>

                  <div className="participant-badges">
                    {item.recommended && (
                      <span className={`status-badge ${badgeClass("recommended")}`}>
                        Recommended
                      </span>
                    )}
                    <span
                      className={`status-badge ${badgeClass(
                        item.ready ? "ready" : "blocked"
                      )}`}
                    >
                      {item.ready ? "Ready" : "Blocked"}
                    </span>
                  </div>
                </div>

                <div className="case-action-card-body">
                  <div className="info-item info-item-wide">
                    <span className="label">Контекст</span>
                    <strong>
                      {item.hint ||
                        (item.ready
                          ? "Действие доступно к исполнению."
                          : "Для действия пока не выполнены условия.")}
                    </strong>
                  </div>
                </div>

                <div className="case-action-card-footer">
                  <button
                    className={item.recommended ? "primary-btn" : "secondary-btn"}
                    disabled={!item.ready || isBusy}
                    onClick={() => handleRun(item.code)}
                  >
                    {isBusy ? "Выполняем…" : "Запустить действие"}
                  </button>
                </div>

                {lastFeedback && (
                  <div className="case-action-feedback">
                    <div className="case-action-feedback-top">
                      <span className={`status-badge ${badgeClass(lastFeedback.status)}`}>
                        {feedbackTitle(lastFeedback.status)}
                      </span>
                      <span className="muted small">{formatTime(lastFeedback.at)}</span>
                    </div>

                    <div className="muted" style={{ marginTop: 8 }}>
                      {lastFeedback.message}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
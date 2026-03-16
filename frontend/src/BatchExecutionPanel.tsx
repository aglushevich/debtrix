import { useMemo, useState } from "react";
import {
  BatchPreviewResponse,
  BatchRunResponse,
  previewBatchExecution,
  runBatchExecution,
} from "./api";

type Props = {
  selectedCaseIds: number[];
  onCompleted?: () => Promise<void> | void;
};

function actionLabel(code: string) {
  const map: Record<string, string> = {
    send_payment_due_notice: "Направить напоминание о сроке оплаты",
    send_debt_notice: "Направить уведомление о задолженности",
    send_pretension: "Направить досудебную претензию",
    generate_lawsuit: "Сформировать иск",
    submit_to_court: "Подать в суд",
    send_to_fssp: "Отправить в ФССП",
    send_russian_post_letter: "Отправить письмо Почтой России",
  };
  return map[code] || code;
}

function bucketLabel(bucket?: string) {
  const map: Record<string, string> = {
    eligible_now: "Готово к запуску",
    waiting: "Ожидают",
    blocked: "Заблокированы",
    not_applicable: "Не применимо",
    already_processed: "Уже обработаны",
    success: "Успешно",
    error: "Ошибка",
  };
  return map[bucket || ""] || bucket || "—";
}

function statusBadgeClass(value?: string) {
  const map: Record<string, string> = {
    eligible_now: "status-ready",
    success: "status-ready",
    waiting: "status-draft",
    blocked: "status-not-ready",
    not_applicable: "status-not-ready",
    already_processed: "status-pretrial",
    error: "status-overdue",
  };

  return map[value || ""] || "status-draft";
}

export default function BatchExecutionPanel({
  selectedCaseIds,
  onCompleted,
}: Props) {
  const [actionCode, setActionCode] = useState("send_debt_notice");
  const [preview, setPreview] = useState<BatchPreviewResponse | null>(null);
  const [runResult, setRunResult] = useState<BatchRunResponse | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const count = selectedCaseIds.length;
  const canRun = useMemo(() => count > 0, [count]);

  async function handlePreview() {
    if (!canRun) return;

    try {
      setBusy("preview");
      setError("");
      setRunResult(null);

      const result = await previewBatchExecution({
        action_code: actionCode,
        case_ids: selectedCaseIds,
      });

      setPreview(result);
    } catch (e: any) {
      setError(e?.message || "Не удалось построить предварительный разбор пакета.");
      setPreview(null);
    } finally {
      setBusy("");
    }
  }

  async function handleRun() {
    if (!canRun) return;

    try {
      setBusy("run");
      setError("");

      const result = await runBatchExecution({
        action_code: actionCode,
        case_ids: selectedCaseIds,
        force: false,
      });

      setRunResult(result);

      if (onCompleted) {
        await onCompleted();
      }
    } catch (e: any) {
      setError(e?.message || "Не удалось выполнить пакетное действие.");
      setRunResult(null);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Batch operations</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Batch execution
          </div>
          <div className="muted">
            Предварительный разбор выбранного пакета и массовый запуск действия по делам.
          </div>
        </div>
      </div>

      <div className="batch-shell">
        <div className="batch-shell-main">
          <div
            className="info-grid"
            style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16 }}
          >
            <div className="info-item">
              <span className="label">Пакетное действие</span>
              <select
                className="small-input"
                value={actionCode}
                onChange={(e) => setActionCode(e.target.value)}
              >
                <option value="send_payment_due_notice">
                  {actionLabel("send_payment_due_notice")}
                </option>
                <option value="send_debt_notice">{actionLabel("send_debt_notice")}</option>
                <option value="send_pretension">{actionLabel("send_pretension")}</option>
                <option value="generate_lawsuit">{actionLabel("generate_lawsuit")}</option>
                <option value="submit_to_court">{actionLabel("submit_to_court")}</option>
                <option value="send_to_fssp">{actionLabel("send_to_fssp")}</option>
                <option value="send_russian_post_letter">
                  {actionLabel("send_russian_post_letter")}
                </option>
              </select>
            </div>

            <div className="info-item">
              <span className="label">Выбрано дел</span>
              <strong>{count}</strong>
            </div>
          </div>

          <div className="action-list" style={{ marginTop: 16 }}>
            <button
              className="secondary-btn"
              onClick={handlePreview}
              disabled={!canRun || busy === "preview"}
            >
              {busy === "preview" ? "Строим preview…" : "Показать preview"}
            </button>

            <button
              className="primary-btn"
              onClick={handleRun}
              disabled={!canRun || busy === "run"}
            >
              {busy === "run" ? "Запускаем пакет…" : "Запустить пакет"}
            </button>
          </div>

          {!canRun && (
            <div className="empty-box" style={{ marginTop: 16 }}>
              Сначала выберите хотя бы одно дело в портфеле.
            </div>
          )}

          {error && (
            <div className="empty-box" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}

          {preview?.preview && (
            <div className="ops-grid batch-metrics-grid" style={{ marginTop: 16 }}>
              <div className="ops-card ops-card-accent">
                <div className="ops-card-title">Готово к запуску</div>
                <div className="ops-card-value">{preview.preview.eligible_now?.count || 0}</div>
              </div>

              <div className="ops-card">
                <div className="ops-card-title">Ожидают</div>
                <div className="ops-card-value">{preview.preview.waiting?.count || 0}</div>
              </div>

              <div className="ops-card">
                <div className="ops-card-title">Заблокированы</div>
                <div className="ops-card-value">{preview.preview.blocked?.count || 0}</div>
              </div>

              <div className="ops-card">
                <div className="ops-card-title">Не применимо</div>
                <div className="ops-card-value">{preview.preview.not_applicable?.count || 0}</div>
              </div>

              <div className="ops-card">
                <div className="ops-card-title">Уже обработаны</div>
                <div className="ops-card-value">
                  {preview.preview.already_processed?.count || 0}
                </div>
              </div>

              <div className="ops-card">
                <div className="ops-card-title">Всего в пакете</div>
                <div className="ops-card-value">{preview.total_selected || 0}</div>
              </div>
            </div>
          )}

          {preview?.items?.length ? (
            <div className="participants-list" style={{ marginTop: 16 }}>
              {preview.items.slice(0, 30).map((item) => (
                <div className="participant-card" key={`preview-${item.case_id}-${item.bucket}`}>
                  <div className="participant-card-top">
                    <div>
                      <div className="participant-role">Дело №{item.case_id}</div>
                      <div className="participant-name">{bucketLabel(item.bucket)}</div>
                    </div>

                    <span className={`status-badge ${statusBadgeClass(item.bucket)}`}>
                      {bucketLabel(item.bucket)}
                    </span>
                  </div>

                  <div className="participant-meta-grid">
                    <div className="info-item info-item-wide">
                      <span className="label">Причина</span>
                      <strong>{item.reason || "—"}</strong>
                    </div>
                    <div className="info-item">
                      <span className="label">Можно выполнить с</span>
                      <strong>{item.eligible_at || "—"}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {runResult?.summary && (
            <div className="ops-grid batch-metrics-grid" style={{ marginTop: 16 }}>
              {Object.entries(runResult.summary).map(([key, value]) => (
                <div className="ops-card" key={key}>
                  <div className="ops-card-title">{bucketLabel(key)}</div>
                  <div className="ops-card-value">{value}</div>
                </div>
              ))}
            </div>
          )}

          {runResult?.results?.length ? (
            <div className="participants-list" style={{ marginTop: 16 }}>
              {runResult.results.slice(0, 30).map((item) => (
                <div className="participant-card" key={`run-${item.case_id}-${item.status}`}>
                  <div className="participant-card-top">
                    <div>
                      <div className="participant-role">Дело №{item.case_id}</div>
                      <div className="participant-name">{bucketLabel(item.status)}</div>
                    </div>

                    <span className={`status-badge ${statusBadgeClass(item.status)}`}>
                      {bucketLabel(item.status)}
                    </span>
                  </div>

                  <div className="participant-meta-grid">
                    <div className="info-item info-item-wide">
                      <span className="label">Причина</span>
                      <strong>{item.reason || "—"}</strong>
                    </div>
                    <div className="info-item">
                      <span className="label">Можно выполнить с</span>
                      <strong>{item.eligible_at || "—"}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="batch-shell-side">
          <div className="batch-side-card">
            <div className="batch-side-title">Как использовать batch</div>
            <div className="muted small">
              Сначала строим preview, затем запускаем только однородный пакет по одной логике.
            </div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Rule of thumb</div>
            <div className="muted small">
              Не смешивай soft, court и enforcement в одном запуске.
            </div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Waiting cases</div>
            <div className="muted small">
              Waiting — это не ошибка. Это будущая пропускная способность портфеля.
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
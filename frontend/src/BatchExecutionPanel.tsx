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
    send_to_fssp: "Отправка в ФССП",
    send_russian_post_letter: "Письмо Почтой России",
    submit_to_court: "Подача в суд",
    send_pretension: "Направить претензию",
    generate_lawsuit: "Сформировать иск",
  };
  return map[code] || code;
}

export default function BatchExecutionPanel({
  selectedCaseIds,
  onCompleted,
}: Props) {
  const [actionCode, setActionCode] = useState("send_to_fssp");
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
      setError(e?.message || "Не удалось построить preview batch execution");
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
      });

      setRunResult(result);
      if (onCompleted) {
        await onCompleted();
      }
    } catch (e: any) {
      setError(e?.message || "Не удалось запустить batch execution");
      setRunResult(null);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel">
      <div className="batch-header">
        <div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Batch execution
          </div>
          <div className="muted">
            Просмотр результата перед запуском и разбор по operational buckets.
          </div>
        </div>
      </div>

      <div className="info-grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16 }}>
        <div className="info-item">
          <span className="label">Действие</span>
          <select
            className="small-input"
            value={actionCode}
            onChange={(e) => setActionCode(e.target.value)}
          >
            <option value="send_to_fssp">{actionLabel("send_to_fssp")}</option>
            <option value="send_russian_post_letter">
              {actionLabel("send_russian_post_letter")}
            </option>
            <option value="submit_to_court">
              {actionLabel("submit_to_court")}
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
          {busy === "run" ? "Запускаем batch…" : "Запустить batch"}
        </button>
      </div>

      {error && <div className="empty-box" style={{ marginTop: 16 }}>{error}</div>}

      {preview?.preview && (
        <div className="ops-grid" style={{ marginTop: 16 }}>
          <div className="ops-card">
            <div className="ops-card-title">Eligible now</div>
            <div className="ops-card-value">{preview.preview.eligible_now?.count || 0}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Waiting</div>
            <div className="ops-card-value">{preview.preview.waiting?.count || 0}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Blocked</div>
            <div className="ops-card-value">{preview.preview.blocked?.count || 0}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Not applicable</div>
            <div className="ops-card-value">{preview.preview.not_applicable?.count || 0}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Already processed</div>
            <div className="ops-card-value">
              {preview.preview.already_processed?.count || 0}
            </div>
          </div>
        </div>
      )}

      {preview?.items?.length ? (
        <div className="participants-list" style={{ marginTop: 16 }}>
          {preview.items.slice(0, 20).map((item) => (
            <div className="participant-card" key={`${item.case_id}:${item.bucket}`}>
              <div className="participant-card-top">
                <div>
                  <div className="participant-role">Дело #{item.case_id}</div>
                  <div className="participant-name">{item.bucket}</div>
                </div>
              </div>

              <div className="participant-meta-grid">
                <div className="info-item info-item-wide">
                  <span className="label">Причина</span>
                  <strong>{item.reason || "—"}</strong>
                </div>
                <div className="info-item">
                  <span className="label">Eligible at</span>
                  <strong>{item.eligible_at || "—"}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {runResult?.results?.length ? (
        <div className="participants-list" style={{ marginTop: 16 }}>
          {runResult.results.slice(0, 20).map((item) => (
            <div className="participant-card" key={`${item.case_id}:${item.status}`}>
              <div className="participant-card-top">
                <div>
                  <div className="participant-role">Дело #{item.case_id}</div>
                  <div className="participant-name">{item.status}</div>
                </div>
              </div>

              <div className="participant-meta-grid">
                <div className="info-item info-item-wide">
                  <span className="label">Причина</span>
                  <strong>{item.reason || "—"}</strong>
                </div>
                <div className="info-item">
                  <span className="label">Eligible at</span>
                  <strong>{item.eligible_at || "—"}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
import { useEffect, useMemo, useState } from "react";
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
    queued: "Поставлено в очередь",
    waiting: "Ожидают",
    blocked: "Заблокированы",
    not_applicable: "Не применимо",
    already_processed: "Уже обработаны",
    success: "Успешно",
    completed: "Завершено",
    failed: "Ошибка",
    error: "Ошибка",
  };
  return map[bucket || ""] || bucket || "—";
}

function statusBadgeClass(value?: string) {
  const map: Record<string, string> = {
    eligible_now: "status-ready",
    queued: "status-pretrial",
    success: "status-ready",
    completed: "status-ready",
    waiting: "status-waiting",
    blocked: "status-not-ready",
    not_applicable: "status-not-ready",
    already_processed: "status-pretrial",
    failed: "status-overdue",
    error: "status-overdue",
  };

  return map[value || ""] || "status-draft";
}

function severityBadgeClass(value?: string) {
  const map: Record<string, string> = {
    low: "status-draft",
    medium: "status-pretrial",
    high: "status-overdue",
  };

  return map[value || ""] || "status-draft";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU");
}

function getPreviewCount(preview: BatchPreviewResponse | null, key: string): number {
  if (!preview?.preview) return 0;
  return Number((preview.preview as any)?.[key]?.count || 0);
}

function getRunSummaryCount(runResult: BatchRunResponse | null, key: string): number {
  if (!runResult?.summary) return 0;
  return Number(runResult.summary[key] || 0);
}

function recommendationText(preview: BatchPreviewResponse | null) {
  const eligibleNowCount = getPreviewCount(preview, "eligible_now");
  const waitingCount = getPreviewCount(preview, "waiting");
  const blockedCount = getPreviewCount(preview, "blocked");
  const recommendedSubsetCode = preview?.recommended_subset_code || null;

  if (!preview?.preview) {
    return "Соберите preview, чтобы понять, можно ли запускать пакет целиком или безопаснее взять subset.";
  }

  if (eligibleNowCount > 0 && recommendedSubsetCode) {
    return "Лучший режим — запускать recommended subset, а не весь selection целиком.";
  }

  if (eligibleNowCount > 0 && blockedCount === 0 && waitingCount === 0) {
    return "Пакет выглядит чистым: можно запускать почти без дополнительной ручной разборки.";
  }

  if (eligibleNowCount > 0) {
    return "В пакете есть готовые дела, но selection смешанный. Лучше сначала отсечь waiting и blocked.";
  }

  return "В selection нет дел для немедленного запуска. Сначала разберите blockers и waiting-окна.";
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
  const [force, setForce] = useState(false);

  const [activeCaseIds, setActiveCaseIds] = useState<number[]>(selectedCaseIds);
  const [activeSelectionLabel, setActiveSelectionLabel] = useState("Текущее выделение");

  useEffect(() => {
    setActiveCaseIds(selectedCaseIds);
    setActiveSelectionLabel("Текущее выделение");
    setPreview(null);
    setRunResult(null);
  }, [selectedCaseIds]);

  const count = activeCaseIds.length;
  const canRun = useMemo(() => count > 0, [count]);

  const eligibleNowCount = getPreviewCount(preview, "eligible_now");
  const waitingCount = getPreviewCount(preview, "waiting");
  const blockedCount = getPreviewCount(preview, "blocked");
  const notApplicableCount = getPreviewCount(preview, "not_applicable");
  const alreadyProcessedCount = getPreviewCount(preview, "already_processed");

  const previewBuilt = Boolean(preview?.preview);
  const hasEligibleNow = eligibleNowCount > 0;
  const guardrails = preview?.guardrails;
  const executeGuardrails = runResult?.guardrails;

  const subsets = preview?.subsets || [];
  const recommendedSubsetCode = preview?.recommended_subset_code || null;

  const runSummaryItems = Object.entries(runResult?.summary || {});
  const previewRecommendation = recommendationText(preview);

  function resetToFullSelection() {
    setActiveCaseIds(selectedCaseIds);
    setActiveSelectionLabel("Текущее выделение");
    setPreview(null);
    setRunResult(null);
  }

  function applySubset(caseIds: number[], label: string) {
    setActiveCaseIds(caseIds);
    setActiveSelectionLabel(label);
    setRunResult(null);
  }

  async function handlePreview(targetCaseIds?: number[]) {
    const ids = targetCaseIds || activeCaseIds;
    if (!ids.length) return;

    try {
      setBusy("preview");
      setError("");
      setRunResult(null);

      const result = await previewBatchExecution({
        action_code: actionCode,
        case_ids: ids,
      });

      setPreview(result);
    } catch (e: any) {
      setError(e?.message || "Не удалось построить предварительный разбор пакета.");
      setPreview(null);
    } finally {
      setBusy("");
    }
  }

  async function handleRun(targetCaseIds?: number[]) {
    const ids = targetCaseIds || activeCaseIds;
    if (!ids.length) return;

    try {
      setBusy("run");
      setError("");

      const result = await runBatchExecution({
        action_code: actionCode,
        case_ids: ids,
        force,
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
    <section className="panel batch-command-center">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Batch command center</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Batch execution
          </div>
          <div className="muted">
            Предварительный разбор selection, безопасные subsets и массовый запуск
            действия по кейсам.
          </div>
        </div>
      </div>

      <div className="batch-hero">
        <div className="batch-hero-main">
          <div className="batch-hero-label">Пакетное действие</div>
          <div className="batch-hero-title">{actionLabel(actionCode)}</div>
          <div className="batch-hero-caption">{previewRecommendation}</div>

          <div className="batch-hero-meta">
            <div className="hero-mini-card">
              <span>Активный пакет</span>
              <strong>{count}</strong>
            </div>
            <div className="hero-mini-card">
              <span>Готово сейчас</span>
              <strong>{eligibleNowCount}</strong>
            </div>
            <div className="hero-mini-card">
              <span>Waiting</span>
              <strong>{waitingCount}</strong>
            </div>
            <div className="hero-mini-card">
              <span>Blocked</span>
              <strong>{blockedCount}</strong>
            </div>
          </div>
        </div>

        <div className="batch-hero-side">
          <div className="hero-selected-box">
            <span>Активное selection</span>
            <strong>{activeSelectionLabel}</strong>
            <div className="muted small" style={{ marginTop: 8 }}>
              {count} дел в текущем пакете
            </div>
          </div>

          <div className="info-item">
            <span className="label">Пакетное действие</span>
            <select
              className="small-input"
              value={actionCode}
              onChange={(e) => {
                setActionCode(e.target.value);
                setActiveCaseIds(selectedCaseIds);
                setActiveSelectionLabel("Текущее выделение");
                setPreview(null);
                setRunResult(null);
              }}
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
            <span className="label">Режим исполнения</span>
            <label
              className="muted small"
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
              Force execution для waiting / части blocked кейсов
            </label>
          </div>

          <div className="action-list">
            <button
              className="secondary-btn"
              onClick={() => handlePreview()}
              disabled={!canRun || busy === "preview"}
            >
              {busy === "preview" ? "Строим preview…" : "Показать preview"}
            </button>

            <button
              className="primary-btn"
              onClick={() => handleRun()}
              disabled={!canRun || busy === "run"}
            >
              {busy === "run" ? "Запускаем пакет…" : "Запустить пакет"}
            </button>

            <button
              className="secondary-btn"
              onClick={resetToFullSelection}
              disabled={busy !== ""}
            >
              Сбросить selection
            </button>
          </div>
        </div>
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

      {previewBuilt && (
        <div className="ops-grid batch-metrics-grid" style={{ marginTop: 16 }}>
          <div className="ops-card ops-card-accent">
            <div className="ops-card-title">Готово к запуску</div>
            <div className="ops-card-value">{eligibleNowCount}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Ожидают</div>
            <div className="ops-card-value">{waitingCount}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Заблокированы</div>
            <div className="ops-card-value">{blockedCount}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Не применимо</div>
            <div className="ops-card-value">{notApplicableCount}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Уже обработаны</div>
            <div className="ops-card-value">{alreadyProcessedCount}</div>
          </div>

          <div className="ops-card">
            <div className="ops-card-title">Всего в пакете</div>
            <div className="ops-card-value">{preview?.total_selected || 0}</div>
          </div>
        </div>
      )}

      <div className="batch-workspace-grid">
        <div className="batch-workspace-main">
          {previewBuilt && guardrails && (
            <div className="participant-card batch-guardrails-card">
              <div className="participant-card-top">
                <div>
                  <div className="participant-role">Smart batch guardrails</div>
                  <div className="participant-name">
                    {guardrails.is_homogeneous
                      ? "Пакет выглядит однородным"
                      : "Пакет требует разборки перед запуском"}
                  </div>
                </div>

                <span
                  className={`status-badge ${
                    guardrails.is_homogeneous ? "status-ready" : "status-pretrial"
                  }`}
                >
                  {guardrails.recommended_mode || "review_before_run"}
                </span>
              </div>

              <div className="participant-meta-grid">
                <div className="info-item info-item-wide">
                  <span className="label">Рекомендация</span>
                  <strong>{guardrails.recommended_action || "—"}</strong>
                </div>

                <div className="info-item">
                  <span className="label">Линий взыскания</span>
                  <strong>
                    {Object.keys(guardrails.selection?.counts_by_lane || {}).length}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Типов договора</span>
                  <strong>
                    {Object.keys(guardrails.selection?.counts_by_contract_type || {}).length}
                  </strong>
                </div>

                <div className="info-item">
                  <span className="label">Архивных дел</span>
                  <strong>{guardrails.selection?.archived_cases || 0}</strong>
                </div>
              </div>

              {guardrails.warnings?.length ? (
                <div className="action-list" style={{ marginTop: 12, flexWrap: "wrap" }}>
                  {guardrails.warnings.map((warning) => (
                    <span
                      key={warning.code}
                      className={`status-badge ${severityBadgeClass(warning.severity)}`}
                      title={warning.message}
                    >
                      {warning.code}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="muted small" style={{ marginTop: 12 }}>
                  Существенных guardrail-warning пока нет.
                </div>
              )}
            </div>
          )}

          {previewBuilt && subsets.length > 0 && (
            <div className="participants-list" style={{ marginTop: 16 }}>
              <div className="participant-card">
                <div className="participant-card-top">
                  <div>
                    <div className="participant-role">Suggested subsets</div>
                    <div className="participant-name">
                      Debtrix предлагает более безопасные под-пакеты
                    </div>
                  </div>

                  {recommendedSubsetCode ? (
                    <span className="status-badge status-ready">
                      recommended: {recommendedSubsetCode}
                    </span>
                  ) : null}
                </div>

                <div className="batch-subsets-grid" style={{ marginTop: 12 }}>
                  {subsets.map((subset) => {
                    const isRecommended =
                      subset.code === recommendedSubsetCode || subset.recommended;

                    return (
                      <div
                        className={`participant-card batch-subset-card ${
                          isRecommended ? "is-recommended" : ""
                        }`}
                        key={subset.code}
                      >
                        <div className="participant-card-top">
                          <div>
                            <div className="participant-role">{subset.title}</div>
                            <div className="participant-name">{subset.count} дел</div>
                          </div>

                          <span
                            className={`status-badge ${
                              isRecommended ? "status-ready" : "status-pretrial"
                            }`}
                          >
                            {isRecommended ? "recommended" : subset.code}
                          </span>
                        </div>

                        <div className="muted small" style={{ marginTop: 8 }}>
                          {subset.description}
                        </div>

                        <div className="action-list" style={{ marginTop: 12 }}>
                          <button
                            className="secondary-btn"
                            onClick={() => applySubset(subset.case_ids || [], subset.title)}
                            disabled={busy !== ""}
                          >
                            Использовать subset
                          </button>

                          <button
                            className="secondary-btn"
                            onClick={() => {
                              applySubset(subset.case_ids || [], subset.title);
                              void handlePreview(subset.case_ids || []);
                            }}
                            disabled={busy !== ""}
                          >
                            Preview subset
                          </button>

                          <button
                            className="primary-btn"
                            onClick={() => {
                              applySubset(subset.case_ids || [], subset.title);
                              void handleRun(subset.case_ids || []);
                            }}
                            disabled={busy !== ""}
                          >
                            Запустить subset
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {preview?.items?.length ? (
            <div className="participants-list" style={{ marginTop: 16 }}>
              <div className="participant-card">
                <div className="participant-card-top">
                  <div>
                    <div className="participant-role">Preview breakdown</div>
                    <div className="participant-name">Первые кейсы из preview-разбора</div>
                  </div>
                </div>

                <div className="participants-list" style={{ marginTop: 12 }}>
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
                          <strong>{formatDateTime(item.eligible_at)}</strong>
                        </div>
                        <div className="info-item">
                          <span className="label">Линия</span>
                          <strong>{item.snapshot?.lane || "—"}</strong>
                        </div>
                        <div className="info-item">
                          <span className="label">Тип договора</span>
                          <strong>{item.snapshot?.contract_type || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {runSummaryItems.length > 0 && (
            <div className="ops-grid batch-metrics-grid" style={{ marginTop: 16 }}>
              {runSummaryItems.map(([key, value]) => (
                <div className="ops-card" key={key}>
                  <div className="ops-card-title">{bucketLabel(key)}</div>
                  <div className="ops-card-value">{value}</div>
                </div>
              ))}
            </div>
          )}

          {executeGuardrails && (
            <div className="participants-list" style={{ marginTop: 16 }}>
              <div className="participant-card">
                <div className="participant-card-top">
                  <div>
                    <div className="participant-role">Execution result</div>
                    <div className="participant-name">Итог выполнения пакета</div>
                  </div>

                  <span className="status-badge status-ready">
                    executed: {executeGuardrails.executed_cases || 0}
                  </span>
                </div>

                <div className="participant-meta-grid">
                  <div className="info-item">
                    <span className="label">Force</span>
                    <strong>{executeGuardrails.force_used ? "Да" : "Нет"}</strong>
                  </div>

                  <div className="info-item info-item-wide">
                    <span className="label">Итоговая рекомендация</span>
                    <strong>{executeGuardrails.recommended_action || "—"}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {runResult?.results?.length ? (
            <div className="participants-list" style={{ marginTop: 16 }}>
              <div className="participant-card">
                <div className="participant-card-top">
                  <div>
                    <div className="participant-role">Execution details</div>
                    <div className="participant-name">Первые результаты выполнения пакета</div>
                  </div>
                </div>

                <div className="participants-list" style={{ marginTop: 12 }}>
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
                          <strong>{formatDateTime(item.eligible_at)}</strong>
                        </div>
                        <div className="info-item">
                          <span className="label">Линия</span>
                          <strong>{item.snapshot?.lane || "—"}</strong>
                        </div>
                        <div className="info-item">
                          <span className="label">Статус дела</span>
                          <strong>{item.snapshot?.status || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {runResult && (
            <div className="empty-box" style={{ marginTop: 16 }}>
              Пакет выполнен. Успешно: {getRunSummaryCount(runResult, "success")} · waiting:{" "}
              {getRunSummaryCount(runResult, "waiting")} · blocked:{" "}
              {getRunSummaryCount(runResult, "blocked")} · errors:{" "}
              {getRunSummaryCount(runResult, "error") || getRunSummaryCount(runResult, "failed")}
            </div>
          )}
        </div>

        <aside className="batch-workspace-side">
          <div className="batch-side-card">
            <div className="batch-side-title">Как использовать batch</div>
            <div className="muted small">
              Сначала строй preview, затем запускай только однородный пакет по одной логике.
            </div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Rule of thumb</div>
            <div className="muted small">
              Не смешивай soft, court и enforcement в одном запуске.
            </div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Suggested subsets</div>
            <div className="muted small">
              Лучший режим — не гнать весь selection, а брать clean / recommended subset.
            </div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Waiting cases</div>
            <div className="muted small">
              Waiting — это не ошибка. Это будущая пропускная способность портфеля.
            </div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Blocked cases</div>
            <div className="muted small">
              Blocked — не повод включать force по умолчанию. Сначала устраняй blocker’ы.
            </div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Текущее действие</div>
            <div className="muted small">{actionLabel(actionCode)}</div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Selection mode</div>
            <div className="muted small">{activeSelectionLabel}</div>
          </div>

          <div className="batch-side-card">
            <div className="batch-side-title">Force execution</div>
            <div className="muted small">{force ? "Включён" : "Выключен"}</div>
          </div>
        </aside>
      </div>

      {previewBuilt && (
        <div className="participants-list" style={{ marginTop: 18 }}>
          <div className="participant-card">
            <div className="participant-card-top">
              <div>
                <div className="participant-role">Операционный вывод</div>
                <div className="participant-name">Что делать с этим пакетом</div>
              </div>
            </div>

            <div className="participant-meta-grid">
              <div className="info-item info-item-wide">
                <span className="label">Рекомендация</span>
                <strong>
                  {hasEligibleNow
                    ? "Пакет можно запускать. Лучше использовать recommended subset или хотя бы eligible subset."
                    : "В пакете нет дел, готовых к немедленному запуску. Сначала разберись с waiting, blocked и mixed cases."}
                </strong>
              </div>

              <div className="info-item">
                <span className="label">Action</span>
                <strong>{actionLabel(actionCode)}</strong>
              </div>

              <div className="info-item">
                <span className="label">Активное selection</span>
                <strong>{activeSelectionLabel}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
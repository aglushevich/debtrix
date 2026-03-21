import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCaseCommand,
  lookupOrganization,
  previewCaseCommandCreate,
  type CaseCommandCreatePayload,
  type CaseCommandCreatePreviewResponse,
} from "./api";

type Props = {
  onCreated?: (createdCase?: any) => void | Promise<void>;
};

const CONTRACT_TYPES = [
  { code: "supply", title: "Поставка" },
  { code: "rent", title: "Аренда" },
  { code: "services", title: "Услуги" },
  { code: "loan", title: "Займ" },
  { code: "contract", title: "Общий договор" },
];

const DEBTOR_TYPES = [
  { code: "company", title: "Юрлицо" },
  { code: "entrepreneur", title: "ИП" },
  { code: "individual", title: "Физлицо" },
];

type SmartPreview = CaseCommandCreatePreviewResponse["preview"] & {
  readiness?: {
    score?: number;
    level?: string;
    warnings?: string[];
    signals?: string[];
  };
  duplicates_found?: Array<{
    case_id?: number;
    name?: string | null;
    inn?: string | null;
    ogrn?: string | null;
  }>;
  organization?: Record<string, any> | null;
};

function readinessLabel(level?: string) {
  if (level === "ready") return "Готово";
  if (level === "partial") return "Частично готово";
  return "Черновик";
}

function readinessClass(level?: string) {
  if (level === "ready") return "is-ready";
  if (level === "partial") return "is-partial";
  return "is-draft";
}

function smartWarningLabel(code: string) {
  const map: Record<string, string> = {
    missing_debtor_name: "Не указано наименование должника",
    missing_inn: "Не указан ИНН",
    missing_due_date: "Не указан срок оплаты",
    missing_principal_amount: "Не указана сумма долга",
    missing_contract_type: "Не указан тип договора",
  };

  return map[code] || code;
}

function smartSignalLabel(code: string) {
  const map: Record<string, string> = {
    organization_resolved: "Организация успешно разрешена",
  };

  return map[code] || code;
}

export default function CreateCaseForm({ onCreated }: Props) {
  const [debtorType, setDebtorType] = useState("company");
  const [debtorName, setDebtorName] = useState("");
  const [contractType, setContractType] = useState("supply");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const [debtorInn, setDebtorInn] = useState("");
  const [debtorOgrn, setDebtorOgrn] = useState("");

  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [preview, setPreview] = useState<SmartPreview | null>(null);

  const previewTimerRef = useRef<number | null>(null);

  const commandPayload: CaseCommandCreatePayload = useMemo(
    () => ({
      debtor_type: debtorType,
      debtor_name: debtorName.trim() || undefined,
      contract_type: contractType,
      principal_amount: principalAmount.trim(),
      due_date: dueDate || null,
      note: note.trim() || undefined,
      debtor_inn: debtorInn.trim() || undefined,
      debtor_ogrn: debtorOgrn.trim() || undefined,
      auto_lookup_organization: true,
      auto_fill_debtor_name: true,
    }),
    [
      debtorType,
      debtorName,
      contractType,
      principalAmount,
      dueDate,
      note,
      debtorInn,
      debtorOgrn,
    ]
  );

  const readinessScore = Number(preview?.readiness?.score || 0);
  const readinessLevel = preview?.readiness?.level || "draft";
  const duplicateItems = preview?.duplicates_found || [];
  const warnings = preview?.warnings || preview?.readiness?.warnings || [];
  const signals = preview?.readiness?.signals || [];
  const resolvedOrganization = preview?.organization || null;

  async function handleLookupOrganization() {
    try {
      setLookupBusy(true);
      setMessage("");

      const found = await lookupOrganization({
        inn: debtorInn || undefined,
        ogrn: debtorOgrn || undefined,
      });

      if (found?.inn) setDebtorInn(found.inn);
      if (found?.ogrn) setDebtorOgrn(found.ogrn);
      if (found?.name_full || found?.name) {
        setDebtorName(found.name_full || found.name || "");
      }

      setMessage("Организация найдена и подставлена в форму.");
    } catch (e: any) {
      setMessage(e?.message || "Не удалось найти организацию.");
    } finally {
      setLookupBusy(false);
    }
  }

  async function loadPreview(payload: CaseCommandCreatePayload) {
    try {
      setPreviewBusy(true);

      const result = await previewCaseCommandCreate(payload);
      const nextPreview = (result?.preview || null) as SmartPreview;

      setPreview(nextPreview);

      if (nextPreview?.resolved_debtor_name && !debtorName.trim()) {
        setDebtorName(nextPreview.resolved_debtor_name);
      }

      if (nextPreview?.normalized_inn && !debtorInn.trim()) {
        setDebtorInn(nextPreview.normalized_inn);
      }

      if (nextPreview?.normalized_ogrn && !debtorOgrn.trim()) {
        setDebtorOgrn(nextPreview.normalized_ogrn);
      }
    } catch {
      setPreview(null);
    } finally {
      setPreviewBusy(false);
    }
  }

  useEffect(() => {
    const hasAnyInput =
      debtorName.trim() ||
      principalAmount.trim() ||
      dueDate ||
      debtorInn.trim() ||
      debtorOgrn.trim() ||
      note.trim();

    if (!hasAnyInput) {
      setPreview(null);
      return;
    }

    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }

    previewTimerRef.current = window.setTimeout(() => {
      void loadPreview(commandPayload);
    }, 450);

    return () => {
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, [commandPayload, debtorName, principalAmount, dueDate, debtorInn, debtorOgrn, note]);

  async function handleManualPreview() {
    try {
      setMessage("");
      const result = await previewCaseCommandCreate(commandPayload);
      const nextPreview = (result?.preview || null) as SmartPreview;
      setPreview(nextPreview);

      const nextWarnings =
        nextPreview?.warnings || nextPreview?.readiness?.warnings || [];

      if (nextWarnings.length) {
        setMessage("Проверка выполнена. Посмотри предупреждения ниже.");
      } else {
        setMessage("Проверка выполнена.");
      }
    } catch (e: any) {
      setMessage(e?.message || "Не удалось проверить создание.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setBusy(true);
      setMessage("");

      const result = await createCaseCommand(commandPayload);
      const created = result?.case;

      setDebtorName("");
      setPrincipalAmount("");
      setDueDate("");
      setNote("");
      setDebtorInn("");
      setDebtorOgrn("");
      setPreview(null);
      setMessage("Дело создано.");

      await onCreated?.(created);
    } catch (e: any) {
      setMessage(e?.message || "Не удалось создать дело.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sidebar-panel sidebar-panel-form sidebar-panel-create-case">
      <div className="sidebar-panel-header">
        <div>
          <div className="sidebar-panel-title">Новое дело</div>
          <div className="sidebar-panel-subtitle">
            Smart Case Creation для быстрого запуска кейса взыскания
          </div>
        </div>

        <div
          className={`smart-create-status-chip ${readinessClass(readinessLevel)}`}
          title={`Score: ${readinessScore}`}
        >
          {previewBusy ? "Проверка…" : readinessLabel(readinessLevel)}
        </div>
      </div>

      <form className="sidebar-form-grid" onSubmit={handleSubmit}>
        <div className="smart-create-score-card">
          <div className="smart-create-score-top">
            <div>
              <div className="smart-create-score-label">Readiness score</div>
              <div className="smart-create-score-value">{readinessScore}</div>
            </div>

            <div className={`smart-create-score-badge ${readinessClass(readinessLevel)}`}>
              {readinessLabel(readinessLevel)}
            </div>
          </div>

          <div className="smart-create-progress">
            <div
              className={`smart-create-progress-bar ${readinessClass(readinessLevel)}`}
              style={{ width: `${Math.max(6, Math.min(readinessScore, 100))}%` }}
            />
          </div>

          <div className="smart-create-score-caption">
            {readinessLevel === "ready" &&
              "Можно создавать: карточка заполнена достаточно хорошо."}
            {readinessLevel === "partial" &&
              "Создавать можно, но есть пробелы, которые лучше закрыть."}
            {readinessLevel === "draft" &&
              "Пока это черновик: заполни ключевые поля для более качественного кейса."}
          </div>
        </div>

        <div className="sidebar-form-row">
          <div>
            <div className="sidebar-field-label">Тип должника</div>
            <select
              className="sidebar-select-input"
              value={debtorType}
              onChange={(e) => setDebtorType(e.target.value)}
            >
              {DEBTOR_TYPES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="sidebar-field-label">Тип договора</div>
            <select
              className="sidebar-select-input"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
            >
              {CONTRACT_TYPES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sidebar-form-row sidebar-form-row-ids">
          <div>
            <div className="sidebar-field-label">ИНН</div>
            <input
              className="sidebar-text-input"
              placeholder="Например: 7701234567"
              value={debtorInn}
              onChange={(e) => setDebtorInn(e.target.value)}
            />
          </div>

          <div>
            <div className="sidebar-field-label">ОГРН</div>
            <input
              className="sidebar-text-input"
              placeholder="Например: 1027700000000"
              value={debtorOgrn}
              onChange={(e) => setDebtorOgrn(e.target.value)}
            />
          </div>
        </div>

        <div className="action-list">
          <button
            className="secondary-btn sidebar-secondary-btn"
            type="button"
            onClick={handleLookupOrganization}
            disabled={lookupBusy || (!debtorInn.trim() && !debtorOgrn.trim())}
          >
            {lookupBusy ? "Поиск…" : "Найти организацию"}
          </button>
        </div>

        <div>
          <div className="sidebar-field-label">Должник</div>
          <input
            className="sidebar-text-input"
            placeholder="Например: ООО Ромашка"
            value={debtorName}
            onChange={(e) => setDebtorName(e.target.value)}
            required
          />
        </div>

        <div className="sidebar-form-row sidebar-form-row-finance">
          <div>
            <div className="sidebar-field-label">Сумма долга</div>
            <input
              className="sidebar-text-input"
              placeholder="10000.00"
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(e.target.value)}
              required
            />
          </div>

          <div className="sidebar-date-field">
            <div className="sidebar-field-label">Срок оплаты</div>
            <input
              className="sidebar-text-input sidebar-date-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="sidebar-field-label">Комментарий</div>
          <textarea
            className="sidebar-textarea-input"
            placeholder="Дополнительные данные по кейсу"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {preview && (
          <div className="smart-create-preview-box">
            <div className="smart-create-preview-title">Smart preview</div>

            <div className="smart-create-preview-grid">
              <div className="smart-create-preview-item">
                <span>Разрешённый должник</span>
                <strong>{preview.resolved_debtor_name || "—"}</strong>
              </div>

              <div className="smart-create-preview-item">
                <span>Нормализованный ИНН</span>
                <strong>{preview.normalized_inn || "—"}</strong>
              </div>

              <div className="smart-create-preview-item">
                <span>Нормализованный ОГРН</span>
                <strong>{preview.normalized_ogrn || "—"}</strong>
              </div>
            </div>

            {resolvedOrganization && (
              <div className="smart-create-info-block">
                <div className="smart-create-info-title">Организация</div>
                <div className="smart-create-preview-grid">
                  <div className="smart-create-preview-item">
                    <span>Наименование</span>
                    <strong>
                      {resolvedOrganization?.name_full ||
                        resolvedOrganization?.name ||
                        "—"}
                    </strong>
                  </div>

                  <div className="smart-create-preview-item">
                    <span>ИНН</span>
                    <strong>{String(resolvedOrganization?.inn || "—")}</strong>
                  </div>

                  <div className="smart-create-preview-item">
                    <span>ОГРН</span>
                    <strong>{String(resolvedOrganization?.ogrn || "—")}</strong>
                  </div>
                </div>
              </div>
            )}

            {!!signals.length && (
              <div className="smart-create-info-block">
                <div className="smart-create-info-title">Сигналы</div>
                <div className="smart-create-chip-list">
                  {signals.map((item, index) => (
                    <span key={`${item}:${index}`} className="smart-create-chip">
                      {smartSignalLabel(item)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!!warnings.length && (
              <div className="smart-create-info-block smart-create-info-block-warning">
                <div className="smart-create-info-title">Предупреждения</div>
                <ul className="smart-create-list">
                  {warnings.map((item, index) => (
                    <li key={`${item}:${index}`}>{smartWarningLabel(item)}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!duplicateItems.length && (
              <div className="smart-create-info-block smart-create-info-block-duplicate">
                <div className="smart-create-info-title">Возможные дубликаты</div>
                <div className="smart-create-duplicate-list">
                  {duplicateItems.map((item, index) => (
                    <div
                      key={`${item.case_id || index}-${item.inn || ""}-${item.ogrn || ""}`}
                      className="smart-create-duplicate-card"
                    >
                      <strong>{item.name || "Без названия"}</strong>
                      <div className="muted small">
                        Дело #{item.case_id || "—"}
                        {item.inn ? ` · ИНН ${item.inn}` : ""}
                        {item.ogrn ? ` · ОГРН ${item.ogrn}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="action-list action-list-stretch">
          <button
            className="secondary-btn"
            type="button"
            onClick={handleManualPreview}
            disabled={previewBusy}
          >
            {previewBusy ? "Проверяем…" : "Обновить preview"}
          </button>

          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? "Создаём…" : "Создать дело"}
          </button>
        </div>

        {message && <div className="sidebar-form-message">{message}</div>}
      </form>
    </section>
  );
}
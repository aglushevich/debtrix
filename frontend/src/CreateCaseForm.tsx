import { useState } from "react";
import { createCase } from "./api";

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

export default function CreateCaseForm({ onCreated }: Props) {
  const [debtorType, setDebtorType] = useState("company");
  const [debtorName, setDebtorName] = useState("");
  const [contractType, setContractType] = useState("supply");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setBusy(true);
      setMessage("");

      const payload = {
        debtor_type: debtorType,
        debtor_name: debtorName.trim(),
        contract_type: contractType,
        principal_amount: principalAmount.trim(),
        due_date: dueDate || null,
        contract_data: note.trim()
          ? {
              note: note.trim(),
            }
          : {},
      };

      const created = await createCase(payload);

      setDebtorName("");
      setPrincipalAmount("");
      setDueDate("");
      setNote("");
      setMessage("Дело создано.");

      await onCreated?.(created);
    } catch (e: any) {
      setMessage(e?.message || "Не удалось создать дело.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sidebar-panel sidebar-panel-form">
      <div className="sidebar-panel-header">
        <div>
          <div className="sidebar-panel-title">Новое дело</div>
          <div className="sidebar-panel-subtitle">
            Быстрое создание кейса взыскания
          </div>
        </div>
      </div>

      <form className="sidebar-form-grid" onSubmit={handleSubmit}>
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

        <div className="sidebar-form-row">
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

          <div>
            <div className="sidebar-field-label">Срок оплаты</div>
            <input
              className="sidebar-text-input"
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

        <div className="action-list">
          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? "Создаём…" : "Создать дело"}
          </button>
        </div>

        {message && <div className="sidebar-form-message">{message}</div>}
      </form>
    </section>
  );
}
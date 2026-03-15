import { useEffect, useState } from "react";
import {
  addPayment,
  getRecovery,
  initRecovery,
  patchAccrued,
} from "./api";

type Props = {
  caseId: number | null;
};

function stringifyValue(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "—";
    }
  }
  return String(value);
}

export default function RecoveryPanel({ caseId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [accruedKey, setAccruedKey] = useState("penalty");
  const [accruedValue, setAccruedValue] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  async function load() {
    if (!caseId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await getRecovery(caseId);
      setData(result);
    } catch (e: any) {
      setData(null);
      setError(e?.message || "Recovery ещё не инициализирован.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [caseId]);

  async function handleInit() {
    if (!caseId) return;

    try {
      setBusy("init");
      setError("");
      await initRecovery(caseId);
      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось инициализировать recovery");
    } finally {
      setBusy("");
    }
  }

  async function handlePatchAccrued() {
    if (!caseId || !accruedKey.trim() || !accruedValue.trim()) return;

    try {
      setBusy("accrued");
      setError("");
      await patchAccrued(caseId, {
        [accruedKey.trim()]: accruedValue.trim(),
      });
      setAccruedValue("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось обновить начисления");
    } finally {
      setBusy("");
    }
  }

  async function handleAddPayment() {
    if (!caseId || !paymentAmount.trim()) return;

    try {
      setBusy("payment");
      setError("");
      await addPayment(caseId, paymentAmount.trim());
      setPaymentAmount("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось добавить платёж");
    } finally {
      setBusy("");
    }
  }

  if (!caseId) return null;

  const recovery = data?.recovery || {};
  const components = recovery?.components || {};
  const summaryEntries = Object.entries(recovery || {}).filter(
    ([key]) => key !== "components"
  );
  const componentEntries = Object.entries(components);

  return (
    <section className="panel">
      <div className="panel-title">Recovery</div>

      <div className="action-list" style={{ marginBottom: 16 }}>
        <button
          className="secondary-btn"
          onClick={handleInit}
          disabled={busy === "init"}
        >
          {busy === "init" ? "Инициализация…" : "Инициализировать recovery"}
        </button>
      </div>

      {loading && <div className="empty-box">Загрузка recovery…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && data && (
        <>
          <div className="recovery-grid" style={{ marginBottom: 16 }}>
            {summaryEntries.length ? (
              summaryEntries.map(([key, value]) => (
                <div className="info-item" key={key}>
                  <span className="label">{key}</span>
                  <strong>{stringifyValue(value)}</strong>
                </div>
              ))
            ) : (
              <div className="empty-box">Сводка recovery пока пуста.</div>
            )}
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-title">Компоненты начислений</div>

            {componentEntries.length ? (
              <div className="participants-list">
                {componentEntries.map(([key, value]) => (
                  <div className="participant-card" key={key}>
                    <div className="participant-card-top">
                      <div>
                        <div className="participant-role">Компонент</div>
                        <div className="participant-name">{key}</div>
                      </div>
                    </div>

                    <div className="info-item info-item-wide" style={{ marginTop: 12 }}>
                      <span className="label">Данные</span>
                      <strong className="code-block">
                        {stringifyValue(value)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-box">Компоненты начислений пока не заданы.</div>
            )}
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <div className="panel-title">Обновить начисление</div>

              <div className="form-grid">
                <input
                  className="text-input"
                  placeholder="Ключ компонента, например penalty"
                  value={accruedKey}
                  onChange={(e) => setAccruedKey(e.target.value)}
                />

                <input
                  className="text-input"
                  placeholder="Сумма начисления"
                  value={accruedValue}
                  onChange={(e) => setAccruedValue(e.target.value)}
                />

                <div className="action-list">
                  <button
                    className="secondary-btn"
                    onClick={handlePatchAccrued}
                    disabled={busy === "accrued"}
                  >
                    {busy === "accrued" ? "Сохраняем…" : "Обновить начисление"}
                  </button>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Добавить платёж</div>

              <div className="form-grid">
                <input
                  className="text-input"
                  placeholder="Сумма платежа"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />

                <div className="action-list">
                  <button
                    className="primary-btn"
                    onClick={handleAddPayment}
                    disabled={busy === "payment"}
                  >
                    {busy === "payment" ? "Добавляем…" : "Добавить платёж"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
import { useEffect, useMemo, useState } from "react";
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

function formatMoneyLike(value: any) {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return String(value ?? "—");

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

  const recovery = data?.recovery || data || {};
  const components = recovery?.components || {};
  const summaryEntries = Object.entries(recovery || {}).filter(([key]) => key !== "components");
  const componentEntries = Object.entries(components);

  const kpiCards = useMemo(() => {
    const preferredKeys = [
      "principal_amount",
      "penalty_amount",
      "interest_amount",
      "total_amount",
      "outstanding_amount",
      "status",
    ];

    const existing = preferredKeys
      .filter((key) => key in recovery)
      .map((key) => [key, recovery[key]] as [string, any]);

    return existing.slice(0, 6);
  }, [recovery]);

  if (!caseId) return null;

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Recovery accounting</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Recovery
          </div>
          <div className="muted">
            Учёт начислений, платежей и агрегированной recovery-сводки по делу.
          </div>
        </div>
      </div>

      <div className="action-list" style={{ marginTop: 16, marginBottom: 16 }}>
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
          {kpiCards.length > 0 && (
            <div className="portfolio-mini-stats" style={{ marginBottom: 16 }}>
              {kpiCards.map(([key, value]) => (
                <div className="portfolio-mini-stat" key={key}>
                  <span>{key}</span>
                  <strong>
                    {typeof value === "number" || /^[\d.,]+$/.test(String(value ?? ""))
                      ? formatMoneyLike(value)
                      : stringifyValue(value)}
                  </strong>
                </div>
              ))}
            </div>
          )}

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

          <section className="panel panel-nested" style={{ marginBottom: 16 }}>
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
                      <strong className="code-block">{stringifyValue(value)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-box">Компоненты начислений пока не заданы.</div>
            )}
          </section>

          <div className="dashboard-grid">
            <section className="panel panel-nested">
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
            </section>

            <section className="panel panel-nested">
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
            </section>
          </div>
        </>
      )}
    </section>
  );
}
import { useEffect, useMemo, useState } from "react";
import { addPayment, getRecovery, initRecovery, patchAccrued } from "./api";

type Props = {
  caseId: number | null;
};

function formatMoneyLike(value: any) {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return String(value ?? "—");

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU");
}

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

function metricLabel(key: string) {
  const map: Record<string, string> = {
    principal_amount: "Основной долг",
    penalty_amount: "Неустойка",
    interest_amount: "Проценты",
    total_amount: "Итого начислено",
    outstanding_amount: "Остаток к взысканию",
    payments_total: "Оплачено",
    status: "Статус recovery",
  };

  return map[key] || key;
}

function componentLabel(key: string) {
  const map: Record<string, string> = {
    principal: "Основной долг",
    penalty: "Неустойка",
    interest: "Проценты",
    state_fee: "Госпошлина",
    costs: "Расходы",
  };

  return map[key] || key;
}

function isMoneyLikeKey(key: string) {
  return [
    "principal_amount",
    "penalty_amount",
    "interest_amount",
    "total_amount",
    "outstanding_amount",
    "payments_total",
    "principal",
    "penalty",
    "interest",
    "state_fee",
    "costs",
    "amount",
  ].includes(key);
}

function recoveryStatusLabel(value?: string) {
  const map: Record<string, string> = {
    active: "Активно",
    draft: "Черновик",
    closed: "Закрыто",
    paid: "Погашено",
    overdue: "Просрочено",
  };

  return map[String(value || "")] || value || "—";
}

function recoveryStatusClass(value?: string) {
  const map: Record<string, string> = {
    active: "status-pretrial",
    draft: "status-draft",
    closed: "status-ready",
    paid: "status-ready",
    overdue: "status-overdue",
  };

  return map[String(value || "")] || "status-draft";
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
      setData(result || null);
    } catch (e: any) {
      setData(null);
      setError(e?.message || "Recovery ещё не инициализирован.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  async function handleInit() {
    if (!caseId) return;

    try {
      setBusy("init");
      setError("");
      await initRecovery(caseId);
      await load();
    } catch (e: any) {
      setError(e?.message || "Не удалось инициализировать recovery.");
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
      setError(e?.message || "Не удалось обновить начисления.");
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
      setError(e?.message || "Не удалось добавить платёж.");
    } finally {
      setBusy("");
    }
  }

  const recovery = data?.recovery || data || {};
  const components = recovery?.components || {};
  const payments = Array.isArray(recovery?.payments) ? recovery.payments : [];

  const heroCards = useMemo(() => {
    const preferredKeys = [
      "principal_amount",
      "total_amount",
      "payments_total",
      "outstanding_amount",
    ];

    return preferredKeys
      .filter((key) => key in recovery)
      .map((key) => [key, recovery[key]] as [string, any]);
  }, [recovery]);

  const summaryEntries = useMemo(() => {
    return Object.entries(recovery || {}).filter(
      ([key]) => !["components", "payments"].includes(key)
    );
  }, [recovery]);

  const componentEntries = useMemo(() => {
    return Object.entries(components || {});
  }, [components]);

  const paymentsTotal = useMemo(() => {
    return payments.reduce((acc: number, item: any) => {
      const value = Number(String(item?.amount ?? 0).replace(",", "."));
      return acc + (Number.isFinite(value) ? value : 0);
    }, 0);
  }, [payments]);

  if (!caseId) return null;

  return (
    <section className="panel case-embedded-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Recovery accounting</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Recovery
          </div>
          <div className="muted">
            Учёт начислений, платежей и остатка к взысканию по делу.
          </div>
        </div>

        <div className="action-list">
          <button
            className="secondary-btn"
            onClick={handleInit}
            disabled={busy === "init"}
          >
            {busy === "init" ? "Инициализация…" : "Инициализировать recovery"}
          </button>

          <button
            className="secondary-btn"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>
      </div>

      {loading && <div className="empty-box">Загрузка recovery…</div>}
      {!loading && error && <div className="empty-box">{error}</div>}

      {!loading && data && (
        <>
          {heroCards.length > 0 && (
            <div className="portfolio-mini-stats recovery-kpi-grid" style={{ marginBottom: 16 }}>
              {heroCards.map(([key, value]) => (
                <div className="portfolio-mini-stat" key={key}>
                  <span>{metricLabel(key)}</span>
                  <strong>
                    {isMoneyLikeKey(key)
                      ? `${formatMoneyLike(value)} ₽`
                      : stringifyValue(value)}
                  </strong>
                </div>
              ))}

              {"status" in recovery && (
                <div className="portfolio-mini-stat">
                  <span>Статус recovery</span>
                  <strong>{recoveryStatusLabel(recovery.status)}</strong>
                </div>
              )}
            </div>
          )}

          <div className="dashboard-grid dashboard-grid-secondary">
            <section className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Сводка recovery</div>

              <div className="info-grid">
                {summaryEntries.length ? (
                  summaryEntries.map(([key, value]) => (
                    <div className="info-item" key={key}>
                      <span className="label">{metricLabel(key)}</span>
                      <strong>
                        {key === "status"
                          ? recoveryStatusLabel(String(value || ""))
                          : isMoneyLikeKey(key)
                            ? `${formatMoneyLike(value)} ₽`
                            : stringifyValue(value)}
                      </strong>
                    </div>
                  ))
                ) : (
                  <div className="empty-box">Сводка recovery пока пуста.</div>
                )}
              </div>
            </section>

            <section className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="panel-title">Компоненты начислений</div>

              {componentEntries.length ? (
                <div className="participants-list">
                  {componentEntries.map(([key, value]) => (
                    <div className="participant-card" key={key}>
                      <div className="participant-card-top">
                        <div>
                          <div className="participant-role">Компонент</div>
                          <div className="participant-name">{componentLabel(key)}</div>
                        </div>

                        <div className="participant-badges">
                          <span className="status-badge status-pretrial">{key}</span>
                        </div>
                      </div>

                      <div className="participant-meta-grid">
                        <div className="info-item">
                          <span className="label">Ключ</span>
                          <strong>{key}</strong>
                        </div>

                        <div className="info-item">
                          <span className="label">Значение</span>
                          <strong>
                            {isMoneyLikeKey(key)
                              ? `${formatMoneyLike(value)} ₽`
                              : stringifyValue(value)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-box">Компоненты начислений пока не заданы.</div>
              )}
            </section>
          </div>

          <div className="dashboard-grid dashboard-grid-secondary" style={{ marginTop: 16 }}>
            <section className="panel panel-nested" style={{ marginBottom: 0 }}>
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

            <section className="panel panel-nested" style={{ marginBottom: 0 }}>
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

          <section className="panel panel-nested" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="panel-title">Платежи</div>

            <div className="debtor-cases-summary" style={{ marginBottom: 16 }}>
              <div className="summary-card">
                <span className="label">Количество платежей</span>
                <strong>{payments.length}</strong>
              </div>

              <div className="summary-card">
                <span className="label">Сумма платежей</span>
                <strong>{formatMoneyLike(paymentsTotal)} ₽</strong>
              </div>
            </div>

            {payments.length ? (
              <div className="participants-list">
                {payments.map((item: any, index: number) => (
                  <div
                    className="participant-card"
                    key={`${item?.id || "payment"}-${index}`}
                  >
                    <div className="participant-card-top">
                      <div>
                        <div className="participant-role">Платёж</div>
                        <div className="participant-name">
                          {item?.amount ? `${formatMoneyLike(item.amount)} ₽` : "—"}
                        </div>
                      </div>

                      <div className="participant-badges">
                        <span className="status-badge status-ready">
                          {item?.source || "manual"}
                        </span>
                      </div>
                    </div>

                    <div className="participant-meta-grid">
                      <div className="info-item">
                        <span className="label">Дата</span>
                        <strong>{formatDateTime(item?.created_at || item?.paid_at)}</strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Источник</span>
                        <strong>{item?.source || "—"}</strong>
                      </div>

                      <div className="info-item info-item-wide">
                        <span className="label">Комментарий</span>
                        <strong>{item?.comment || item?.note || "—"}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-box">Платежи по делу пока не зафиксированы.</div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { WaitingBucketItem, getWaitingBuckets } from "./api";

type Props = {
  onOpenCase: (caseId: number) => void;
};

function formatStep(step?: string) {
  const map: Record<string, string> = {
    payment_due_notice: "1-е напоминание",
    debt_notice: "Уведомление о задолженности",
    pretension: "Досудебная претензия",
    submit_to_court: "Подача в суд",
  };
  return map[step || ""] || step || "—";
}

export default function WaitingBucketsPanel({ onOpenCase }: Props) {
  const [items, setItems] = useState<WaitingBucketItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const result = await getWaitingBuckets();
      setItems(result?.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="panel">
      <div className="panel-title">Waiting Buckets</div>

      {loading && <div className="empty-box">Загрузка waiting buckets…</div>}

      {!loading && !items.length && (
        <div className="empty-box">Ожидающих кейсов сейчас нет.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="participants-list">
          {items.map((item) => (
            <button
              key={`${item.case_id}:${item.step_code}:${item.eligible_at}`}
              className="related-case-card"
              onClick={() => onOpenCase(item.case_id)}
            >
              <div className="related-case-top">
                <strong>Дело #{item.case_id}</strong>
                <span className="status-badge status-not-ready">Waiting</span>
              </div>

              <div className="muted">{item.debtor_name || "—"}</div>
              <div className="muted small">
                Шаг: {formatStep(item.step_code)} · Сумма: {item.principal_amount || "—"} ₽
              </div>
              <div className="muted small">
                Eligible at: {item.eligible_at || "—"}
              </div>
              <div className="muted small">{item.reason || "—"}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
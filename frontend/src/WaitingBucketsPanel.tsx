import { useEffect, useMemo, useState } from "react";
import { WaitingBucketItem, getWaitingBuckets } from "./api";

type Props = {
  onOpenCase: (caseId: number) => void;
};

function formatStep(step?: string) {
  const map: Record<string, string> = {
    payment_due_notice: "1-е напоминание",
    debt_notice: "Уведомление о задолженности",
    pretension: "Досудебная претензия",
    generate_lawsuit: "Подготовка иска",
    submit_to_court: "Подача в суд",
    send_to_fssp: "Отправка в ФССП",
  };
  return map[step || ""] || step || "—";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU");
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

  const grouped = useMemo(() => {
    const map = new Map<string, WaitingBucketItem[]>();

    for (const item of items) {
      const key = String(item.step_code || "unknown");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    return [...map.entries()];
  }, [items]);

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Waiting capacity</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Waiting Buckets
          </div>
          <div className="muted">
            Кейсы, которые ещё не готовы к действию, но уже находятся в очереди будущей
            пропускной способности.
          </div>
        </div>
      </div>

      {loading && <div className="empty-box">Загрузка waiting buckets…</div>}

      {!loading && !items.length && (
        <div className="empty-box">Ожидающих кейсов сейчас нет.</div>
      )}

      {!loading && grouped.length > 0 && (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {grouped.map(([step, stepItems]) => (
            <div key={step} className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <div>
                  <div className="panel-title" style={{ marginBottom: 6 }}>
                    {formatStep(step)}
                  </div>
                  <div className="muted small">Кейсов в ожидании: {stepItems.length}</div>
                </div>
              </div>

              <div className="participants-list" style={{ marginTop: 12 }}>
                {stepItems.map((item) => (
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
                      Сумма: {item.principal_amount || "—"} ₽
                    </div>

                    <div className="muted small">
                      Eligible at: {formatDateTime(item.eligible_at)}
                    </div>

                    <div className="muted small" style={{ marginTop: 6 }}>
                      {item.reason || "Ожидает наступления условий выполнения"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
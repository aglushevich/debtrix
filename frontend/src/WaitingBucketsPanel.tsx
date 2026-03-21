import { useEffect, useMemo, useState } from "react";
import { WaitingBucketItem, getWaitingBuckets } from "./api";
import {
  buildWaitingHint,
  formatEligibleAt,
  formatWaitingStep,
  waitingBadgeLabel,
} from "./waitingEngine";

export type WaitingPreset = "waiting_next";

type Props = {
  onOpenCase: (caseId: number) => void;
  onOpenPreset?: (preset: WaitingPreset) => void;
};

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function WaitingBucketsPanel({ onOpenCase, onOpenPreset }: Props) {
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

    return [...map.entries()].map(([step, stepItems]) => [
      step,
      [...stepItems].sort((a, b) => {
        const aTime = a.eligible_at ? new Date(a.eligible_at).getTime() : 0;
        const bTime = b.eligible_at ? new Date(b.eligible_at).getTime() : 0;
        return aTime - bTime;
      }),
    ]) as Array<[string, WaitingBucketItem[]]>;
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
            Кейсы, которые ещё не готовы к действию, но уже формируют будущую
            пропускную способность портфеля.
          </div>
        </div>
      </div>

      {!!onOpenPreset && (
        <div className="action-list" style={{ marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" className="secondary-btn" onClick={() => onOpenPreset("waiting_next")}>
            ⏳ Открыть waiting в registry ({items.length})
          </button>
        </div>
      )}

      {loading && <div className="empty-box">Загрузка waiting buckets…</div>}

      {!loading && !items.length && (
        <div className="empty-box">
          Ожидающих кейсов сейчас нет.
          <div className="muted small" style={{ marginTop: 8 }}>
            Это хороший знак: в портфеле нет накопленного waiting backlog.
          </div>
        </div>
      )}

      {!loading && grouped.length > 0 && (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {grouped.map(([step, stepItems]) => (
            <div key={step} className="panel panel-nested" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <div>
                  <div className="panel-title" style={{ marginBottom: 6 }}>
                    {formatWaitingStep(step)}
                  </div>
                  <div className="muted small">Кейсов в ожидании: {stepItems.length}</div>
                </div>

                {!!onOpenPreset && (
                  <div className="action-list">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => onOpenPreset("waiting_next")}
                    >
                      Весь waiting registry
                    </button>
                  </div>
                )}
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
                      <span className="status-badge status-not-ready">
                        {waitingBadgeLabel(item)}
                      </span>
                    </div>

                    <div className="muted">{item.debtor_name || "—"}</div>

                    <div className="muted small">
                      Сумма: {formatMoney(item.principal_amount)} ₽
                    </div>

                    <div className="muted small">
                      Eligible at: {formatEligibleAt(item.eligible_at)}
                    </div>

                    <div className="muted small" style={{ marginTop: 6 }}>
                      {buildWaitingHint(item)}
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
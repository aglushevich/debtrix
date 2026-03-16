type Props = {
  items?: any[];
  onOpenCase: (caseId: number) => void;
};

function formatStep(step?: string) {
  const map: Record<string, string> = {
    payment_due_notice: "1-е напоминание",
    debt_notice: "Уведомление о задолженности",
    pretension: "Досудебная претензия",
    submit_to_court: "Подача в суд",
    prepare_fssp_application: "Подготовка в ФССП",
  };
  return map[step || ""] || step || "—";
}

export default function WaitingFocusPanel({ items = [], onOpenCase }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">Waiting Focus</div>

      {!items.length ? (
        <div className="empty-box">Waiting bucket сейчас пуст.</div>
      ) : (
        <div className="participants-list">
          {items.slice(0, 8).map((item) => (
            <button
              key={`${item.case_id}:${item.step_code}:${item.eligible_at}`}
              className="related-case-card"
              onClick={() => onOpenCase(item.case_id)}
            >
              <div className="related-case-top">
                <strong>Дело #{item.case_id}</strong>
                <span className="status-badge status-draft">Waiting</span>
              </div>

              <div className="muted">{item.debtor_name || "—"}</div>

              <div className="muted small">
                Шаг: {formatStep(item.step_code)} · {item.principal_amount || "—"} ₽
              </div>

              <div className="muted small">
                Eligible at: {item.eligible_at || "—"}
              </div>

              <div className="muted small">
                {item.reason || "Ожидание выполнения правила"}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
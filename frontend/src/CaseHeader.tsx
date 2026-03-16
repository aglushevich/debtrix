import { formatCaseStatus } from "./legalLabels";

type Props = {
  selectedCase: number | null;
  selectedCaseCard: any;
  dashboard: any;
};

export default function CaseHeader({
  selectedCase,
  selectedCaseCard,
  dashboard,
}: Props) {
  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <div className="info-item">
          <span className="label">Активное дело</span>
          <strong>№{selectedCase ?? "—"}</strong>
        </div>

        <div className="info-item">
          <span className="label">Должник</span>
          <strong>{selectedCaseCard?.debtor_name || dashboard?.case?.debtor_name || "—"}</strong>
        </div>

        <div className="info-item">
          <span className="label">Статус дела</span>
          <strong>
            {dashboard?.case?.status_title || formatCaseStatus(dashboard?.case?.status)}
          </strong>
        </div>

        <div className="info-item">
          <span className="label">Следующее действие</span>
          <strong>
            {dashboard?.next_step?.title_ru || dashboard?.next_step?.title || "—"}
          </strong>
        </div>
      </div>
    </section>
  );
}
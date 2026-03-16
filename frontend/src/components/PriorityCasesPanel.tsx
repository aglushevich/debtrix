type Props = {
  cases: any[];
  onOpen: (id:number)=>void;
};

export default function PriorityCasesPanel({ cases, onOpen }: Props) {

  if (!cases?.length)
    return <div className="panel">Нет приоритетных дел</div>;

  return (
    <div className="panel">

      <div className="panel-title">
        Приоритетные дела
      </div>

      {cases.map(c => (
        <div
          key={c.case_id}
          className="priority-row"
          onClick={() => onOpen(c.case_id)}
        >

          <div className="priority-left">

            <div className="priority-title">
              {c.debtor_name}
            </div>

            <div className="priority-meta">
              {c.contract_type} · {c.principal_amount} ₽
            </div>

          </div>

          <div className="priority-right">

            <div className={`risk risk-${c.risk_level}`}>
              Risk {c.risk_score}
            </div>

          </div>

        </div>
      ))}

    </div>
  );
}
type Props = {
  summary: any;
};

export default function KpiDashboard({ summary }: Props) {
  if (!summary) return null;

  return (
    <div className="kpi-grid">

      <div className="kpi-card">
        <div className="kpi-title">Всего дел</div>
        <div className="kpi-value">{summary.total_cases}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Черновики</div>
        <div className="kpi-value">{summary.draft_cases}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Просрочено</div>
        <div className="kpi-value">{summary.overdue_cases}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Досудебно</div>
        <div className="kpi-value">{summary.pretrial_cases}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Суд</div>
        <div className="kpi-value">{summary.court_cases}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">ФССП</div>
        <div className="kpi-value">{summary.fssp_cases}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">Сумма портфеля</div>
        <div className="kpi-value">
          {summary.total_principal_amount} ₽
        </div>
      </div>

    </div>
  );
}
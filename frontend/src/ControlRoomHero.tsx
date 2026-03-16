type Props = {
  summary?: any;
  intelligenceKpi?: any;
  selectedCount?: number;
  selectedAmount?: string;
};

function stat(value: any, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export default function ControlRoomHero({
  summary,
  intelligenceKpi,
  selectedCount = 0,
  selectedAmount = "0.00",
}: Props) {
  const avgRisk = intelligenceKpi?.avg_risk_score ?? intelligenceKpi?.avgRisk ?? 0;
  const highRisk = intelligenceKpi?.high_risk_cases ?? 0;
  const critical = intelligenceKpi?.critical_cases ?? 0;
  const blockedHighRisk = intelligenceKpi?.blocked_high_risk_cases ?? 0;

  return (
    <section className="control-hero">
      <div className="control-hero-main">
        <div className="control-hero-label">Recovery Control Room</div>
        <h2>Операционный центр взыскания</h2>
        <p>
          Единая панель для приоритизации портфеля, batch-обработки,
          intelligence-сигналов и контроля waiting / blocked / ready потоков.
        </p>

        <div className="control-hero-meta">
          <div className="hero-mini-card">
            <span>Всего дел</span>
            <strong>{stat(summary?.total_cases)}</strong>
          </div>
          <div className="hero-mini-card">
            <span>Просрочка сейчас</span>
            <strong>{stat(summary?.overdue_now_cases)}</strong>
          </div>
          <div className="hero-mini-card">
            <span>Общая сумма</span>
            <strong>{stat(summary?.total_principal_amount, "0.00")} ₽</strong>
          </div>
          <div className="hero-mini-card">
            <span>Средний чек</span>
            <strong>{stat(summary?.average_principal_amount, "0.00")} ₽</strong>
          </div>
        </div>
      </div>

      <div className="control-hero-side">
        <div className="hero-score-card">
          <div className="hero-score-label">Средний risk score</div>
          <div className="hero-score-value">{avgRisk}</div>
          <div className="hero-score-subtitle">интегральный intelligence по портфелю</div>
        </div>

        <div className="hero-side-grid">
          <div className="hero-side-item">
            <span>High risk</span>
            <strong>{highRisk}</strong>
          </div>
          <div className="hero-side-item">
            <span>Critical</span>
            <strong>{critical}</strong>
          </div>
          <div className="hero-side-item">
            <span>Blocked high risk</span>
            <strong>{blockedHighRisk}</strong>
          </div>
          <div className="hero-side-item">
            <span>Выбрано в пакет</span>
            <strong>{selectedCount}</strong>
          </div>
        </div>

        <div className="hero-selected-box">
          <span>Сумма выбранного пакета</span>
          <strong>{selectedAmount} ₽</strong>
        </div>
      </div>
    </section>
  );
}
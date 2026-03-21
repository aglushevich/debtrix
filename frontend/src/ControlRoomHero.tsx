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

function formatNumber(value: any, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  });
}

function healthLabel(score: number) {
  if (score >= 85) return "Сильное состояние";
  if (score >= 65) return "Устойчивое состояние";
  if (score >= 45) return "Нужен контроль";
  return "Требуется стабилизация";
}

export default function ControlRoomHero({
  summary,
  intelligenceKpi,
  selectedCount = 0,
  selectedAmount = "0.00",
}: Props) {
  const avgRisk = intelligenceKpi?.avg_risk_score ?? intelligenceKpi?.avgRisk ?? 0;
  const avgPriority = intelligenceKpi?.avg_priority_score ?? 0;
  const highRisk = intelligenceKpi?.high_risk_cases ?? 0;
  const critical = intelligenceKpi?.critical_cases ?? 0;
  const blockedHighRisk = intelligenceKpi?.blocked_high_risk_cases ?? 0;
  const readyNow = intelligenceKpi?.ready_now_cases ?? 0;
  const waitingCases = intelligenceKpi?.waiting_cases ?? 0;
  const blockedCases = intelligenceKpi?.blocked_cases ?? summary?.blocked_cases ?? 0;
  const readyPressure = intelligenceKpi?.ready_pressure ?? 0;
  const waitingPressure = intelligenceKpi?.waiting_pressure ?? 0;
  const blockedPressure = intelligenceKpi?.blocked_pressure ?? 0;
  const healthScore = intelligenceKpi?.portfolio_health_score ?? 0;

  return (
    <section className="control-hero">
      <div className="control-hero-main">
        <div className="control-hero-label">Recovery Control Room</div>
        <h2>Операционный центр взыскания</h2>
        <p>
          Единая панель для приоритизации портфеля, batch-обработки,
          intelligence-сигналов и контроля ready / waiting / blocked потоков.
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
          <div className="hero-score-label">Portfolio health score</div>
          <div className="hero-score-value">{formatNumber(healthScore)}</div>
          <div className="hero-score-subtitle">{healthLabel(Number(healthScore || 0))}</div>
        </div>

        <div className="hero-side-grid">
          <div className="hero-side-item">
            <span>Ready now</span>
            <strong>{readyNow}</strong>
          </div>

          <div className="hero-side-item">
            <span>Waiting</span>
            <strong>{waitingCases}</strong>
          </div>

          <div className="hero-side-item">
            <span>Blocked</span>
            <strong>{blockedCases}</strong>
          </div>

          <div className="hero-side-item">
            <span>Выбрано в пакет</span>
            <strong>{selectedCount}</strong>
          </div>
        </div>

        <div className="hero-side-grid" style={{ marginTop: 12 }}>
          <div className="hero-side-item">
            <span>Avg risk</span>
            <strong>{formatNumber(avgRisk)}</strong>
          </div>

          <div className="hero-side-item">
            <span>Avg priority</span>
            <strong>{formatNumber(avgPriority)}</strong>
          </div>

          <div className="hero-side-item">
            <span>High risk</span>
            <strong>{highRisk}</strong>
          </div>

          <div className="hero-side-item">
            <span>Critical</span>
            <strong>{critical}</strong>
          </div>
        </div>

        <div className="hero-side-grid" style={{ marginTop: 12 }}>
          <div className="hero-side-item">
            <span>Ready pressure</span>
            <strong>{formatNumber(readyPressure)}</strong>
          </div>

          <div className="hero-side-item">
            <span>Waiting pressure</span>
            <strong>{formatNumber(waitingPressure)}</strong>
          </div>

          <div className="hero-side-item">
            <span>Blocked pressure</span>
            <strong>{formatNumber(blockedPressure)}</strong>
          </div>

          <div className="hero-side-item">
            <span>Blocked high risk</span>
            <strong>{blockedHighRisk}</strong>
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
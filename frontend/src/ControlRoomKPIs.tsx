type Props = {
  dashboard?: any;
  portfolioStats: {
    total: number;
    draft: number;
    overdue: number;
    pretrial: number;
    court: number;
    fssp: number;
    closed: number;
    totalAmount: number;
  };
  selectedCaseIds: number[];
};

function formatMoney(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMetric(value: number): string {
  return value.toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  });
}

export default function ControlRoomKPIs({
  dashboard,
  portfolioStats,
  selectedCaseIds,
}: Props) {
  const summary = dashboard?.summary || {};
  const routingSummary = dashboard?.routing?.summary || {};
  const intelligenceKpi = dashboard?.intelligence_kpi || {};

  const totalCases = summary.total_cases ?? portfolioStats.total;
  const overdueCases = summary.overdue_cases ?? portfolioStats.overdue;
  const pretrialCases = summary.pretrial_cases ?? portfolioStats.pretrial;
  const courtCases = summary.court_cases ?? portfolioStats.court;
  const fsspCases = summary.fssp_cases ?? portfolioStats.fssp;
  const closedCases = summary.closed_cases ?? portfolioStats.closed;

  const blockedCases =
    intelligenceKpi.blocked_cases ?? summary.blocked_cases ?? routingSummary.blocked ?? 0;
  const readyCases = intelligenceKpi.ready_now_cases ?? routingSummary.ready ?? 0;
  const waitingCases = intelligenceKpi.waiting_cases ?? routingSummary.waiting ?? 0;

  const highRiskCases = intelligenceKpi.high_risk_cases ?? 0;
  const criticalCases = intelligenceKpi.critical_cases ?? 0;
  const courtLaneCases = intelligenceKpi.court_lane_cases ?? 0;
  const enforcementLaneCases = intelligenceKpi.enforcement_lane_cases ?? 0;

  const totalAmount = portfolioStats.totalAmount ?? 0;

  const avgRiskScore = Number(intelligenceKpi.avg_risk_score ?? 0);
  const avgPriorityScore = Number(intelligenceKpi.avg_priority_score ?? 0);
  const readyPressure = Number(intelligenceKpi.ready_pressure ?? 0);
  const waitingPressure = Number(intelligenceKpi.waiting_pressure ?? 0);
  const blockedPressure = Number(intelligenceKpi.blocked_pressure ?? 0);
  const healthScore = Number(intelligenceKpi.portfolio_health_score ?? 0);

  return (
    <section className="panel control-room-kpis-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Control room overview</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Ключевые показатели портфеля
          </div>
          <div className="muted">
            Быстрый обзор состояния взыскания, routing и приоритетов по всему портфелю.
          </div>
        </div>
      </div>

      <div className="control-room-kpi-hero">
        <div className="control-room-kpi-hero-main">
          <div className="control-room-kpi-hero-label">Portfolio scope</div>
          <div className="control-room-kpi-hero-value">{totalCases}</div>
          <div className="control-room-kpi-hero-title">Дел в видимом портфеле</div>
          <div className="control-room-kpi-hero-subtitle">
            Суммарный объём: {formatMoney(totalAmount)} ₽
          </div>
        </div>

        <div className="control-room-kpi-hero-side">
          <div className="control-room-kpi-hero-card tone-success">
            <span>Ready now</span>
            <strong>{readyCases}</strong>
            <div className="muted small">Можно брать в работу сейчас</div>
          </div>

          <div className="control-room-kpi-hero-card tone-warning">
            <span>Waiting</span>
            <strong>{waitingCases}</strong>
            <div className="muted small">Ждут eligible window</div>
          </div>

          <div className="control-room-kpi-hero-card tone-danger">
            <span>Blocked</span>
            <strong>{blockedCases}</strong>
            <div className="muted small">Требуют снятия blocker’ов</div>
          </div>

          <div className="control-room-kpi-hero-card tone-accent">
            <span>Выбрано</span>
            <strong>{selectedCaseIds.length}</strong>
            <div className="muted small">Текущий batch-пакет</div>
          </div>
        </div>
      </div>

      <div className="portfolio-kpi-grid control-room-kpi-grid-dense" style={{ marginTop: 18 }}>
        <div className="portfolio-kpi-card tone-warning">
          <div className="portfolio-kpi-label">Просрочено</div>
          <div className="portfolio-kpi-value">{overdueCases}</div>
          <div className="portfolio-kpi-subtitle">Нужно ускорять движение</div>
        </div>

        <div className="portfolio-kpi-card tone-neutral">
          <div className="portfolio-kpi-label">Досудебно</div>
          <div className="portfolio-kpi-value">{pretrialCases}</div>
          <div className="portfolio-kpi-subtitle">Soft и pretrial поток</div>
        </div>

        <div className="portfolio-kpi-card tone-neutral">
          <div className="portfolio-kpi-label">Court lane</div>
          <div className="portfolio-kpi-value">{courtLaneCases || courtCases}</div>
          <div className="portfolio-kpi-subtitle">Судебный трек</div>
        </div>

        <div className="portfolio-kpi-card tone-neutral">
          <div className="portfolio-kpi-label">Enforcement lane</div>
          <div className="portfolio-kpi-value">{enforcementLaneCases || fsspCases}</div>
          <div className="portfolio-kpi-subtitle">Исполнительный трек</div>
        </div>

        <div className="portfolio-kpi-card tone-warning">
          <div className="portfolio-kpi-label">High risk</div>
          <div className="portfolio-kpi-value">{highRiskCases}</div>
          <div className="portfolio-kpi-subtitle">Повышенный операционный риск</div>
        </div>

        <div className="portfolio-kpi-card tone-danger">
          <div className="portfolio-kpi-label">Critical</div>
          <div className="portfolio-kpi-value">{criticalCases}</div>
          <div className="portfolio-kpi-subtitle">Самые опасные кейсы</div>
        </div>

        <div className="portfolio-kpi-card tone-neutral">
          <div className="portfolio-kpi-label">Avg risk</div>
          <div className="portfolio-kpi-value">{formatMetric(avgRiskScore)}</div>
          <div className="portfolio-kpi-subtitle">Средний intelligence risk</div>
        </div>

        <div className="portfolio-kpi-card tone-neutral">
          <div className="portfolio-kpi-label">Avg priority</div>
          <div className="portfolio-kpi-value">{formatMetric(avgPriorityScore)}</div>
          <div className="portfolio-kpi-subtitle">Средний priority score</div>
        </div>

        <div className="portfolio-kpi-card tone-success">
          <div className="portfolio-kpi-label">Ready pressure</div>
          <div className="portfolio-kpi-value">{formatMetric(readyPressure)}</div>
          <div className="portfolio-kpi-subtitle">Нагрузка на ready-поток</div>
        </div>

        <div className="portfolio-kpi-card tone-warning">
          <div className="portfolio-kpi-label">Waiting pressure</div>
          <div className="portfolio-kpi-value">{formatMetric(waitingPressure)}</div>
          <div className="portfolio-kpi-subtitle">Нагрузка на waiting-пул</div>
        </div>

        <div className="portfolio-kpi-card tone-danger">
          <div className="portfolio-kpi-label">Blocked pressure</div>
          <div className="portfolio-kpi-value">{formatMetric(blockedPressure)}</div>
          <div className="portfolio-kpi-subtitle">Нагрузка на blocked-поток</div>
        </div>

        <div className="portfolio-kpi-card tone-accent">
          <div className="portfolio-kpi-label">Health score</div>
          <div className="portfolio-kpi-value">{formatMetric(healthScore)}</div>
          <div className="portfolio-kpi-subtitle">Интегральное здоровье портфеля</div>
        </div>

        <div className="portfolio-kpi-card tone-neutral">
          <div className="portfolio-kpi-label">Draft</div>
          <div className="portfolio-kpi-value">{portfolioStats.draft}</div>
          <div className="portfolio-kpi-subtitle">Новые или неразогнанные кейсы</div>
        </div>

        <div className="portfolio-kpi-card tone-neutral">
          <div className="portfolio-kpi-label">Завершено</div>
          <div className="portfolio-kpi-value">{closedCases}</div>
          <div className="portfolio-kpi-subtitle">Закрытые дела</div>
        </div>
      </div>
    </section>
  );
}
import { formatCaseStatus, formatDebtorType } from "./legalLabels";

type Props = {
  dashboard?: any;
  cases: any[];
  selectedCase: number | null;
  onOpenCase: (caseId: number) => void;
};

function parseAmount(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function riskLabel(level?: string): string {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return map[level || ""] || level || "—";
}

function riskClass(level?: string): string {
  const map: Record<string, string> = {
    low: "risk-low",
    medium: "risk-medium",
    high: "risk-high",
    critical: "risk-critical",
  };
  return map[level || ""] || "risk-low";
}

function topSignalsFromDashboard(dashboard: any): Array<{ label: string; count: number }> {
  const priorityItems = dashboard?.priority_cases?.items || [];
  const waitingItems = dashboard?.waiting_preview?.items || [];
  const counts = new Map<string, number>();

  for (const item of priorityItems) {
    const reasons = Array.isArray(item?.blocked_reasons) ? item.blocked_reasons : [];
    for (const reason of reasons) {
      const key = String(reason || "").trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  for (const item of waitingItems) {
    const key = String(item?.reason || "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export default function IntelligencePortfolioPanel({
  dashboard,
  cases,
  selectedCase,
  onOpenCase,
}: Props) {
  const priorityCases = (dashboard?.priority_cases?.items || []).slice(0, 4);
  const topSignals = topSignalsFromDashboard(dashboard);
  const intelligenceKpi = dashboard?.intelligence_kpi || {};
  const summary = dashboard?.summary || {};

  const totalAmount = (cases || []).reduce(
    (acc: number, item: any) => acc + parseAmount(item?.principal_amount),
    0
  );

  const debtorTypeCounts = (cases || []).reduce(
    (acc: Record<string, number>, item: any) => {
      const key = String(item?.debtor_type || "unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <section className="panel control-room-intelligence-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Portfolio intelligence</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Intelligence по портфелю
          </div>
          <div className="muted">
            Сигналы, структура и короткий управленческий срез для ежедневной работы.
          </div>
        </div>
      </div>

      <div className="control-room-intelligence-grid" style={{ marginTop: 16 }}>
        <div className="control-room-intelligence-summary">
          <div className="portfolio-section-head">
            <div>
              <div className="portfolio-section-title">Структура портфеля</div>
              <div className="muted small">Быстрая управленческая сводка</div>
            </div>
          </div>

          <div className="portfolio-mini-stats">
            <div className="portfolio-mini-stat">
              <span>Всего дел</span>
              <strong>{cases.length}</strong>
            </div>

            <div className="portfolio-mini-stat">
              <span>Сумма портфеля</span>
              <strong style={{ fontSize: 16 }}>{formatMoney(totalAmount)} ₽</strong>
            </div>

            <div className="portfolio-mini-stat">
              <span>Юрлица</span>
              <strong>{debtorTypeCounts.company || 0}</strong>
            </div>

            <div className="portfolio-mini-stat">
              <span>Физлица</span>
              <strong>{debtorTypeCounts.individual || 0}</strong>
            </div>

            <div className="portfolio-mini-stat">
              <span>ИП</span>
              <strong>{debtorTypeCounts.entrepreneur || 0}</strong>
            </div>

            <div className="portfolio-mini-stat">
              <span>Архив</span>
              <strong>{cases.filter((item: any) => Boolean(item?.is_archived)).length}</strong>
            </div>

            <div className="portfolio-mini-stat">
              <span>Critical</span>
              <strong>{intelligenceKpi.critical_cases || 0}</strong>
            </div>

            <div className="portfolio-mini-stat">
              <span>High risk</span>
              <strong>{intelligenceKpi.high_risk_cases || 0}</strong>
            </div>

            <div className="portfolio-mini-stat">
              <span>Blocked</span>
              <strong>{summary.blocked_cases || 0}</strong>
            </div>
          </div>
        </div>

        <div className="control-room-intelligence-signals">
          <div className="portfolio-section-head">
            <div>
              <div className="portfolio-section-title">Повторяющиеся сигналы</div>
              <div className="muted small">Что чаще всего мешает throughput</div>
            </div>
          </div>

          {topSignals.length ? (
            <div className="signal-cloud">
              {topSignals.map((item) => (
                <div className="signal-chip" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box">Сигналы пока не накоплены.</div>
          )}
        </div>
      </div>

      <div className="portfolio-priority-card" style={{ marginTop: 18 }}>
        <div className="portfolio-section-head">
          <div>
            <div className="portfolio-section-title">Интеллектуальный shortlist</div>
            <div className="muted small">
              Несколько наиболее заметных кейсов из priority feed
            </div>
          </div>
        </div>

        {priorityCases.length ? (
          <div className="priority-case-list">
            {priorityCases.map((item: any, index: number) => (
              <button
                key={item.case_id}
                className={`priority-case-row ${
                  selectedCase === item.case_id ? "is-current" : ""
                }`}
                onClick={() => onOpenCase(item.case_id)}
              >
                <div className="priority-case-rank">{index + 1}</div>

                <div className="priority-case-main">
                  <div className="priority-case-topline">
                    <strong>Дело #{item.case_id}</strong>
                    <span className={`status-badge status-${item.status || "draft"}`}>
                      {formatCaseStatus(item.status)}
                    </span>
                  </div>

                  <div className="priority-case-debtor">{item.debtor_name || "—"}</div>

                  <div className="priority-case-meta">
                    <span>{item.contract_type || "—"}</span>
                    <span>·</span>
                    <span>{formatDebtorType(item.debtor_type)}</span>
                    <span>·</span>
                    <span>{item.principal_amount || "—"} ₽</span>
                  </div>

                  <div className="priority-case-hint">
                    {item.blocked_reasons?.[0] || "Открыть карточку и проверить кейс"}
                  </div>
                </div>

                <div className="priority-case-side">
                  <div className={`risk-pill ${riskClass(item.risk_level)}`}>
                    {riskLabel(item.risk_level)}
                  </div>
                  <div className="priority-risk-score">{item.risk_score ?? 0}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-box">Приоритетные кейсы пока не сформированы.</div>
        )}
      </div>
    </section>
  );
}
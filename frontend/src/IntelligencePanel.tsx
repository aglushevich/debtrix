import {
  formatCaseStatus,
  formatDebtorType,
  formatRoutingStatus,
  formatStageStatus,
} from "./legal";

type Props = {
  dashboard?: any;
};

function renderChipList(items?: string[], emptyText = "Пока пусто.") {
  if (!items?.length) {
    return <div className="compact-empty">{emptyText}</div>;
  }

  return (
    <div className="rail-chip-list">
      {items.map((item, index) => (
        <div className="rail-chip" key={`${item}-${index}`}>
          {item}
        </div>
      ))}
    </div>
  );
}

function stat(value: any, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export default function IntelligencePanel({ dashboard }: Props) {
  const intelligence = dashboard?.debtor_intelligence || {};
  const starterKit = dashboard?.organization_starter_kit || {};
  const routing = dashboard?.routing || {};
  const nextStep = dashboard?.next_step || null;
  const stage = dashboard?.stage || {};
  const debtorRegistry = dashboard?.debtor_registry || {};
  const debtor = debtorRegistry?.debtor || null;
  const summary = debtorRegistry?.summary || {};
  const caseData = dashboard?.case || {};

  const signals = intelligence?.signals || starterKit?.signals || [];
  const graphHints = intelligence?.graph_hints || starterKit?.graph_hints || [];
  const recommendations = starterKit?.recommendations || [];

  return (
    <aside className="intelligence-rail">
      <section className="rail-panel rail-panel-primary">
        <div className="rail-panel-title">Контрольная панель дела</div>

        <div className="rail-kpi-list">
          <div className="rail-kpi-card">
            <span className="rail-kpi-label">Следующее рекомендуемое действие</span>
            <strong className="rail-kpi-value">{nextStep?.title || "Не определено"}</strong>
          </div>

          <div className="rail-kpi-grid">
            <div className="rail-mini-kpi">
              <span>Стадия</span>
              <strong>{formatStageStatus(stage?.status)}</strong>
            </div>
            <div className="rail-mini-kpi">
              <span>Статус дела</span>
              <strong>{formatCaseStatus(caseData?.status)}</strong>
            </div>
            <div className="rail-mini-kpi">
              <span>Связанные дела</span>
              <strong>{stat(summary?.cases_count, "0")}</strong>
            </div>
            <div className="rail-mini-kpi">
              <span>Совокупная сумма</span>
              <strong>{stat(summary?.total_principal_amount, "0.00")} ₽</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Сведения о должнике</div>

        <div className="rail-info-list">
          <div className="rail-info-row">
            <span>Наименование</span>
            <strong>{debtor?.name || caseData?.debtor_name || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Тип лица</span>
            <strong>{formatDebtorType(debtor?.debtor_type || caseData?.debtor_type)}</strong>
          </div>
          <div className="rail-info-row">
            <span>ИНН</span>
            <strong>{debtor?.inn || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>ОГРН</span>
            <strong>{debtor?.ogrn || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Маршрут взыскания</div>

        <div className="rail-info-list">
          <div className="rail-info-row">
            <span>Корзина маршрутизации</span>
            <strong>{routing?.bucket_code || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Состояние</span>
            <strong>{formatRoutingStatus(routing?.status)}</strong>
          </div>
          <div className="rail-info-row">
            <span>Причина</span>
            <strong>{routing?.reason_code || "—"}</strong>
          </div>
          <div className="rail-info-row">
            <span>Дата доступности</span>
            <strong>{routing?.eligible_at || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Сигналы</div>
        {renderChipList(signals, "Сигналы пока не сформированы.")}
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Подсказки по связям</div>
        {renderChipList(graphHints, "Подсказки по структуре пока не сформированы.")}
      </section>

      <section className="rail-panel">
        <div className="rail-panel-title">Рекомендации</div>
        {renderChipList(recommendations, "Рекомендаций пока нет.")}
      </section>
    </aside>
  );
}
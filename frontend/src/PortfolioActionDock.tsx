type Props = {
  selectedCaseIds: number[];
};

export default function PortfolioActionDock({ selectedCaseIds }: Props) {
  const hasSelection = selectedCaseIds.length > 0;

  return (
    <section className="panel portfolio-action-dock">
      <div className="section-eyebrow">Action dock</div>
      <div className="panel-title">Пакетная работа</div>

      <div className="dock-stat">
        <span>Выбрано в пакет</span>
        <strong>{selectedCaseIds.length}</strong>
      </div>

      <div className="ops-hints-list">
        <div className="ops-hint-card">
          <strong>Текущее состояние</strong>
          <div className="muted small">
            {hasSelection
              ? "Пакет сформирован. Дальше проверь homogeneous set перед запуском."
              : "Сначала отметь кейсы в registry, затем переходи в batch execution."}
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Soft stage</strong>
          <div className="muted small">
            Подходит для homogeneous batch по уведомлениям и претензиям.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Court lane</strong>
          <div className="muted small">
            Формируй отдельные пакеты для суда, не смешивай их с soft-потоком.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Enforcement lane</strong>
          <div className="muted small">
            ФССП и внешние действия удобнее запускать отдельными пакетами.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Blocked cleanup</strong>
          <div className="muted small">
            Устранение blocker’ов часто даёт лучший throughput, чем новый средний кейс.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Rule of thumb</strong>
          <div className="muted small">
            Сначала смотри preview, потом запускай пакет. Waiting — это не ошибка, а будущая
            пропускная способность портфеля.
          </div>
        </div>
      </div>
    </section>
  );
}
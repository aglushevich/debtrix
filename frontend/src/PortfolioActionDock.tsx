type Props = {
  selectedCaseIds: number[];
};

export default function PortfolioActionDock({ selectedCaseIds }: Props) {
  const hasSelection = selectedCaseIds.length > 0;
  const selectionSize = selectedCaseIds.length;

  function selectionHint() {
    if (!hasSelection) {
      return "Сначала отметь кейсы в registry, затем переходи в batch execution.";
    }

    if (selectionSize === 1) {
      return "Выбран 1 кейс. Batch допустим, но чаще полезнее сначала проверить preview.";
    }

    if (selectionSize <= 10) {
      return "Небольшой пакет. Хорошо подходит для осторожного первого запуска.";
    }

    if (selectionSize <= 50) {
      return "Средний пакет. Обязательно смотри preview перед запуском.";
    }

    return "Крупный пакет. Проверь homogeneous set, waiting и blocked перед запуском.";
  }

  return (
    <section className="panel portfolio-action-dock">
      <div className="section-eyebrow">Action dock</div>
      <div className="panel-title">Пакетная работа</div>

      <div className="dock-stat">
        <span>Выбрано в пакет</span>
        <strong>{selectionSize}</strong>
      </div>

      <div className="ops-hints-list">
        <div className="ops-hint-card">
          <strong>Текущее состояние</strong>
          <div className="muted small">{selectionHint()}</div>
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
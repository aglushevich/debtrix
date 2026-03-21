type Props = {
  selectedCaseIds: number[];
};

export default function PortfolioActionDock({ selectedCaseIds }: Props) {
  const hasSelection = selectedCaseIds.length > 0;
  const selectionSize = selectedCaseIds.length;

  function selectionHint() {
    if (!hasSelection) {
      return "Сначала отметь кейсы в registry, затем переходи к batch execution.";
    }

    if (selectionSize === 1) {
      return "Выбран 1 кейс. Batch возможен, но полезно сначала проверить карточку и preview.";
    }

    if (selectionSize <= 10) {
      return "Небольшой пакет. Хорошо подходит для осторожного первого запуска.";
    }

    if (selectionSize <= 50) {
      return "Средний пакет. Перед запуском проверь однородность кейсов и preview.";
    }

    return "Крупный пакет. Проверь homogeneous set, waiting и blocked перед запуском.";
  }

  function selectionTone() {
    if (!hasSelection) return "Нет активного пакета";
    if (selectionSize <= 10) return "Пакет безопасного размера";
    if (selectionSize <= 50) return "Пакет среднего размера";
    return "Крупный пакет";
  }

  return (
    <section className="panel portfolio-action-dock">
      <div className="section-eyebrow">Action dock</div>
      <div className="panel-title" style={{ marginBottom: 6 }}>
        Пакетная работа
      </div>
      <div className="muted">
        Боковой ориентир для batch-цикла: что у тебя сейчас выбрано и как безопаснее
        собирать запуск.
      </div>

      <div className="dock-stat" style={{ marginTop: 16 }}>
        <span>Выбрано в пакет</span>
        <strong>{selectionSize}</strong>
      </div>

      <div className="ops-hints-list">
        <div className="ops-hint-card">
          <strong>{selectionTone()}</strong>
          <div className="muted small">{selectionHint()}</div>
        </div>

        <div className="ops-hint-card">
          <strong>Soft stage</strong>
          <div className="muted small">
            Лучше собирать отдельные homogeneous batch-пакеты по уведомлениям,
            notice и претензиям, не смешивая разные типы шагов.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Court lane</strong>
          <div className="muted small">
            Судебные кейсы держи отдельным пакетом. Не смешивай court lane с soft stage.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Enforcement lane</strong>
          <div className="muted small">
            ФССП и иные внешние действия лучше запускать отдельными пакетами с понятным
            контролем результата.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Blocked cleanup</strong>
          <div className="muted small">
            Снятие blocker’ов часто даёт больший прирост throughput, чем запуск ещё одного
            среднего кейса.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Waiting — это не ошибка</strong>
          <div className="muted small">
            Waiting bucket — это будущая пропускная способность. Его нужно контролировать,
            а не воспринимать как сбой маршрута.
          </div>
        </div>

        <div className="ops-hint-card">
          <strong>Rule of thumb</strong>
          <div className="muted small">
            Сначала собери срез в registry, затем проверь preview, и только после этого
            запускай batch execution.
          </div>
        </div>
      </div>
    </section>
  );
}
type Props = {
  explain?: {
    positives?: string[];
    blockers?: string[];
    signals?: string[];
  };
};

function asArray(value: any): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export default function DecisionExplainPanel({ explain }: Props) {
  if (!explain) return null;

  const positives = asArray(explain.positives);
  const blockers = asArray(explain.blockers);
  const signals = asArray(explain.signals);

  if (!positives.length && !signals.length && !blockers.length) {
    return null;
  }

  return (
    <section className="panel panel-nested" style={{ marginTop: 14 }}>
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Decision explain</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Почему выбрано это действие
          </div>
          <div className="muted">
            Explainability decision layer: позитивные факторы, сигналы и ограничения.
          </div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid-secondary" style={{ marginTop: 14 }}>
        <div className="panel panel-nested" style={{ marginBottom: 0 }}>
          <div className="panel-title" style={{ marginBottom: 10 }}>
            Позитивные факторы
          </div>

          {positives.length ? (
            <div className="participants-list">
              {positives.map((item, index) => (
                <div className="participant-card" key={`positive-${index}`}>
                  <div className="participant-card-top">
                    <div>
                      <div className="participant-role">Positive</div>
                      <div className="participant-name">{item}</div>
                    </div>

                    <div className="participant-badges">
                      <span className="status-badge status-ready">OK</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box">Позитивные факторы не зафиксированы.</div>
          )}
        </div>

        <div className="panel panel-nested" style={{ marginBottom: 0 }}>
          <div className="panel-title" style={{ marginBottom: 10 }}>
            Сигналы
          </div>

          {signals.length ? (
            <div className="participants-list">
              {signals.map((item, index) => (
                <div className="participant-card" key={`signal-${index}`}>
                  <div className="participant-card-top">
                    <div>
                      <div className="participant-role">Signal</div>
                      <div className="participant-name">{item}</div>
                    </div>

                    <div className="participant-badges">
                      <span className="status-badge status-pretrial">Signal</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-box">Дополнительные сигналы не зафиксированы.</div>
          )}
        </div>
      </div>

      <div className="panel panel-nested" style={{ marginTop: 14, marginBottom: 0 }}>
        <div className="panel-title" style={{ marginBottom: 10 }}>
          Ограничения и blockers
        </div>

        {blockers.length ? (
          <div className="participants-list">
            {blockers.map((item, index) => (
              <div className="participant-card" key={`blocker-${index}`}>
                <div className="participant-card-top">
                  <div>
                    <div className="participant-role">Blocker</div>
                    <div className="participant-name">{item}</div>
                  </div>

                  <div className="participant-badges">
                    <span className="status-badge status-overdue">Blocker</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-box">Явные blockers не найдены.</div>
        )}
      </div>
    </section>
  );
}
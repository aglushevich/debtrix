type Props = {
  dashboard: any;
  actionBusy: string;
  onRunAction: (code: string) => Promise<void> | void;
};

export default function CaseActionsPanel({
  dashboard,
  actionBusy,
  onRunAction,
}: Props) {
  return (
    <section className="panel">
      <div className="panel-title">Доступные действия</div>

      <div className="action-list">
        {dashboard?.actions?.length ? (
          dashboard.actions.map((action: any) => (
            <button
              key={action.code}
              className="primary-btn"
              disabled={actionBusy === action.code}
              onClick={() => onRunAction(action.code)}
            >
              {actionBusy === action.code
                ? "Выполнение…"
                : action.title_ru || action.title}
            </button>
          ))
        ) : (
          <div className="empty-box">Доступные действия отсутствуют.</div>
        )}
      </div>
    </section>
  );
}
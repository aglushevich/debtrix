import { SavedViewItem } from "./api";

type Props = {
  items: SavedViewItem[];
  activeViewId?: number | null;
  onApply: (view: SavedViewItem) => Promise<void>;
};

export default function SavedViewsPanel({
  items,
  activeViewId,
  onApply,
}: Props) {
  return (
    <section className="panel control-room-saved-views-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Workspace presets</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Сохранённые виды
          </div>
          <div className="muted">
            Готовые операционные срезы портфеля для ежедневной работы и batch-циклов.
          </div>
        </div>
      </div>

      {items.length ? (
        <div className="saved-views-grid" style={{ marginTop: 14 }}>
          {items.map((item) => (
            <button
              key={item.id}
              className={`saved-view-card ${activeViewId === item.id ? "is-current" : ""}`}
              onClick={() => onApply(item)}
            >
              <div className="saved-view-card-top">
                <strong>{item.title}</strong>

                {item.is_default ? (
                  <span className="status-badge status-ready">По умолчанию</span>
                ) : (
                  <span className="status-badge status-not-ready">Вид</span>
                )}
              </div>

              <div className="muted">{item.description || "Без описания"}</div>

              <div className="saved-view-meta">
                <span>
                  Фильтры:{" "}
                  {item.filters && Object.keys(item.filters).length
                    ? Object.keys(item.filters).join(", ")
                    : "нет"}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-box">Сохранённых видов пока нет.</div>
      )}
    </section>
  );
}
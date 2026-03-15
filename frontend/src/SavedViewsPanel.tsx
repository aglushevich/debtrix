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
    <section className="panel">
      <div className="panel-title">Сохранённые виды</div>

      {items.length ? (
        <div className="saved-views-grid">
          {items.map((item) => (
            <button
              key={item.id}
              className={`saved-view-card ${activeViewId === item.id ? "is-current" : ""}`}
              onClick={() => onApply(item)}
            >
              <div className="saved-view-card-top">
                <strong>{item.title}</strong>

                {item.is_default ? (
                  <span className="status-badge status-ready">Default</span>
                ) : (
                  <span className="status-badge status-not-ready">View</span>
                )}
              </div>

              <div className="muted">{item.description || "Без описания"}</div>

              <div className="muted small" style={{ marginTop: 8 }}>
                Фильтры:{" "}
                {item.filters && Object.keys(item.filters).length
                  ? Object.keys(item.filters).join(", ")
                  : "нет"}
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
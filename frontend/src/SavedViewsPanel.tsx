import { SavedViewItem } from "./api";

type Props = {
  items: SavedViewItem[];
  activeViewId?: number | null;
  onApply: (view: SavedViewItem) => Promise<void>;
};

function formatFilterChip(key: string, value: any): string | null {
  if (value === null || value === undefined) return null;
  if (value === "") return null;
  if (value === false) return null;

  const normalizedKey = String(key);

  switch (normalizedKey) {
    case "q":
      return `Поиск: ${String(value)}`;

    case "status": {
      const map: Record<string, string> = {
        draft: "Статус: Черновик",
        overdue: "Статус: Просрочка",
        pretrial: "Статус: Досудебная стадия",
        court: "Статус: Суд",
        fssp: "Статус: ФССП",
        enforcement: "Статус: Исполнительное производство",
        closed: "Статус: Закрыто",
      };
      return map[String(value)] || `Статус: ${String(value)}`;
    }

    case "contract_type":
      return `Договор: ${String(value)}`;

    case "debtor_type": {
      const map: Record<string, string> = {
        company: "Должник: Юрлицо",
        individual: "Должник: Физлицо",
        entrepreneur: "Должник: ИП",
      };
      return map[String(value)] || `Должник: ${String(value)}`;
    }

    case "include_archived":
      return value ? "С архивом" : null;

    case "smart_level": {
      const map: Record<string, string> = {
        ready: "Smart: Ready",
        partial: "Smart: Partial",
        waiting: "Smart: Waiting",
        blocked: "Smart: Blocked",
      };
      return map[String(value)] || `Smart: ${String(value)}`;
    }

    case "priority_band": {
      const map: Record<string, string> = {
        low: "Priority: Low",
        medium: "Priority: Medium",
        high: "Priority: High",
        critical: "Priority: Critical",
      };
      return map[String(value)] || `Priority: ${String(value)}`;
    }

    case "warnings_only":
      return value ? "Только warnings" : null;

    case "duplicates_only":
      return value ? "Только дубли" : null;

    default:
      return `${normalizedKey}: ${String(value)}`;
  }
}

function buildFilterChips(item: SavedViewItem): string[] {
  const filters = item.filters || {};

  return Object.entries(filters)
    .map(([key, value]) => formatFilterChip(key, value))
    .filter(Boolean) as string[];
}

function formatSorting(item: SavedViewItem): string {
  const sorting = item.sorting || {};
  const key = String((sorting as any)?.key || "priority");
  const direction = String((sorting as any)?.direction || "desc");

  const keyMap: Record<string, string> = {
    priority: "Priority score",
    readiness: "Readiness",
    smart_level: "Smart level",
    warnings: "Warnings",
    duplicates: "Duplicates",
    amount: "Сумма долга",
    due_date: "Срок оплаты",
    status: "Статус",
    id: "Номер дела",
  };

  const directionMap: Record<string, string> = {
    asc: "по возрастанию",
    desc: "по убыванию",
  };

  return `${keyMap[key] || key} · ${directionMap[direction] || direction}`;
}

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
          {items.map((item) => {
            const isCurrent = activeViewId === item.id;
            const filterChips = buildFilterChips(item);

            return (
              <button
                key={item.id}
                className={`saved-view-card ${isCurrent ? "is-current" : ""}`}
                onClick={() => onApply(item)}
              >
                <div className="saved-view-card-top">
                  <strong>{item.title}</strong>

                  {item.is_default ? (
                    <span className="status-badge status-ready">По умолчанию</span>
                  ) : isCurrent ? (
                    <span className="status-badge status-waiting">Активен</span>
                  ) : (
                    <span className="status-badge status-not-ready">Вид</span>
                  )}
                </div>

                <div className="muted">{item.description || "Без описания"}</div>

                <div className="saved-view-meta">
                  <span>Фильтры:</span>
                </div>

                {filterChips.length ? (
                  <div
                    className="action-list"
                    style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}
                  >
                    {filterChips.map((chip, index) => (
                      <span
                        key={`${item.id}-chip-${index}`}
                        className="status-badge status-draft"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="saved-view-meta">
                    <span>Без фильтров</span>
                  </div>
                )}

                <div className="saved-view-meta" style={{ marginTop: 10 }}>
                  <span>Сортировка: {formatSorting(item)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-box">Сохранённых видов пока нет.</div>
      )}
    </section>
  );
}
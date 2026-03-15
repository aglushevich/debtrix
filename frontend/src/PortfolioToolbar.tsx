import { useState } from "react";
import { PortfolioFilters } from "./api";

type Props = {
  filters: PortfolioFilters;
  onChange: (next: PortfolioFilters) => void;
  onSaveView: (title: string) => Promise<void>;
};

export default function PortfolioToolbar({
  filters,
  onChange,
  onSaveView,
}: Props) {
  const [viewTitle, setViewTitle] = useState("");

  async function handleSaveView() {
    const title = viewTitle.trim();
    if (!title) return;
    await onSaveView(title);
    setViewTitle("");
  }

  return (
    <section className="panel">
      <div className="portfolio-toolbar-header">
        <div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Портфель дел
          </div>
          <div className="muted">
            Фильтруй портфель, формируй операционные срезы и сохраняй виды.
          </div>
        </div>
      </div>

      <div
        className="info-grid"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 16 }}
      >
        <div className="info-item">
          <span className="label">Поиск</span>
          <input
            className="small-input"
            placeholder="№ дела / должник"
            value={filters.q || ""}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
          />
        </div>

        <div className="info-item">
          <span className="label">Статус</span>
          <select
            className="small-input"
            value={filters.status || ""}
            onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
          >
            <option value="">Все</option>
            <option value="draft">Черновик</option>
            <option value="overdue">Просрочка</option>
            <option value="pretrial">Досудебная стадия</option>
            <option value="court">Суд</option>
            <option value="fssp">ФССП</option>
            <option value="enforcement">Исполнительное производство</option>
            <option value="closed">Закрыто</option>
          </select>
        </div>

        <div className="info-item">
          <span className="label">Тип договора</span>
          <input
            className="small-input"
            placeholder="Например, supply"
            value={filters.contract_type || ""}
            onChange={(e) =>
              onChange({ ...filters, contract_type: e.target.value || undefined })
            }
          />
        </div>

        <div className="info-item">
          <span className="label">Тип должника</span>
          <select
            className="small-input"
            value={filters.debtor_type || ""}
            onChange={(e) =>
              onChange({ ...filters, debtor_type: e.target.value || undefined })
            }
          >
            <option value="">Все</option>
            <option value="company">Юрлицо</option>
            <option value="individual">Физлицо</option>
            <option value="entrepreneur">ИП</option>
          </select>
        </div>
      </div>

      <div className="action-list" style={{ marginTop: 16 }}>
        <button
          className="secondary-btn"
          onClick={() =>
            onChange({
              q: "",
              status: undefined,
              contract_type: undefined,
              debtor_type: undefined,
              include_archived: filters.include_archived,
            })
          }
        >
          Сбросить фильтры
        </button>

        <button
          className="secondary-btn"
          onClick={() =>
            onChange({
              ...filters,
              include_archived: !filters.include_archived,
            })
          }
        >
          {filters.include_archived ? "Скрыть архив" : "Показать архив"}
        </button>
      </div>

      <div className="portfolio-save-view-row">
        <input
          className="small-input"
          placeholder="Название сохранённого вида"
          value={viewTitle}
          onChange={(e) => setViewTitle(e.target.value)}
        />
        <button className="primary-btn" onClick={handleSaveView}>
          Сохранить текущий вид
        </button>
      </div>
    </section>
  );
}
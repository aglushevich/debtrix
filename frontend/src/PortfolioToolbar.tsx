import { useState } from "react";
import { PortfolioFilters } from "./api";
import {
  PortfolioSortDirection,
  PortfolioSortKey,
  PortfolioSorting,
} from "./portfolioSorting";

type Props = {
  filters: PortfolioFilters;
  sorting: PortfolioSorting;
  onChange: (next: PortfolioFilters) => void;
  onChangeSorting: (next: PortfolioSorting) => void;
  onSaveView: (title: string) => Promise<void>;
};

const SORT_OPTIONS: Array<{ value: PortfolioSortKey; label: string }> = [
  { value: "readiness", label: "Readiness" },
  { value: "smart_level", label: "Smart level" },
  { value: "warnings", label: "Warnings" },
  { value: "duplicates", label: "Duplicates" },
  { value: "amount", label: "Сумма долга" },
  { value: "due_date", label: "Срок оплаты" },
  { value: "status", label: "Статус" },
  { value: "id", label: "Номер дела" },
];

const SORT_DIRECTION_OPTIONS: Array<{ value: PortfolioSortDirection; label: string }> = [
  { value: "desc", label: "По убыванию" },
  { value: "asc", label: "По возрастанию" },
];

export default function PortfolioToolbar({
  filters,
  sorting,
  onChange,
  onChangeSorting,
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
    <section className="panel control-room-toolbar-panel">
      <div className="portfolio-toolbar-header">
        <div>
          <div className="section-eyebrow">Portfolio filters</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Фильтры и сохранённые срезы
          </div>
          <div className="muted">
            Формируй операционные выборки, очищай шум и сохраняй рабочие виды.
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

      <div
        className="info-grid"
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 16 }}
      >
        <div className="info-item">
          <span className="label">Smart level</span>
          <select
            className="small-input"
            value={filters.smart_level || ""}
            onChange={(e) =>
              onChange({
                ...filters,
                smart_level: (e.target.value || "") as PortfolioFilters["smart_level"],
              })
            }
          >
            <option value="">Все</option>
            <option value="ready">Ready</option>
            <option value="partial">Partial</option>
            <option value="waiting">Waiting</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <div className="info-item">
          <span className="label">Warnings</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 38 }}>
            <input
              type="checkbox"
              checked={Boolean(filters.warnings_only)}
              onChange={(e) =>
                onChange({
                  ...filters,
                  warnings_only: e.target.checked,
                })
              }
            />
            <span>Только с warning-сигналами</span>
          </label>
        </div>

        <div className="info-item">
          <span className="label">Duplicates</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 38 }}>
            <input
              type="checkbox"
              checked={Boolean(filters.duplicates_only)}
              onChange={(e) =>
                onChange({
                  ...filters,
                  duplicates_only: e.target.checked,
                })
              }
            />
            <span>Только с дублями</span>
          </label>
        </div>
      </div>

      <div
        className="info-grid"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 16 }}
      >
        <div className="info-item">
          <span className="label">Сортировка</span>
          <select
            className="small-input"
            value={sorting.key}
            onChange={(e) =>
              onChangeSorting({
                ...sorting,
                key: e.target.value as PortfolioSortKey,
              })
            }
          >
            {SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="info-item">
          <span className="label">Направление</span>
          <select
            className="small-input"
            value={sorting.direction}
            onChange={(e) =>
              onChangeSorting({
                ...sorting,
                direction: e.target.value as PortfolioSortDirection,
              })
            }
          >
            {SORT_DIRECTION_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
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
              smart_level: "",
              warnings_only: false,
              duplicates_only: false,
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

        <button
          className="secondary-btn"
          onClick={() =>
            onChangeSorting({
              key: "readiness",
              direction: "desc",
            })
          }
        >
          Сбросить сортировку
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
import { useMemo, useState } from "react";
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
  activePresetLabel?: string | null;
  onClearPreset?: () => void;
};

const SORT_OPTIONS: Array<{ value: PortfolioSortKey; label: string }> = [
  { value: "priority", label: "Приоритет" },
  { value: "readiness", label: "Индекс готовности" },
  { value: "smart_level", label: "Готовность кейса" },
  { value: "warnings", label: "Проблемы" },
  { value: "duplicates", label: "Дубли" },
  { value: "amount", label: "Сумма долга" },
  { value: "due_date", label: "Срок оплаты" },
  { value: "status", label: "Статус" },
  { value: "id", label: "Номер дела" },
];

const SORT_DIRECTION_OPTIONS: Array<{ value: PortfolioSortDirection; label: string }> = [
  { value: "desc", label: "По убыванию" },
  { value: "asc", label: "По возрастанию" },
];

function formatStatus(value: string): string {
  const map: Record<string, string> = {
    draft: "Черновик",
    overdue: "Просрочка",
    pretrial: "Досудебная стадия",
    court: "Суд",
    fssp: "ФССП",
    enforcement: "Исполнительное производство",
    closed: "Закрыто",
  };

  return map[value] || value;
}

function formatDebtorType(value: string): string {
  const map: Record<string, string> = {
    company: "Юрлицо",
    individual: "Физлицо",
    entrepreneur: "ИП",
  };

  return map[value] || value;
}

function formatSmartLevel(value: string): string {
  const map: Record<string, string> = {
    ready: "Ready",
    partial: "Partial",
    waiting: "Waiting",
    blocked: "Blocked",
  };

  return map[value] || value;
}

function formatPriorityBand(value: string): string {
  const map: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };

  return map[value] || value;
}

function buildActiveFilterLabels(filters: PortfolioFilters): string[] {
  const labels: string[] = [];

  if (filters.q) labels.push(`Поиск: ${filters.q}`);
  if (filters.status) labels.push(`Статус: ${formatStatus(String(filters.status))}`);
  if (filters.contract_type) labels.push(`Договор: ${filters.contract_type}`);
  if (filters.debtor_type) {
    labels.push(`Должник: ${formatDebtorType(String(filters.debtor_type))}`);
  }
  if (filters.smart_level) {
    labels.push(`Готовность: ${formatSmartLevel(String(filters.smart_level))}`);
  }
  if (filters.priority_band) {
    labels.push(`Приоритет: ${formatPriorityBand(String(filters.priority_band))}`);
  }
  if (filters.warnings_only) labels.push("Только с проблемами");
  if (filters.duplicates_only) labels.push("Только с дублями");
  if (filters.include_archived) labels.push("Архив включён");

  return labels;
}

export default function PortfolioToolbar({
  filters,
  sorting,
  onChange,
  onChangeSorting,
  onSaveView,
  activePresetLabel,
  onClearPreset,
}: Props) {
  const [viewTitle, setViewTitle] = useState("");

  const activeFilterLabels = useMemo(() => buildActiveFilterLabels(filters), [filters]);

  async function handleSaveView() {
    const title = viewTitle.trim();
    if (!title) return;
    await onSaveView(title);
    setViewTitle("");
  }

  function resetFilters() {
    onChange({
      q: "",
      status: undefined,
      contract_type: undefined,
      debtor_type: undefined,
      include_archived: filters.include_archived,
      smart_level: "",
      priority_band: "",
      warnings_only: false,
      duplicates_only: false,
    });
  }

  function resetSorting() {
    onChangeSorting({
      key: "priority",
      direction: "desc",
    });
  }

  return (
    <section className="panel control-room-toolbar-panel">
      <div className="portfolio-toolbar-header">
        <div>
          <div className="section-eyebrow">Портфельные фильтры</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Фильтры и сохранённые срезы
          </div>
          <div className="muted">
            Формируй операционные выборки, очищай шум и сохраняй рабочие виды.
          </div>
        </div>
      </div>

      {activePresetLabel && (
        <div
          className="panel panel-nested"
          style={{
            marginTop: 16,
            marginBottom: 16,
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="label" style={{ marginBottom: 6 }}>
                Активный операционный drilldown
              </div>
              <div style={{ fontWeight: 700 }}>{activePresetLabel}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                Этот срез пришёл из routing, focus queues, priority feed или waiting buckets.
              </div>
            </div>

            {onClearPreset && (
              <button className="secondary-btn" onClick={onClearPreset}>
                Сбросить drilldown
              </button>
            )}
          </div>
        </div>
      )}

      {activeFilterLabels.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="label" style={{ marginBottom: 8 }}>
            Активные фильтры
          </div>

          <div className="action-list" style={{ flexWrap: "wrap" }}>
            {activeFilterLabels.map((label) => (
              <span key={label} className="status-badge status-draft">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

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
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 16 }}
      >
        <div className="info-item">
          <span className="label">Готовность кейса</span>
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
          <span className="label">Уровень приоритета</span>
          <select
            className="small-input"
            value={filters.priority_band || ""}
            onChange={(e) =>
              onChange({
                ...filters,
                priority_band: (e.target.value || "") as PortfolioFilters["priority_band"],
              })
            }
          >
            <option value="">Все</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="info-item">
          <span className="label">Проблемы</span>
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
          <span className="label">Дубли</span>
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

      <div className="action-list" style={{ marginTop: 16, flexWrap: "wrap" }}>
        <button
          className="secondary-btn"
          onClick={() =>
            onChange({
              ...filters,
              priority_band: "critical",
            })
          }
        >
          🔥 Только critical
        </button>

        <button
          className="secondary-btn"
          onClick={() =>
            onChange({
              ...filters,
              priority_band: "high",
              smart_level: "",
            })
          }
        >
          ⚡ Только high
        </button>

        <button
          className="secondary-btn"
          onClick={() =>
            onChange({
              ...filters,
              smart_level: "ready",
              priority_band: "",
            })
          }
        >
          ✅ Только ready
        </button>

        <button
          className="secondary-btn"
          onClick={() =>
            onChange({
              ...filters,
              smart_level: "blocked",
              priority_band: "",
            })
          }
        >
          ⛔ Только blocked
        </button>
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

      <div className="action-list" style={{ marginTop: 16, flexWrap: "wrap" }}>
        <button className="secondary-btn" onClick={resetFilters}>
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

        <button className="secondary-btn" onClick={resetSorting}>
          Сбросить сортировку
        </button>

        {onClearPreset && activePresetLabel && (
          <button className="secondary-btn" onClick={onClearPreset}>
            Сбросить drilldown
          </button>
        )}
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
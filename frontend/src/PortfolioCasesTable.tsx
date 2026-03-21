import {
  formatCaseStatus,
  formatRoutingStatus,
  formatSmartLevel,
} from "./legalLabels";
import { PortfolioCaseRow } from "./portfolioSmart";

type Props = {
  cases: PortfolioCaseRow[];
  selectedCase: number | null;
  selectedCaseIds: number[];
  onOpenCase: (caseId: number) => void;
  onToggleCaseSelection: (caseId: number) => void;
  onToggleSelectAllVisible: () => void;
  activePresetLabel?: string | null;
  onClearPreset?: () => void;
};

function formatMoney(value: string | number | null | undefined): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseAmount(value: string | number | null | undefined): number {
  const num = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(num) ? num : 0;
}

function smartLevelBadgeClass(level?: string): string {
  const map: Record<string, string> = {
    ready: "status-ready",
    partial: "status-draft",
    waiting: "status-waiting",
    blocked: "status-overdue",
  };

  return map[level || ""] || "status-draft";
}

function routeLaneLabel(code?: string | null): string {
  const map: Record<string, string> = {
    soft_lane: "Soft",
    court_lane: "Court",
    enforcement_lane: "Enforcement",
    closed_lane: "Closed",
  };
  return map[code || ""] || "—";
}

function priorityBandLabel(code?: string | null): string {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return map[code || ""] || "—";
}

function priorityBandClass(code?: string | null): string {
  const map: Record<string, string> = {
    low: "status-draft",
    medium: "status-waiting",
    high: "status-pretrial",
    critical: "status-overdue",
  };
  return map[code || ""] || "status-draft";
}

export default function PortfolioCasesTable({
  cases,
  selectedCase,
  selectedCaseIds,
  onOpenCase,
  onToggleCaseSelection,
  onToggleSelectAllVisible,
  activePresetLabel,
  onClearPreset,
}: Props) {
  const visibleIds = cases.map((item) => item.id);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedCaseIds.includes(id));

  const selectedVisibleRows = cases.filter((item) => selectedCaseIds.includes(item.id));
  const visibleAmount = cases.reduce(
    (acc, item) => acc + parseAmount(item.principal_amount),
    0
  );
  const selectedVisibleAmount = selectedVisibleRows.reduce(
    (acc, item) => acc + parseAmount(item.principal_amount),
    0
  );

  const readyCount = cases.filter((item) => item.smart.smartLevel === "ready").length;
  const waitingCount = cases.filter((item) => item.smart.smartLevel === "waiting").length;
  const blockedCount = cases.filter((item) => item.smart.smartLevel === "blocked").length;
  const criticalCount = cases.filter((item) => item.priority_band === "critical").length;
  const highCount = cases.filter((item) => item.priority_band === "high").length;

  return (
    <section className="panel">
      <div className="portfolio-table-header">
        <div>
          <div className="section-eyebrow">Реестр портфеля</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Портфель дел
          </div>
          <div className="muted">
            Основной реестр для отбора, приоритизации и формирования batch-пакетов.
          </div>
        </div>

        <div className="action-list">
          <button className="secondary-btn" onClick={onToggleSelectAllVisible}>
            {allVisibleSelected ? "Снять выделение" : "Выбрать все видимые"}
          </button>
        </div>
      </div>

      {activePresetLabel && (
        <div
          className="panel panel-nested"
          style={{
            marginTop: 16,
            marginBottom: 18,
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
              <div className="section-eyebrow">Операционный drilldown</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{activePresetLabel}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                Таблица сейчас открыта в целевом срезе Control Room.
              </div>
            </div>

            {onClearPreset && (
              <button className="secondary-btn" onClick={onClearPreset}>
                Сбросить срез
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="portfolio-mini-stats"
        style={{ marginTop: 16, marginBottom: 18 }}
      >
        <div className="portfolio-mini-stat">
          <span>В срезе</span>
          <strong>{cases.length}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Сумма среза</span>
          <strong>{formatMoney(visibleAmount)} ₽</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Выбрано</span>
          <strong>{selectedVisibleRows.length}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Сумма выбранного</span>
          <strong>{formatMoney(selectedVisibleAmount)} ₽</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Ready</span>
          <strong>{readyCount}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Waiting</span>
          <strong>{waitingCount}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Blocked</span>
          <strong>{blockedCount}</strong>
        </div>

        <div className="portfolio-mini-stat">
          <span>Critical / High</span>
          <strong>
            {criticalCount} / {highCount}
          </strong>
        </div>
      </div>

      {!cases.length ? (
        <div className="empty-box" style={{ marginTop: 16 }}>
          По текущему фильтру дела не найдены.
        </div>
      ) : (
        <div className="portfolio-table-wrap" style={{ marginTop: 16 }}>
          <table className="portfolio-table">
            <thead>
              <tr>
                <th style={{ width: 64 }}>Пакет</th>
                <th style={{ width: 96 }}>Дело</th>
                <th>Должник</th>
                <th style={{ width: 150 }}>Тип договора</th>
                <th style={{ width: 150 }}>Сумма</th>
                <th style={{ width: 130 }}>Срок оплаты</th>
                <th style={{ width: 150 }}>Статус</th>
                <th style={{ width: 110 }}>Маршрут</th>
                <th style={{ width: 120 }}>Линия</th>
                <th style={{ width: 110 }}>Приоритет</th>
                <th style={{ width: 130 }}>Уровень</th>
                <th style={{ minWidth: 220 }}>Фокус оператора</th>
                <th style={{ width: 120 }}>Индекс</th>
                <th style={{ width: 140 }}>Готовность</th>
                <th style={{ width: 110 }}>Проблемы</th>
                <th style={{ width: 120 }}>Дубли</th>
                <th style={{ width: 120 }}>Действие</th>
              </tr>
            </thead>

            <tbody>
              {cases.map((item) => {
                const checked = selectedCaseIds.includes(item.id);
                const isCurrent = selectedCase === item.id;

                return (
                  <tr key={item.id} className={isCurrent ? "is-current" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleCaseSelection(item.id)}
                      />
                    </td>

                    <td>{item.id}</td>

                    <td>
                      <div style={{ fontWeight: 600 }}>{item.debtor_name || "—"}</div>

                      {item.smart.hint && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {item.smart.hint}
                        </div>
                      )}

                      {item.operator_focus && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Фокус: {item.operator_focus}
                        </div>
                      )}
                    </td>

                    <td>{item.contract_type || "—"}</td>

                    <td>{formatMoney(item.principal_amount)} ₽</td>

                    <td>{item.due_date || "—"}</td>

                    <td>{formatCaseStatus(item.status)}</td>

                    <td>{formatRoutingStatus(item.smart.routingStatus)}</td>

                    <td>{routeLaneLabel(item.smart.routeLane)}</td>

                    <td>
                      <strong>{item.priority_score ?? "—"}</strong>
                    </td>

                    <td>
                      {item.priority_band ? (
                        <span
                          className={`status-badge ${priorityBandClass(item.priority_band)}`}
                        >
                          {item.priority_band_label || priorityBandLabel(item.priority_band)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>
                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.35,
                          whiteSpace: "normal",
                        }}
                      >
                        {item.operator_focus || item.recommended_action || "—"}
                      </div>
                    </td>

                    <td>
                      <strong>{item.smart.readinessScore}</strong>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${smartLevelBadgeClass(
                          item.smart.smartLevel
                        )}`}
                      >
                        {formatSmartLevel(item.smart.smartLevel)}
                      </span>
                    </td>

                    <td>
                      {item.smart.warningsCount > 0
                        ? `${item.smart.warningsCount} ⚠`
                        : "—"}
                    </td>

                    <td>
                      {item.smart.duplicatesCount > 0
                        ? `${item.smart.duplicatesCount} 🔁`
                        : "—"}
                    </td>

                    <td>
                      <button
                        className="secondary-btn"
                        onClick={() => onOpenCase(item.id)}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
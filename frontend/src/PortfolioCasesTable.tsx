import {
  formatCaseStatus,
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
};

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export default function PortfolioCasesTable({
  cases,
  selectedCase,
  selectedCaseIds,
  onOpenCase,
  onToggleCaseSelection,
  onToggleSelectAllVisible,
}: Props) {
  const visibleIds = cases.map((item) => item.id);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedCaseIds.includes(id));

  return (
    <section className="panel">
      <div className="portfolio-table-header">
        <div>
          <div className="section-eyebrow">Portfolio registry</div>
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
                <th style={{ width: 120 }}>Readiness</th>
                <th style={{ width: 140 }}>Smart</th>
                <th style={{ width: 110 }}>Warnings</th>
                <th style={{ width: 120 }}>Duplicates</th>
                <th style={{ width: 120 }}>Действие</th>
              </tr>
            </thead>

            <tbody>
              {cases.map((item) => {
                const checked = selectedCaseIds.includes(item.id);
                const isCurrent = selectedCase === item.id;

                return (
                  <tr key={item.id} className={isCurrent ? "active-row" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleCaseSelection(item.id)}
                      />
                    </td>

                    <td>{item.id}</td>

                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {item.debtor_name || "—"}
                      </div>

                      {item.smart.hint && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {item.smart.hint}
                        </div>
                      )}
                    </td>

                    <td>{item.contract_type || "—"}</td>

                    <td>{formatMoney(item.principal_amount)} ₽</td>

                    <td>{item.due_date || "—"}</td>

                    <td>{formatCaseStatus(item.status)}</td>

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
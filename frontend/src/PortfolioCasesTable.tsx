import { formatCaseStatus, formatDebtorType } from "./legalLabels";

type Props = {
  cases: any[];
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

export default function PortfolioCasesTable({
  cases,
  selectedCase,
  selectedCaseIds,
  onOpenCase,
  onToggleCaseSelection,
  onToggleSelectAllVisible,
}: Props) {
  const visibleIds = cases.map((item: any) => item.id);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id: number) => selectedCaseIds.includes(id));

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
                <th style={{ width: 150 }}>Тип должника</th>
                <th style={{ width: 150 }}>Сумма</th>
                <th style={{ width: 130 }}>Срок оплаты</th>
                <th style={{ width: 150 }}>Статус</th>
                <th style={{ width: 120 }}>Действие</th>
              </tr>
            </thead>

            <tbody>
              {cases.map((item: any) => {
                const checked = selectedCaseIds.includes(item.id);
                const isCurrent = selectedCase === item.id;

                return (
                  <tr key={item.id} className={isCurrent ? "is-current" : ""}>
                    <td>
                      <label className="registry-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleCaseSelection(item.id)}
                        />
                        <span className="registry-check-mark" />
                      </label>
                    </td>

                    <td>
                      <div className="portfolio-table-case-id">#{item.id}</div>
                    </td>

                    <td>
                      <div className="registry-debtor-cell">
                        <div className="portfolio-table-main">
                          <strong>{item.debtor_name || "—"}</strong>

                          {isCurrent && (
                            <span className="status-badge status-ready">Открыто</span>
                          )}

                          {item?.is_archived && (
                            <span className="status-badge status-draft">Архив</span>
                          )}
                        </div>

                        <div className="registry-debtor-meta">
                          {item.inn ? `ИНН ${item.inn}` : "ИНН не указан"}
                        </div>
                      </div>
                    </td>

                    <td>{item.contract_type_title || item.contract_type || "—"}</td>

                    <td>
                      {item.debtor_type_title || formatDebtorType(item.debtor_type)}
                    </td>

                    <td>
                      <div className="registry-money-cell">
                        {formatMoney(item.principal_amount)} ₽
                      </div>
                    </td>

                    <td>{item.due_date || "—"}</td>

                    <td>
                      <span className={`status-badge status-${item.status || "draft"}`}>
                        {formatCaseStatus(item.status)}
                      </span>
                    </td>

                    <td>
                      <button
                        className="secondary-btn portfolio-table-open-btn"
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
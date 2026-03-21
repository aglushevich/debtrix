import { ReactNode, useMemo } from "react";
import { formatCaseStatus } from "./legalLabels";

type Props = {
  cases: any[];
  selectedCase: number | null;
  onSelect: (caseId: number) => void;
  children?: ReactNode;
};

function statusClass(status?: string) {
  return `status-badge status-${status || "draft"}`;
}

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeCases(items: any[]) {
  return Array.isArray(items) ? items : [];
}

export default function CaseSidebar({
  cases,
  selectedCase,
  onSelect,
  children,
}: Props) {
  const safeCases = useMemo(() => normalizeCases(cases), [cases]);

  const activeCase = useMemo(
    () => safeCases.find((item) => Number(item.id) === Number(selectedCase)) || null,
    [safeCases, selectedCase]
  );

  const activeCount = useMemo(
    () => safeCases.filter((item) => !item?.is_archived).length,
    [safeCases]
  );

  const archivedCount = useMemo(
    () => safeCases.filter((item) => Boolean(item?.is_archived)).length,
    [safeCases]
  );

  const totalAmount = useMemo(
    () =>
      safeCases.reduce((acc, item) => {
        const value = Number(String(item?.principal_amount ?? 0).replace(",", "."));
        return acc + (Number.isFinite(value) ? value : 0);
      }, 0),
    [safeCases]
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">D</div>
        <div>
          <div className="sidebar-brand-title">Debtrix</div>
          <div className="sidebar-brand-subtitle">Recovery Control Room</div>
        </div>
      </div>

      <div className="sidebar-stack">
        <section className="sidebar-panel sidebar-panel-focus">
          <div className="sidebar-panel-header">
            <div>
              <div className="sidebar-panel-title">Навигация</div>
              <div className="sidebar-panel-subtitle">
                Портфель и текущий активный кейс
              </div>
            </div>
          </div>

          <div className="sidebar-focus-grid">
            <div className="sidebar-focus-card">
              <span>Активные дела</span>
              <strong>{activeCount}</strong>
            </div>

            <div className="sidebar-focus-card">
              <span>Архив</span>
              <strong>{archivedCount}</strong>
            </div>
          </div>

          <div className="sidebar-current-box">
            <span>Текущий фокус</span>
            <strong>{activeCase ? `Дело #${activeCase.id}` : "Дело не выбрано"}</strong>

            <div className="sidebar-current-meta">
              {activeCase
                ? activeCase.debtor_name || "Без названия должника"
                : "Открой дело из списка ниже"}
            </div>

            {activeCase ? (
              <div className="sidebar-current-meta" style={{ marginTop: 8 }}>
                {formatCaseStatus(activeCase.status)} ·{" "}
                {formatMoney(activeCase.principal_amount)} ₽
              </div>
            ) : null}
          </div>

          <div className="sidebar-current-box" style={{ marginTop: 12 }}>
            <span>Портфель</span>
            <strong>{safeCases.length} дел</strong>
            <div className="sidebar-current-meta" style={{ marginTop: 8 }}>
              Общая сумма: {formatMoney(totalAmount)} ₽
            </div>
          </div>
        </section>

        {children}

        <section className="sidebar-panel">
          <div className="sidebar-panel-header">
            <div>
              <div className="sidebar-panel-title">Портфель дел</div>
              <div className="sidebar-panel-subtitle">
                Все кейсы взыскания в одном месте
              </div>
            </div>

            <div className="sidebar-counter">{safeCases.length}</div>
          </div>

          <div className="sidebar-case-list">
            {safeCases.length ? (
              safeCases.map((item) => {
                const isCurrent = Number(selectedCase) === Number(item.id);

                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`sidebar-case-card ${isCurrent ? "is-current" : ""}`}
                    onClick={() => onSelect(item.id)}
                  >
                    <div className="sidebar-case-top">
                      <strong>Дело #{item.id}</strong>

                      <span className={statusClass(item.status)}>
                        {formatCaseStatus(item.status)}
                      </span>
                    </div>

                    <div className="sidebar-case-name">{item.debtor_name || "—"}</div>

                    <div className="sidebar-case-meta">
                      <span>{item.contract_type || "—"}</span>
                      <span>·</span>
                      <span>{formatMoney(item.principal_amount)} ₽</span>
                    </div>

                    <div className="sidebar-case-footer">
                      <span className="sidebar-case-footnote">
                        Срок: {item.due_date || "—"}
                      </span>

                      {item?.is_archived ? (
                        <span className="sidebar-archive-chip">Архив</span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="sidebar-empty-box">Дела пока не созданы.</div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
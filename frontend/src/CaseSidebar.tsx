import { ReactNode } from "react";

type Props = {
  cases: any[];
  selectedCase: number | null;
  onSelect: (caseId: number) => void;
  children?: ReactNode;
};

function formatCaseStatus(status?: string) {
  const map: Record<string, string> = {
    draft: "Черновик",
    overdue: "Просрочка",
    pretrial: "Досудебная стадия",
    court: "Суд",
    fssp: "ФССП",
    enforcement: "Исполнение",
    closed: "Закрыто",
  };
  return map[status || ""] || status || "—";
}

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

export default function CaseSidebar({
  cases,
  selectedCase,
  onSelect,
  children,
}: Props) {
  const activeCase = cases.find((item) => item.id === selectedCase) || null;
  const activeCount = cases.filter((item) => !item?.is_archived).length;
  const archivedCount = cases.filter((item) => Boolean(item?.is_archived)).length;

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
            <strong>
              {activeCase ? `Дело #${activeCase.id}` : "Дело не выбрано"}
            </strong>
            <div className="sidebar-current-meta">
              {activeCase ? activeCase.debtor_name || "Без названия должника" : "Открой дело из списка ниже"}
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

            <div className="sidebar-counter">{cases.length}</div>
          </div>

          <div className="sidebar-case-list">
            {cases.length ? (
              cases.map((item) => {
                const isCurrent = selectedCase === item.id;

                return (
                  <button
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
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
    closed: "Закрыто",
  };
  return map[status || ""] || status || "—";
}

function statusClass(status?: string) {
  return `status-badge status-${status || "draft"}`;
}

export default function CaseSidebar({
  cases,
  selectedCase,
  onSelect,
  children,
}: Props) {
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
                      <span>{item.principal_amount || "—"} ₽</span>
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
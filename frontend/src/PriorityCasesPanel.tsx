import { formatCaseStatus, formatDebtorType } from "./legalLabels";

type PriorityCaseItem = {
  case_id: number;
  debtor_name?: string;
  status?: string;
  contract_type?: string;
  debtor_type?: string;
  principal_amount?: string;
  due_date?: string | null;
  risk_score?: number;
  risk_level?: string;
  blocked?: boolean;
  blocked_reasons?: string[];
  inn?: string | null;
  ogrn?: string | null;
  is_archived?: boolean;
};

type Props = {
  dashboard?: any;
  selectedCase?: number | null;
  onOpenCase: (caseId: number) => void;
};

function riskLabel(level?: string): string {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };

  return map[level || ""] || level || "—";
}

function formatMoney(value: any): string {
  const num = Number(String(value ?? 0).replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";

  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sortPriorityCases(items: PriorityCaseItem[]): PriorityCaseItem[] {
  return [...items].sort((a, b) => {
    const riskDiff = Number(b?.risk_score || 0) - Number(a?.risk_score || 0);
    if (riskDiff !== 0) return riskDiff;

    const amountA = Number(String(a?.principal_amount ?? 0).replace(",", "."));
    const amountB = Number(String(b?.principal_amount ?? 0).replace(",", "."));
    if (amountB !== amountA) return amountB - amountA;

    return Number(b?.case_id || 0) - Number(a?.case_id || 0);
  });
}

export default function PriorityCasesPanel({
  dashboard,
  selectedCase,
  onOpenCase,
}: Props) {
  const items = sortPriorityCases(dashboard?.priority_cases?.items || []).slice(0, 8);

  return (
    <section className="panel control-room-priority-panel">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Top priority cases</div>
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Приоритетные дела
          </div>
          <div className="muted">
            Главный операционный shortlist: кейсы, которые нужно открывать в первую очередь.
          </div>
        </div>
      </div>

      {!items.length ? (
        <div className="empty-box" style={{ marginTop: 14 }}>
          Приоритетные дела пока не сформированы.
        </div>
      ) : (
        <div className="priority-case-list" style={{ marginTop: 14 }}>
          {items.map((item, index) => (
            <button
              key={item.case_id}
              className={`priority-case-row ${
                selectedCase === item.case_id ? "is-current" : ""
              }`}
              onClick={() => onOpenCase(item.case_id)}
            >
              <div className="priority-case-rank">{index + 1}</div>

              <div className="priority-case-main">
                <div className="priority-case-topline">
                  <strong>Дело #{item.case_id}</strong>

                  <span className={`status-badge status-${item.status || "draft"}`}>
                    {formatCaseStatus(item.status)}
                  </span>

                  {item.blocked ? (
                    <span className="status-badge status-not-ready">Blocked</span>
                  ) : null}

                  {item.is_archived ? (
                    <span className="status-badge status-draft">Архив</span>
                  ) : null}
                </div>

                <div className="priority-case-debtor">{item.debtor_name || "—"}</div>

                <div className="priority-case-meta">
                  <span>{item.contract_type || "—"}</span>
                  <span>·</span>
                  <span>{formatDebtorType(item.debtor_type)}</span>
                  <span>·</span>
                  <span>{formatMoney(item.principal_amount)} ₽</span>
                  <span>·</span>
                  <span>Срок: {item.due_date || "—"}</span>
                </div>

                <div className="priority-case-hint">
                  {item.blocked
                    ? item.blocked_reasons?.[0] || "Есть blocker, требуется разбор кейса"
                    : "Открыть карточку дела и продолжить взыскание"}
                </div>
              </div>

              <div className="priority-case-side">
                <div className={`risk-pill risk-${item.risk_level || "low"}`}>
                  {riskLabel(item.risk_level)}
                </div>

                <div className="priority-risk-score">{item.risk_score ?? 0}</div>

                {(item.inn || item.ogrn) && (
                  <div className="priority-routing">
                    {item.inn ? `ИНН: ${item.inn}` : ""}
                    {item.inn && item.ogrn ? " · " : ""}
                    {item.ogrn ? `ОГРН: ${item.ogrn}` : ""}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
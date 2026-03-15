import { formatCaseStatus } from "./legal";

type Props = {
  cases: any[];
  selectedCaseIds: number[];
  selectedCase: number | null;
  onOpenCase: (caseId: number) => void;
};

function parseAmount(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function hasDebtorIdentifiers(item: any): boolean {
  const inn = String(item?.debtor_profile?.inn || item?.inn || "").trim();
  const ogrn = String(item?.debtor_profile?.ogrn || item?.ogrn || "").trim();
  return Boolean(inn || ogrn);
}

function buildBuckets(cases: any[]) {
  const readyNow = cases.filter((item: any) =>
    ["overdue", "pretrial"].includes(String(item?.status || ""))
  );

  const waiting = cases.filter((item: any) =>
    ["draft"].includes(String(item?.status || ""))
  );

  const courtLane = cases.filter((item: any) =>
    ["court"].includes(String(item?.status || ""))
  );

  const fsspLane = cases.filter((item: any) =>
    ["fssp", "enforcement"].includes(String(item?.status || ""))
  );

  const closed = cases.filter((item: any) =>
    ["closed"].includes(String(item?.status || ""))
  );

  const blocked = cases.filter((item: any) => {
    const debtorNameMissing = !String(item?.debtor_name || "").trim();
    const amountMissing = !parseAmount(item?.principal_amount);
    const dueDateMissing = !String(item?.due_date || "").trim();
    const identifiersMissing = !hasDebtorIdentifiers(item);

    return debtorNameMissing || amountMissing || dueDateMissing || identifiersMissing;
  });

  return {
    readyNow,
    waiting,
    blocked,
    courtLane,
    fsspLane,
    closed,
  };
}

function priorityScore(item: any): number {
  const status = String(item?.status || "");
  const amount = parseAmount(item?.principal_amount);

  let score = amount;

  if (status === "pretrial") score += 200000;
  if (status === "overdue") score += 100000;
  if (status === "court") score += 50000;

  return score;
}

export default function PortfolioOperationsPanel({
  cases,
  selectedCaseIds,
  selectedCase,
  onOpenCase,
}: Props) {
  const buckets = buildBuckets(cases);

  const urgentCases = [...cases]
    .filter((item: any) => ["overdue", "pretrial", "court"].includes(String(item?.status || "")))
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 5);

  const blockedCases = [...buckets.blocked].slice(0, 5);

  const selectedCases = cases.filter((item: any) => selectedCaseIds.includes(item.id));
  const selectedAmount = selectedCases.reduce(
    (acc: number, item: any) => acc + parseAmount(item?.principal_amount),
    0
  );

  return (
    <section className="panel">
      <div className="panel-title">Операционный слой портфеля</div>

      <div className="ops-grid">
        <div className="ops-card">
          <div className="ops-card-title">Готово к взысканию</div>
          <div className="ops-card-value">{buckets.readyNow.length}</div>
          <div className="muted small">
            Дела на стадии просрочки и досудебного взыскания, по которым можно работать сейчас
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Ожидают срока</div>
          <div className="ops-card-value">{buckets.waiting.length}</div>
          <div className="muted small">
            Дела, которые ещё не дошли до активного этапа взыскания
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Заблокированы</div>
          <div className="ops-card-value">{buckets.blocked.length}</div>
          <div className="muted small">
            Не хватает ключевых реквизитов: должника, суммы, срока оплаты или идентификаторов
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">Судебная стадия</div>
          <div className="ops-card-value">{buckets.courtLane.length}</div>
          <div className="muted small">Дела, уже переведённые в судебный трек</div>
        </div>

        <div className="ops-card">
          <div className="ops-card-title">ФССП / исполнение</div>
          <div className="ops-card-value">{buckets.fsspLane.length}</div>
          <div className="muted small">
            Дела в исполнительном производстве или на этапе передачи приставам
          </div>
        </div>

        <div className="ops-card ops-card-accent">
          <div className="ops-card-title">Выбранный пакет</div>
          <div className="ops-card-value">{selectedCaseIds.length}</div>
          <div className="muted small">
            Совокупная сумма выбранных дел: {formatMoney(selectedAmount)} ₽
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18, marginBottom: 0 }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-title">Приоритетные дела</div>

          {urgentCases.length ? (
            <div className="related-cases-list">
              {urgentCases.map((item: any) => (
                <button
                  key={item.id}
                  className={`related-case-card ${selectedCase === item.id ? "is-current" : ""}`}
                  onClick={() => onOpenCase(item.id)}
                >
                  <div className="related-case-top">
                    <strong>Дело #{item.id}</strong>
                    <span className={`status-badge status-${item.status || "draft"}`}>
                      {formatCaseStatus(item.status)}
                    </span>
                  </div>

                  <div className="muted">{item.debtor_name || "—"}</div>
                  <div className="muted small">
                    {item.contract_type || "—"} · {item.principal_amount || "—"} ₽
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-box">
              Приоритетных дел по текущему фильтру пока нет.
            </div>
          )}
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-title">Дела с блокирующими проблемами</div>

          {blockedCases.length ? (
            <div className="related-cases-list">
              {blockedCases.map((item: any) => (
                <button
                  key={item.id}
                  className={`related-case-card ${selectedCase === item.id ? "is-current" : ""}`}
                  onClick={() => onOpenCase(item.id)}
                >
                  <div className="related-case-top">
                    <strong>Дело #{item.id}</strong>
                    <span className="status-badge status-not-ready">Требует доработки</span>
                  </div>

                  <div className="muted">{item.debtor_name || "Должник не указан"}</div>
                  <div className="muted small">
                    {item.contract_type || "—"} · {item.principal_amount || "—"} ₽
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-box">
              Явно заблокированных дел по текущему фильтру нет.
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18, marginBottom: 0 }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-title">Операционные рекомендации</div>

          <div className="ops-hints-list">
            <div className="ops-hint-card">
              <strong>Что брать в работу в первую очередь</strong>
              <div className="muted small">
                В первую очередь обрабатывай дела на стадии просрочки и досудебного взыскания с
                наибольшей суммой и полными реквизитами.
              </div>
            </div>

            <div className="ops-hint-card">
              <strong>Что мешает движению дела</strong>
              <div className="muted small">
                Заблокированные дела обычно требуют добора ИНН/ОГРН, суммы, срока оплаты или
                базовой структуры карточки дела.
              </div>
            </div>

            <div className="ops-hint-card">
              <strong>Как формировать пакетные действия</strong>
              <div className="muted small">
                Не смешивай в одном пакете досудебные, судебные и исполнительные действия.
                Пакеты должны быть однородными по стадии взыскания.
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-title">Сводка по стадиям</div>

          <div className="ops-hints-list">
            <div className="ops-hint-card">
              <strong>Ожидание</strong>
              <div className="muted small">
                {buckets.waiting.length} дел ещё не дошли до активного этапа взыскания.
              </div>
            </div>

            <div className="ops-hint-card">
              <strong>Судебное взыскание</strong>
              <div className="muted small">
                {buckets.courtLane.length} дел уже находятся в судебном треке.
              </div>
            </div>

            <div className="ops-hint-card">
              <strong>Исполнительное производство</strong>
              <div className="muted small">
                {buckets.fsspLane.length} дел находятся в треке ФССП / исполнения.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
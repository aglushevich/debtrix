import { useEffect, useMemo, useState } from "react";
import {
  applyAction,
  applySavedView,
  createSavedView,
  downloadDocument,
  getCaseParticipants,
  getCases,
  getDashboard,
  getDebtorProfile,
  getPortfolioCases,
  getSavedViews,
  getTimeline,
  identifyDebtor,
  lookupOrganization,
  PortfolioFilters,
  refreshDebtor,
  SavedViewItem,
  SoftPolicy,
  updateSoftPolicy,
} from "./api";
import CreateCaseForm from "./CreateCaseForm";
import RecoveryPanel from "./RecoveryPanel";
import CaseSidebar from "./CaseSidebar";
import IntelligencePanel from "./IntelligencePanel";
import DebtorDashboardPanel from "./DebtorDashboardPanel";
import DebtMapPanel from "./DebtMapPanel";
import DebtorGraphPanel from "./DebtorGraphPanel";
import OrganizationPanel from "./OrganizationPanel";
import IntegrationPanel from "./IntegrationPanel";
import ExternalActionsPanel from "./ExternalActionsPanel";
import PortfolioToolbar from "./PortfolioToolbar";
import SavedViewsPanel from "./SavedViewsPanel";
import BatchExecutionPanel from "./BatchExecutionPanel";
import PortfolioOperationsPanel from "./PortfolioOperationsPanel";
import PortfolioRoutingPanel from "./PortfolioRoutingPanel";
import ExecutionConsolePanel from "./ExecutionConsolePanel";
import WaitingBucketsPanel from "./WaitingBucketsPanel";
import ExecutionHistoryPanel from "./ExecutionHistoryPanel";
import {
  formatCaseStatus,
  formatDebtorType,
  formatDocumentCode,
  formatFlagLabel,
  formatParticipantRole,
  formatStageStatus,
} from "./legalLabels";

type ViewMode = "portfolio" | "case";

function buildDisplayedOrganization(debtorProfile: any, organizationPreview: any) {
  if (debtorProfile) {
    return {
      name: debtorProfile?.name || null,
      name_full: debtorProfile?.raw?.name_full || debtorProfile?.name || null,
      name_short: debtorProfile?.raw?.name_short || null,
      inn: debtorProfile?.inn || null,
      ogrn: debtorProfile?.ogrn || null,
      kpp: debtorProfile?.raw?.kpp || null,
      address: debtorProfile?.address || null,
      director_name: debtorProfile?.director_name || null,
      status: debtorProfile?.raw?.status || null,
      registration_date: debtorProfile?.raw?.registration_date || null,
      okved_main: debtorProfile?.raw?.okved_main || null,
      source: debtorProfile?.source || null,
    };
  }

  return organizationPreview;
}

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

const DEFAULT_SOFT_POLICY: SoftPolicy = {
  payment_due_notice_delay_days: 0,
  debt_notice_delay_days: 3,
  pretension_delay_days: 10,
};

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("portfolio");

  const [allCases, setAllCases] = useState<any[]>([]);
  const [portfolioCases, setPortfolioCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);

  const [dashboard, setDashboard] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [debtorProfile, setDebtorProfile] = useState<any>(null);
  const [organizationPreview, setOrganizationPreview] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [savedViews, setSavedViews] = useState<SavedViewItem[]>([]);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);

  const [filters, setFilters] = useState<PortfolioFilters>({
    q: "",
    include_archived: false,
  });

  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState("");

  const [debtorInn, setDebtorInn] = useState("");
  const [debtorOgrn, setDebtorOgrn] = useState("");
  const [debtorBusy, setDebtorBusy] = useState(false);
  const [debtorMessage, setDebtorMessage] = useState("");

  const [softPolicy, setSoftPolicy] = useState<SoftPolicy>(DEFAULT_SOFT_POLICY);
  const [softPolicyBusy, setSoftPolicyBusy] = useState(false);
  const [softPolicyMessage, setSoftPolicyMessage] = useState("");

  async function loadCases() {
    try {
      setLoadingCases(true);
      setError("");

      const [all, filtered, views] = await Promise.all([
        getCases(Boolean(filters.include_archived)),
        getPortfolioCases(filters),
        getSavedViews().catch(() => ({ items: [] })),
      ]);

      setAllCases(all || []);
      setPortfolioCases(filtered || []);
      setSavedViews(views.items || []);

      const currentSelectedExists =
        selectedCase && (filtered || []).some((item: any) => item.id === selectedCase);

      if (!currentSelectedExists) {
        const nextId = filtered?.[0]?.id || all?.[0]?.id || null;
        setSelectedCase(nextId);
      }
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить список дел");
    } finally {
      setLoadingCases(false);
    }
  }

  async function loadCaseData(id: number) {
    try {
      setLoadingCase(true);
      setError("");
      setDebtorMessage("");
      setSoftPolicyMessage("");
      setOrganizationPreview(null);

      const [dash, tl, parts] = await Promise.all([
        getDashboard(id),
        getTimeline(id),
        getCaseParticipants(id),
      ]);

      setDashboard(dash);
      setTimeline(tl);
      setParticipants(parts?.participants || []);
      setSoftPolicy(dash?.soft_policy || DEFAULT_SOFT_POLICY);

      try {
        const profile = await getDebtorProfile(id);
        setDebtorProfile(profile);
        setDebtorInn(profile?.inn || "");
        setDebtorOgrn(profile?.ogrn || "");
      } catch {
        setDebtorProfile(null);
        const debtorBlock: any = (dash as any)?.contract_data?.debtor || {};
        setDebtorInn(debtorBlock?.inn || "");
        setDebtorOgrn(debtorBlock?.ogrn || "");
      }
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить данные дела");
      setDashboard(null);
      setTimeline(null);
      setDebtorProfile(null);
      setOrganizationPreview(null);
      setParticipants([]);
      setSoftPolicy(DEFAULT_SOFT_POLICY);
    } finally {
      setLoadingCase(false);
    }
  }

  useEffect(() => {
    loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (selectedCase && viewMode === "case") {
      loadCaseData(selectedCase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCase, viewMode]);

  async function afterCreate(createdCase?: any) {
    await loadCases();
    if (createdCase?.id) {
      setSelectedCase(createdCase.id);
      setViewMode("case");
    }
  }

  function openCase(caseId: number) {
    setSelectedCase(caseId);
    setViewMode("case");
  }

  function returnToPortfolio() {
    setViewMode("portfolio");
  }

  async function runAction(code: string) {
    if (!selectedCase) return;

    try {
      setActionBusy(code);
      setError("");
      await applyAction(selectedCase, code);
      await Promise.all([loadCases(), loadCaseData(selectedCase)]);
    } catch (e: any) {
      setError(e?.message || "Не удалось выполнить действие");
    } finally {
      setActionBusy("");
    }
  }

  async function handleIdentifyDebtor() {
    if (!selectedCase) return;

    try {
      setDebtorBusy(true);
      setDebtorMessage("");
      await identifyDebtor(selectedCase, {
        inn: debtorInn || undefined,
        ogrn: debtorOgrn || undefined,
      });
      setDebtorMessage("Реквизиты должника сохранены.");
      await loadCaseData(selectedCase);
    } catch (e: any) {
      setDebtorMessage(e?.message || "Не удалось сохранить реквизиты должника.");
    } finally {
      setDebtorBusy(false);
    }
  }

  async function handleRefreshDebtor() {
    if (!selectedCase) return;

    try {
      setDebtorBusy(true);
      setDebtorMessage("");
      await refreshDebtor(selectedCase, {
        inn: debtorInn || undefined,
        ogrn: debtorOgrn || undefined,
      });
      setDebtorMessage("Профиль должника обновлён.");
      await loadCaseData(selectedCase);
    } catch (e: any) {
      setDebtorMessage(e?.message || "Не удалось обновить профиль должника.");
    } finally {
      setDebtorBusy(false);
    }
  }

  async function handleLookupOrganization() {
    try {
      setDebtorBusy(true);
      setDebtorMessage("");

      const found = await lookupOrganization({
        inn: debtorInn || undefined,
        ogrn: debtorOgrn || undefined,
      });

      setOrganizationPreview(found || null);

      if (found?.inn) setDebtorInn(found.inn);
      if (found?.ogrn) setDebtorOgrn(found.ogrn);

      setDebtorMessage(
        "Организация найдена. Проверьте данные и нажмите «Обновить профиль» для сохранения."
      );
    } catch (e: any) {
      setOrganizationPreview(null);
      setDebtorMessage(e?.message || "Не удалось найти организацию.");
    } finally {
      setDebtorBusy(false);
    }
  }

  async function handleSaveSoftPolicy() {
    if (!selectedCase) return;

    try {
      setSoftPolicyBusy(true);
      setSoftPolicyMessage("");
      await updateSoftPolicy(selectedCase, softPolicy);
      setSoftPolicyMessage("Настройки soft stage сохранены.");
      await loadCaseData(selectedCase);
    } catch (e: any) {
      setSoftPolicyMessage(e?.message || "Не удалось сохранить настройки soft stage.");
    } finally {
      setSoftPolicyBusy(false);
    }
  }

  async function handleSaveView(title: string) {
    await createSavedView({
      title,
      description: "Сохранённый вид портфеля взыскания",
      entity_type: "case",
      filters: filters,
      sorting: null,
      columns: ["id", "debtor_name", "contract_type", "status", "principal_amount"],
      is_default: false,
      is_shared: false,
    });

    const views = await getSavedViews();
    setSavedViews(views.items || []);
  }

  async function handleApplyView(item: SavedViewItem) {
    const result = await applySavedView(item.id);
    setActiveViewId(item.id);
    setFilters({
      ...(result.filters || item.filters || {}),
    });
    setSelectedCaseIds([]);
    setViewMode("portfolio");
  }

  function toggleCaseSelection(caseId: number) {
    setSelectedCaseIds((prev) =>
      prev.includes(caseId)
        ? prev.filter((id) => id !== caseId)
        : [...prev, caseId]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = portfolioCases.map((item: any) => item.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id: number) => selectedCaseIds.includes(id));

    if (allSelected) {
      setSelectedCaseIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedCaseIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  const recommendation =
    dashboard?.next_step?.title ||
    dashboard?.next_step?.title_ru ||
    "Проверьте доступные документы и текущую стадию взыскания.";

  const relatedCases = dashboard?.debtor_registry?.related_cases || [];
  const relatedSummary = dashboard?.debtor_registry?.summary || null;
  const debtorId = dashboard?.debtor_registry?.debtor?.id || null;

  const displayedOrganization = useMemo(
    () => buildDisplayedOrganization(debtorProfile, organizationPreview),
    [debtorProfile, organizationPreview]
  );

  const visibleSelectedCount = useMemo(() => {
    const visibleIds = new Set(portfolioCases.map((item: any) => item.id));
    return selectedCaseIds.filter((id) => visibleIds.has(id)).length;
  }, [portfolioCases, selectedCaseIds]);

  const selectedCaseCard = useMemo(
    () => allCases.find((item: any) => item.id === selectedCase) || null,
    [allCases, selectedCase]
  );

  const portfolioStats = useMemo(() => {
    const items = portfolioCases || [];
    const totalAmount = items.reduce(
      (acc: number, item: any) => acc + parseAmount(item?.principal_amount),
      0
    );

    return {
      total: items.length,
      draft: items.filter((item: any) => item?.status === "draft").length,
      overdue: items.filter((item: any) => item?.status === "overdue").length,
      pretrial: items.filter((item: any) => item?.status === "pretrial").length,
      court: items.filter((item: any) => item?.status === "court").length,
      fssp: items.filter((item: any) =>
        ["fssp", "enforcement"].includes(String(item?.status || ""))
      ).length,
      closed: items.filter((item: any) => item?.status === "closed").length,
      totalAmount,
    };
  }, [portfolioCases]);

  return (
    <div className="layout">
      <CaseSidebar
        cases={allCases}
        selectedCase={selectedCase}
        onSelect={openCase}
      >
        <CreateCaseForm onCreated={afterCreate} />
        {loadingCases && <div className="muted">Обновление списка дел…</div>}
      </CaseSidebar>

      <main className="workbench">
        <header className="topbar">
          <div>
            <h1>
              {viewMode === "portfolio"
                ? "Debtrix — управление портфелем взыскания"
                : `Debtrix — дело №${selectedCase ?? "—"}`}
            </h1>
            <div className="muted">
              {viewMode === "portfolio"
                ? "Рабочее пространство взыскателя"
                : "Карточка дела, документы, действия, интеграции и история"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {viewMode === "case" && (
              <button className="secondary-btn" onClick={returnToPortfolio}>
                Вернуться к портфелю
              </button>
            )}
            {viewMode === "portfolio" && selectedCase && (
              <button className="secondary-btn" onClick={() => openCase(selectedCase)}>
                Открыть выбранное дело
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="panel error-panel">
            <div className="panel-title">Ошибка</div>
            <div>{error}</div>
          </div>
        )}

        {viewMode === "portfolio" && (
          <>
            <section className="kpi-strip">
              <div className="kpi-card">
                <span className="kpi-label">Всего дел</span>
                <strong className="kpi-value">{portfolioStats.total}</strong>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Черновики</span>
                <strong className="kpi-value">{portfolioStats.draft}</strong>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Просрочено</span>
                <strong className="kpi-value">{portfolioStats.overdue}</strong>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Досудебно</span>
                <strong className="kpi-value">{portfolioStats.pretrial}</strong>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Суд</span>
                <strong className="kpi-value">{portfolioStats.court}</strong>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">ФССП</span>
                <strong className="kpi-value">{portfolioStats.fssp}</strong>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Завершено</span>
                <strong className="kpi-value">{portfolioStats.closed}</strong>
              </div>
            </section>

            <section className="panel">
              <div className="control-room-header">
                <div>
                  <div className="panel-title" style={{ marginBottom: 6 }}>
                    Recovery Control Room
                  </div>
                  <div className="muted">
                    Выбрано для пакетной обработки: {selectedCaseIds.length}. Видимых дел:{" "}
                    {portfolioCases.length}. Общая сумма: {formatMoney(portfolioStats.totalAmount)} ₽
                  </div>
                </div>

                <div className="action-list">
                  {selectedCase && (
                    <button className="secondary-btn" onClick={() => openCase(selectedCase)}>
                      Открыть текущее дело
                    </button>
                  )}
                </div>
              </div>
            </section>

            <PortfolioOperationsPanel
              cases={portfolioCases}
              selectedCaseIds={selectedCaseIds}
              selectedCase={selectedCase}
              onOpenCase={openCase}
            />

            <PortfolioRoutingPanel />

            <WaitingBucketsPanel onOpenCase={openCase} />

            <PortfolioToolbar
              filters={filters}
              onChange={setFilters}
              onSaveView={handleSaveView}
            />

            <SavedViewsPanel
              items={savedViews}
              activeViewId={activeViewId}
              onApply={handleApplyView}
            />

            <section className="panel">
              <div className="panel-title">Отобранные дела</div>

              <div className="action-list" style={{ marginBottom: 16 }}>
                <button className="secondary-btn" onClick={toggleSelectAllVisible}>
                  {visibleSelectedCount === portfolioCases.length && portfolioCases.length > 0
                    ? "Снять выделение с видимых"
                    : "Выбрать все видимые"}
                </button>

                <span className="muted">
                  Выделено: {selectedCaseIds.length} из {portfolioCases.length} видимых дел
                </span>
              </div>

              {portfolioCases.length ? (
                <div className="participants-list">
                  {portfolioCases.map((item: any) => {
                    const checked = selectedCaseIds.includes(item.id);
                    const isActive = selectedCase === item.id;

                    return (
                      <div
                        className="participant-card"
                        key={item.id}
                        style={{
                          border: isActive ? "2px solid #2563eb" : undefined,
                          boxShadow: isActive
                            ? "0 0 0 3px rgba(37, 99, 235, 0.08)"
                            : undefined,
                        }}
                      >
                        <div className="participant-card-top">
                          <div>
                            <div className="participant-role">Дело №{item.id}</div>
                            <div className="participant-name">{item.debtor_name || "—"}</div>
                          </div>

                          <div className="participant-badges">
                            {isActive && (
                              <span className="status-badge status-ready">Открыто</span>
                            )}
                            <span className={`status-badge status-${item.status || "draft"}`}>
                              {formatCaseStatus(item.status)}
                            </span>
                          </div>
                        </div>

                        <div className="participant-meta-grid">
                          <div className="info-item">
                            <span className="label">Тип договора</span>
                            <strong>{item.contract_type_title || item.contract_type || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">Тип должника</span>
                            <strong>
                              {item.debtor_type_title || formatDebtorType(item.debtor_type)}
                            </strong>
                          </div>

                          <div className="info-item">
                            <span className="label">Сумма задолженности</span>
                            <strong>{item.principal_amount || "—"} ₽</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">Срок оплаты</span>
                            <strong>{item.due_date || "—"}</strong>
                          </div>
                        </div>

                        <div className="document-actions" style={{ marginTop: 12 }}>
                          <button className="primary-btn" onClick={() => openCase(item.id)}>
                            Открыть дело
                          </button>

                          <button
                            className={checked ? "primary-btn" : "secondary-btn"}
                            onClick={() => toggleCaseSelection(item.id)}
                          >
                            {checked ? "Убрать из пакета" : "Добавить в пакет"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-box">По текущему фильтру дела не найдены.</div>
              )}
            </section>

            <BatchExecutionPanel
              selectedCaseIds={selectedCaseIds}
              onCompleted={async () => {
                await loadCases();
              }}
            />

            <ExecutionConsolePanel />
          </>
        )}

        {viewMode === "case" && (
          <div className="case-workspace">
            <div className="case-main">
              {loadingCase && <div className="panel">Загрузка данных дела…</div>}

              {!loadingCase && !dashboard && !error && (
                <div className="panel">Выберите дело в портфеле или создайте новое.</div>
              )}

              {!loadingCase && dashboard && (
                <>
                  <section className="panel" style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 14,
                      }}
                    >
                      <div className="info-item">
                        <span className="label">Активное дело</span>
                        <strong>№{selectedCase}</strong>
                      </div>
                      <div className="info-item">
                        <span className="label">Должник</span>
                        <strong>
                          {selectedCaseCard?.debtor_name || dashboard.case?.debtor_name || "—"}
                        </strong>
                      </div>
                      <div className="info-item">
                        <span className="label">Статус дела</span>
                        <strong>
                          {dashboard.case?.status_title ||
                            formatCaseStatus(dashboard.case?.status)}
                        </strong>
                      </div>
                      <div className="info-item">
                        <span className="label">Следующее действие</span>
                        <strong>
                          {dashboard.next_step?.title_ru ||
                            dashboard.next_step?.title ||
                            "—"}
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section className="dashboard-grid">
                    <div className="panel">
                      <div className="panel-title">Карточка дела</div>

                      <div className="info-grid">
                        <div className="info-item">
                          <span className="label">Должник</span>
                          <strong>{dashboard.case?.debtor_name || "—"}</strong>
                        </div>

                        <div className="info-item">
                          <span className="label">Тип должника</span>
                          <strong>
                            {dashboard.case?.debtor_type_title ||
                              formatDebtorType(dashboard.case?.debtor_type)}
                          </strong>
                        </div>

                        <div className="info-item">
                          <span className="label">Тип договора</span>
                          <strong>
                            {dashboard.case?.contract_type_title ||
                              dashboard.case?.contract_type ||
                              "—"}
                          </strong>
                        </div>

                        <div className="info-item">
                          <span className="label">Сумма задолженности</span>
                          <strong>{dashboard.case?.principal_amount || "—"} ₽</strong>
                        </div>

                        <div className="info-item">
                          <span className="label">Срок оплаты</span>
                          <strong>{dashboard.case?.due_date || "—"}</strong>
                        </div>

                        <div className="info-item">
                          <span className="label">Статус дела</span>
                          <strong>
                            {dashboard.case?.status_title ||
                              formatCaseStatus(dashboard.case?.status)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-title">Стадия взыскания и следующий шаг</div>

                      {dashboard.next_step ? (
                        <div className="next-step-box">
                          <div className="next-step-title">
                            {dashboard.next_step.title_ru || dashboard.next_step.title}
                          </div>
                          <div className="muted">Код действия: {dashboard.next_step.code}</div>
                        </div>
                      ) : (
                        <div className="empty-box">Доступные действия отсутствуют.</div>
                      )}

                      <div className="stage-block">
                        <div className="label">Текущая стадия</div>
                        <div className="stage-title">
                          {dashboard.stage?.status_title ||
                            formatStageStatus(dashboard.stage?.status)}
                        </div>

                        <div className="flag-list">
                          {Object.entries(dashboard.stage?.flags || {}).map(([key, value]) => (
                            <span
                              key={key}
                              className={`mini-badge ${value ? "ok" : "muted-badge"}`}
                            >
                              {formatFlagLabel(key)}: {value ? "да" : "нет"}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="dashboard-grid dashboard-grid-secondary">
                    <div className="panel">
                      <div className="panel-title">Рекомендация по взысканию</div>
                      <div className="recommendation-box">
                        <div className="recommendation-title">{recommendation}</div>
                        <div className="muted">
                          Используйте это как основной следующий шаг по делу.
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-title">Профиль должника</div>

                      <div className="debtor-actions-form">
                        <div className="debtor-actions-row">
                          <input
                            className="small-input"
                            placeholder="ИНН"
                            value={debtorInn}
                            onChange={(e) => setDebtorInn(e.target.value)}
                          />
                          <input
                            className="small-input"
                            placeholder="ОГРН"
                            value={debtorOgrn}
                            onChange={(e) => setDebtorOgrn(e.target.value)}
                          />
                        </div>

                        <div className="debtor-actions-buttons">
                          <button
                            className="secondary-btn"
                            onClick={handleLookupOrganization}
                            disabled={debtorBusy}
                          >
                            {debtorBusy ? "Поиск…" : "Проверить организацию"}
                          </button>

                          <button
                            className="secondary-btn"
                            onClick={handleIdentifyDebtor}
                            disabled={debtorBusy}
                          >
                            {debtorBusy ? "Сохранение…" : "Сохранить реквизиты"}
                          </button>

                          <button
                            className="primary-btn"
                            onClick={handleRefreshDebtor}
                            disabled={debtorBusy}
                          >
                            {debtorBusy ? "Обновление…" : "Обновить профиль"}
                          </button>
                        </div>

                        {debtorMessage && (
                          <div className="debtor-actions-message">{debtorMessage}</div>
                        )}
                      </div>

                      {displayedOrganization ? (
                        <div className="info-grid" style={{ marginTop: 14 }}>
                          <div className="info-item info-item-wide">
                            <span className="label">Полное наименование</span>
                            <strong>{displayedOrganization.name_full || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">ИНН</span>
                            <strong>{displayedOrganization.inn || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">ОГРН</span>
                            <strong>{displayedOrganization.ogrn || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">КПП</span>
                            <strong>{displayedOrganization.kpp || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">Руководитель</span>
                            <strong>{displayedOrganization.director_name || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">Статус</span>
                            <strong>{displayedOrganization.status || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">Дата регистрации</span>
                            <strong>{displayedOrganization.registration_date || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">Основной ОКВЭД</span>
                            <strong>{displayedOrganization.okved_main || "—"}</strong>
                          </div>

                          <div className="info-item info-item-wide">
                            <span className="label">Адрес</span>
                            <strong>{displayedOrganization.address || "—"}</strong>
                          </div>

                          <div className="info-item">
                            <span className="label">Источник данных</span>
                            <strong>{displayedOrganization.source || "—"}</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="empty-box" style={{ marginTop: 14 }}>
                          Профиль должника пока не загружен.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="panel-title">Настройки soft stage</div>

                    <div className="muted" style={{ marginBottom: 14 }}>
                      Эти сроки определяют внутреннюю политику кредитора до перехода к
                      досудебной претензии.
                    </div>

                    <div className="info-grid" style={{ marginBottom: 14 }}>
                      <div className="info-item">
                        <span className="label">
                          Первое уведомление после срока оплаты, дней
                        </span>
                        <input
                          className="small-input"
                          type="number"
                          min={0}
                          value={softPolicy.payment_due_notice_delay_days}
                          onChange={(e) =>
                            setSoftPolicy((prev) => ({
                              ...prev,
                              payment_due_notice_delay_days: Number(e.target.value || 0),
                            }))
                          }
                        />
                      </div>

                      <div className="info-item">
                        <span className="label">
                          Уведомление о задолженности, дней
                        </span>
                        <input
                          className="small-input"
                          type="number"
                          min={0}
                          value={softPolicy.debt_notice_delay_days}
                          onChange={(e) =>
                            setSoftPolicy((prev) => ({
                              ...prev,
                              debt_notice_delay_days: Number(e.target.value || 0),
                            }))
                          }
                        />
                      </div>

                      <div className="info-item">
                        <span className="label">Досудебная претензия, дней</span>
                        <input
                          className="small-input"
                          type="number"
                          min={0}
                          value={softPolicy.pretension_delay_days}
                          onChange={(e) =>
                            setSoftPolicy((prev) => ({
                              ...prev,
                              pretension_delay_days: Number(e.target.value || 0),
                            }))
                          }
                        />
                      </div>

                      <div className="info-item">
                        <span className="label">Базовая дата</span>
                        <strong>
                          {dashboard?.policy_timing?.base_due_date ||
                            dashboard?.case?.due_date ||
                            "—"}
                        </strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Дата первого уведомления</span>
                        <strong>
                          {dashboard?.policy_timing?.payment_due_notice_eligible_at || "—"}
                        </strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Дата уведомления о задолженности</span>
                        <strong>
                          {dashboard?.policy_timing?.debt_notice_eligible_at || "—"}
                        </strong>
                      </div>

                      <div className="info-item">
                        <span className="label">Дата досудебной претензии</span>
                        <strong>
                          {dashboard?.policy_timing?.pretension_eligible_at || "—"}
                        </strong>
                      </div>
                    </div>

                    <div className="action-list">
                      <button
                        className="primary-btn"
                        onClick={handleSaveSoftPolicy}
                        disabled={softPolicyBusy}
                      >
                        {softPolicyBusy ? "Сохранение…" : "Сохранить настройки"}
                      </button>
                    </div>

                    {softPolicyMessage && (
                      <div className="form-message" style={{ marginTop: 12 }}>
                        {softPolicyMessage}
                      </div>
                    )}
                  </section>

                  <OrganizationPanel caseId={selectedCase} onOpenCase={openCase} />
                  <IntegrationPanel caseId={selectedCase} />
                  <ExternalActionsPanel caseId={selectedCase} />

                  <section className="panel">
                    <div className="panel-title">Участники дела</div>

                    {participants.length ? (
                      <div className="participants-list">
                        {participants.map((participant: any) => (
                          <div className="participant-card" key={participant.id}>
                            <div className="participant-card-top">
                              <div>
                                <div className="participant-role">
                                  {formatParticipantRole(participant.role)}
                                </div>
                                <div className="participant-name">
                                  {participant.party?.name || "—"}
                                </div>
                              </div>

                              <div className="participant-badges">
                                {participant.is_primary && (
                                  <span className="status-badge status-ready">
                                    Основной участник
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="participant-meta-grid">
                              <div className="info-item">
                                <span className="label">Тип участника</span>
                                <strong>{formatDebtorType(participant.party?.debtor_type)}</strong>
                              </div>

                              <div className="info-item">
                                <span className="label">ИНН</span>
                                <strong>{participant.party?.inn || "—"}</strong>
                              </div>

                              <div className="info-item">
                                <span className="label">ОГРН</span>
                                <strong>{participant.party?.ogrn || "—"}</strong>
                              </div>

                              <div className="info-item">
                                <span className="label">Руководитель</span>
                                <strong>{participant.party?.director_name || "—"}</strong>
                              </div>

                              <div className="info-item info-item-wide">
                                <span className="label">Адрес</span>
                                <strong>{participant.party?.address || "—"}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-box">Участники дела пока не сформированы.</div>
                    )}
                  </section>

                  <DebtMapPanel caseId={selectedCase} onOpenCase={openCase} />
                  <DebtorGraphPanel caseId={selectedCase} onOpenCase={openCase} />
                  <DebtorDashboardPanel debtorId={debtorId} onOpenCase={openCase} />

                  <section className="panel">
                    <div className="panel-title">Другие дела этого должника</div>

                    {relatedSummary && (
                      <div className="debtor-cases-summary">
                        <div className="summary-card">
                          <span className="label">Количество дел</span>
                          <strong>{relatedSummary.cases_count || 0}</strong>
                        </div>
                        <div className="summary-card">
                          <span className="label">Общая сумма задолженности</span>
                          <strong>{relatedSummary.total_principal_amount || "0.00"} ₽</strong>
                        </div>
                      </div>
                    )}

                    <div className="related-cases-list">
                      {relatedCases.length ? (
                        relatedCases.map((item: any) => (
                          <button
                            key={item.case_id}
                            className={`related-case-card ${item.is_current ? "is-current" : ""}`}
                            onClick={() => openCase(item.case_id)}
                          >
                            <div className="related-case-top">
                              <strong>Дело №{item.case_id}</strong>
                              <span className={`status-badge status-${item.status}`}>
                                {item.status_title || formatCaseStatus(item.status)}
                              </span>
                            </div>

                            <div className="muted">
                              {(item.contract_type_title || item.contract_type || "—") +
                                " · " +
                                (item.principal_amount || "—") +
                                " ₽"}
                            </div>

                            <div className="muted small">Срок оплаты: {item.due_date || "—"}</div>
                          </button>
                        ))
                      ) : (
                        <div className="empty-box">Других дел по должнику пока нет.</div>
                      )}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="panel-title">Доступные действия</div>

                    <div className="action-list">
                      {dashboard.actions?.length ? (
                        dashboard.actions.map((a: any) => (
                          <button
                            key={a.code}
                            className="primary-btn"
                            disabled={actionBusy === a.code}
                            onClick={() => runAction(a.code)}
                          >
                            {actionBusy === a.code
                              ? "Выполнение…"
                              : a.title_ru || a.title}
                          </button>
                        ))
                      ) : (
                        <div className="empty-box">Доступные действия отсутствуют.</div>
                      )}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="panel-title">Документы</div>

                    <div className="document-list">
                      {dashboard.documents?.length ? (
                        dashboard.documents.map((d: any) => (
                          <div className="document-card" key={d.code}>
                            <div className="document-card-top">
                              <div>
                                <div className="document-title">
                                  {d.title_ru || d.title || formatDocumentCode(d.code)}
                                </div>
                                <div className="muted">{d.code}</div>
                              </div>

                              <span
                                className={`status-badge ${
                                  d.ready ? "status-ready" : "status-not-ready"
                                }`}
                              >
                                {d.ready ? "Готов к формированию" : "Требуются данные"}
                              </span>
                            </div>

                            {d.missing_fields?.length > 0 && (
                              <div className="missing-fields">
                                Недостающие данные: {d.missing_fields.join(", ")}
                              </div>
                            )}

                            <div className="document-actions">
                              <button
                                className="secondary-btn"
                                disabled={!d.ready}
                                onClick={() => downloadDocument(selectedCase!, d.code, "pdf")}
                              >
                                Скачать PDF
                              </button>
                              <button
                                className="secondary-btn"
                                disabled={!d.ready}
                                onClick={() => downloadDocument(selectedCase!, d.code, "docx")}
                              >
                                Скачать DOCX
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-box">Документы пока недоступны.</div>
                      )}
                    </div>
                  </section>

                  <RecoveryPanel caseId={selectedCase} />
                  <ExecutionHistoryPanel caseId={selectedCase} />

                  <section className="panel">
                    <div className="panel-title">Хронология дела</div>

                    <div className="timeline-list">
                      {timeline?.items?.length ? (
                        timeline.items.map((t: any) => (
                          <div className="timeline-item" key={t.id}>
                            <div className="timeline-item-top">
                              <strong>{t.title}</strong>
                              <span className="muted small">{t.created_at}</span>
                            </div>
                            <div>{t.details}</div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-box">История дела пока пуста.</div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>

            <IntelligencePanel dashboard={dashboard} />
          </div>
        )}
      </main>
    </div>
  );
}
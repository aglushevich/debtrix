import { useEffect, useMemo, useState } from "react";
import {
  applyAction,
  applySavedView,
  createSavedView,
  downloadDocument,
  getCaseParticipants,
  getCases,
  getControlRoomDashboard,
  getDashboard,
  getDebtorProfile,
  getPortfolioCases,
  getPortfolioRouting,
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
import CaseSidebar from "./CaseSidebar";
import PortfolioToolbar from "./PortfolioToolbar";
import SavedViewsPanel from "./SavedViewsPanel";
import BatchExecutionPanel from "./BatchExecutionPanel";
import PortfolioOperationsPanel from "./PortfolioOperationsPanel";
import ExecutionConsolePanel from "./ExecutionConsolePanel";
import PortfolioCasesTable from "./PortfolioCasesTable";
import PortfolioLaneBoard from "./PortfolioLaneBoard";
import PortfolioActionDock from "./PortfolioActionDock";
import PriorityCasesPanel from "./PriorityCasesPanel";
import type { PriorityPreset } from "./PriorityCasesPanel";
import ControlRoomKPIs from "./ControlRoomKPIs";
import IntelligencePortfolioPanel from "./IntelligencePortfolioPanel";
import RoutingOverviewPanel from "./RoutingOverviewPanel";
import WaitingBucketsPanel from "./WaitingBucketsPanel";
import type { WaitingPreset } from "./WaitingBucketsPanel";
import ExecutionSummaryPanel from "./ExecutionSummaryPanel";
import FocusQueuesPanel from "./FocusQueuesPanel";
import CaseWorkspace from "./CaseWorkspace";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import ControlRoomHero from "./ControlRoomHero";
import ControlRoomLayout from "./ControlRoomLayout";
import { buildPortfolioCaseRows, PortfolioCaseRow } from "./portfolioSmart";
import {
  DEFAULT_PORTFOLIO_SORTING,
  PortfolioSorting,
  sortPortfolioCaseRows,
} from "./portfolioSorting";
import { applySmartPortfolioFilters } from "./portfolioFilters";

type ViewMode = "portfolio" | "case";

type PortfolioSection =
  | "overview"
  | "lanes"
  | "registry"
  | "batch"
  | "execution"
  | "filters";

type RoutingBucketCode = "ready" | "waiting" | "blocked" | "idle";

type FocusQueueCode =
  | "urgent_ready"
  | "blocked_cleanup"
  | "waiting_next"
  | "court_lane"
  | "enforcement_lane";

type ControlRoomPreset =
  | {
      type: "routing_bucket";
      value: RoutingBucketCode;
    }
  | {
      type: "focus_queue";
      value: FocusQueueCode;
    }
  | {
      type: "priority_preset";
      value: PriorityPreset;
    }
  | {
      type: "waiting_preset";
      value: WaitingPreset;
    }
  | null;

const portfolioSectionButtons: Array<{ key: PortfolioSection; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "lanes", label: "Routing lanes" },
  { key: "registry", label: "Registry" },
  { key: "batch", label: "Batch" },
  { key: "execution", label: "Execution" },
  { key: "filters", label: "Filters" },
];

const DEFAULT_SOFT_POLICY: SoftPolicy = {
  payment_due_notice_delay_days: 0,
  debt_notice_delay_days: 3,
  pretension_delay_days: 10,
};

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

function normalizeSorting(input: any): PortfolioSorting {
  const key = String(input?.key || DEFAULT_PORTFOLIO_SORTING.key);
  const direction = String(input?.direction || DEFAULT_PORTFOLIO_SORTING.direction);

  const allowedKeys = new Set([
    "priority",
    "readiness",
    "smart_level",
    "warnings",
    "duplicates",
    "amount",
    "due_date",
    "status",
    "id",
  ]);

  const allowedDirections = new Set(["asc", "desc"]);

  return {
    key: allowedKeys.has(key)
      ? (key as PortfolioSorting["key"])
      : DEFAULT_PORTFOLIO_SORTING.key,
    direction: allowedDirections.has(direction)
      ? (direction as PortfolioSorting["direction"])
      : DEFAULT_PORTFOLIO_SORTING.direction,
  };
}

function normalizeFilters(input: any): PortfolioFilters {
  return {
    q: input?.q || "",
    status: input?.status || undefined,
    contract_type: input?.contract_type || undefined,
    debtor_type: input?.debtor_type || undefined,
    include_archived: Boolean(input?.include_archived),
    smart_level: (input?.smart_level || "") as PortfolioFilters["smart_level"],
    priority_band: (input?.priority_band || "") as PortfolioFilters["priority_band"],
    warnings_only: Boolean(input?.warnings_only),
    duplicates_only: Boolean(input?.duplicates_only),
  };
}

function matchesControlRoomPreset(
  row: PortfolioCaseRow,
  preset: ControlRoomPreset
): boolean {
  if (!preset) return true;

  const routingStatus = String(row.smart?.routingStatus || "").toLowerCase();
  const smartLevel = String(row.smart?.smartLevel || "").toLowerCase();
  const routeLane = String(row.smart?.routeLane || "").toLowerCase();
  const status = String(row.status || "").toLowerCase();
  const priorityBand = String(
    row.priority_band || row.smart?.priorityBand || ""
  ).toLowerCase();

  if (preset.type === "routing_bucket") {
    if (preset.value === "ready") return routingStatus === "ready";
    if (preset.value === "waiting") return routingStatus === "waiting";
    if (preset.value === "blocked") return routingStatus === "blocked";
    if (preset.value === "idle") return routingStatus === "idle";
  }

  if (preset.type === "focus_queue") {
    switch (preset.value) {
      case "urgent_ready":
        return routingStatus === "ready" || smartLevel === "ready";

      case "blocked_cleanup":
        return routingStatus === "blocked" || smartLevel === "blocked";

      case "waiting_next":
        return routingStatus === "waiting" || smartLevel === "waiting";

      case "court_lane":
        return routeLane === "court_lane" || status === "court";

      case "enforcement_lane":
        return (
          routeLane === "enforcement_lane" ||
          status === "fssp" ||
          status === "enforcement"
        );

      default:
        return true;
    }
  }

  if (preset.type === "priority_preset") {
    switch (preset.value) {
      case "critical":
        return priorityBand === "critical";

      case "high":
        return priorityBand === "high";

      case "blocked_cleanup":
        return routingStatus === "blocked" || smartLevel === "blocked";

      case "urgent_ready":
        return (
          !["blocked", "waiting"].includes(routingStatus) &&
          (priorityBand === "critical" || priorityBand === "high")
        );

      default:
        return true;
    }
  }

  if (preset.type === "waiting_preset") {
    if (preset.value === "waiting_next") {
      return routingStatus === "waiting" || smartLevel === "waiting";
    }
  }

  return true;
}

function controlRoomPresetLabel(preset: ControlRoomPreset): string | null {
  if (!preset) return null;

  if (preset.type === "routing_bucket") {
    const map: Record<RoutingBucketCode, string> = {
      ready: "Routing: Ready",
      waiting: "Routing: Waiting",
      blocked: "Routing: Blocked",
      idle: "Routing: Idle",
    };
    return map[preset.value];
  }

  if (preset.type === "focus_queue") {
    const map: Record<FocusQueueCode, string> = {
      urgent_ready: "Focus queue: Urgent ready",
      blocked_cleanup: "Focus queue: Blocked cleanup",
      waiting_next: "Focus queue: Waiting next",
      court_lane: "Focus queue: Court lane",
      enforcement_lane: "Focus queue: Enforcement lane",
    };
    return map[preset.value];
  }

  if (preset.type === "priority_preset") {
    const map: Record<PriorityPreset, string> = {
      critical: "Priority preset: Critical",
      high: "Priority preset: High",
      blocked_cleanup: "Priority preset: Blocked cleanup",
      urgent_ready: "Priority preset: Urgent ready",
    };
    return map[preset.value];
  }

  if (preset.type === "waiting_preset") {
    const map: Record<WaitingPreset, string> = {
      waiting_next: "Waiting preset: Waiting next",
    };
    return map[preset.value];
  }

  return null;
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("portfolio");
  const [portfolioSection, setPortfolioSection] =
    useState<PortfolioSection>("overview");

  const [allCases, setAllCases] = useState<any[]>([]);
  const [portfolioCases, setPortfolioCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);

  const [dashboard, setDashboard] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [controlRoomDashboard, setControlRoomDashboard] = useState<any>(null);
  const [portfolioRouting, setPortfolioRouting] = useState<any>(null);
  const [debtorProfile, setDebtorProfile] = useState<any>(null);
  const [organizationPreview, setOrganizationPreview] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [savedViews, setSavedViews] = useState<SavedViewItem[]>([]);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  const [executionRefreshKey, setExecutionRefreshKey] = useState(0);
  const [controlRoomPreset, setControlRoomPreset] = useState<ControlRoomPreset>(null);

  const [filters, setFilters] = useState<PortfolioFilters>({
    q: "",
    include_archived: false,
    smart_level: "",
    priority_band: "",
    warnings_only: false,
    duplicates_only: false,
  });

  const [sorting, setSorting] = useState<PortfolioSorting>(DEFAULT_PORTFOLIO_SORTING);

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

      const [all, filtered, views, controlRoom, routing] = await Promise.all([
        getCases(Boolean(filters.include_archived)),
        getPortfolioCases(filters),
        getSavedViews().catch(() => ({ items: [] })),
        getControlRoomDashboard().catch(() => null),
        getPortfolioRouting().catch(() => null),
      ]);

      const nextAllCases = Array.isArray(all) ? all : [];
      const nextPortfolioCases = Array.isArray(filtered) ? filtered : [];

      setAllCases(nextAllCases);
      setPortfolioCases(nextPortfolioCases);
      setSavedViews(views.items || []);
      setControlRoomDashboard(controlRoom || null);
      setPortfolioRouting(routing || null);

      const currentSelectedExists =
        selectedCase != null &&
        nextAllCases.some((item: any) => Number(item.id) === Number(selectedCase));

      if (!currentSelectedExists) {
        const nextId = nextPortfolioCases?.[0]?.id || nextAllCases?.[0]?.id || null;
        setSelectedCase(nextId);
      }

      setSelectedCaseIds((prev) =>
        prev.filter((id) => nextAllCases.some((item: any) => Number(item.id) === Number(id)))
      );
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
        const debtorBlock: any = dash?.contract_data?.debtor || {};
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
    void loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (selectedCase && viewMode === "case") {
      void loadCaseData(selectedCase);
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
      filters,
      sorting,
      columns: [
        "id",
        "debtor_name",
        "contract_type",
        "status",
        "principal_amount",
        "priority_score",
        "priority_band",
        "readiness_score",
        "smart_level",
        "warnings_count",
        "duplicates_count",
      ],
      is_default: false,
      is_shared: false,
    });

    const views = await getSavedViews();
    setSavedViews(views.items || []);
  }

  async function handleApplyView(item: SavedViewItem) {
    const result = await applySavedView(item.id);

    setActiveViewId(item.id);
    setControlRoomPreset(null);
    setSelectedCaseIds([]);
    setViewMode("portfolio");

    setFilters(normalizeFilters(result.filters || item.filters || {}));
    setSorting(
      normalizeSorting(result.view?.sorting || item.sorting || DEFAULT_PORTFOLIO_SORTING)
    );
  }

  function handleChangeFilters(next: PortfolioFilters) {
    setActiveViewId(null);
    setControlRoomPreset(null);
    setFilters(next);
  }

  function handleChangeSorting(next: PortfolioSorting) {
    setSorting(next);
  }

  function toggleCaseSelection(caseId: number) {
    setSelectedCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  }

  function applyControlRoomPreset(preset: ControlRoomPreset) {
    setViewMode("portfolio");
    setPortfolioSection("registry");
    setActiveViewId(null);
    setControlRoomPreset(preset);
    setSelectedCaseIds([]);
  }

  function handleOpenRoutingBucket(bucket: RoutingBucketCode) {
    applyControlRoomPreset({
      type: "routing_bucket",
      value: bucket,
    });
  }

  function handleOpenFocusQueue(queueCode: FocusQueueCode) {
    applyControlRoomPreset({
      type: "focus_queue",
      value: queueCode,
    });
  }

  function handleOpenPriorityPreset(preset: PriorityPreset) {
    applyControlRoomPreset({
      type: "priority_preset",
      value: preset,
    });
  }

  function handleOpenWaitingPreset(preset: WaitingPreset) {
    applyControlRoomPreset({
      type: "waiting_preset",
      value: preset,
    });
  }

  function clearControlRoomPreset() {
    setControlRoomPreset(null);
  }

  const portfolioCaseRows = useMemo(
    () =>
      buildPortfolioCaseRows(
        portfolioCases,
        portfolioRouting,
        controlRoomDashboard?.priority_cases?.items || []
      ),
    [portfolioCases, portfolioRouting, controlRoomDashboard]
  );

  const presetFilteredPortfolioCaseRows = useMemo(
    () =>
      portfolioCaseRows.filter((row) => matchesControlRoomPreset(row, controlRoomPreset)),
    [portfolioCaseRows, controlRoomPreset]
  );

  const filteredPortfolioCaseRows = useMemo(
    () => applySmartPortfolioFilters(presetFilteredPortfolioCaseRows, filters),
    [presetFilteredPortfolioCaseRows, filters]
  );

  const sortedPortfolioCaseRows = useMemo(
    () => sortPortfolioCaseRows(filteredPortfolioCaseRows, sorting),
    [filteredPortfolioCaseRows, sorting]
  );

  function toggleSelectAllVisible() {
    const visibleIds = sortedPortfolioCaseRows.map((item) => item.id);
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
    dashboard?.next_step?.title_ru ||
    dashboard?.next_step?.title ||
    "Проверьте доступные документы и текущую стадию взыскания.";

  const relatedCases = dashboard?.debtor_registry?.related_cases || [];
  const relatedSummary = dashboard?.debtor_registry?.summary || null;
  const debtorId = dashboard?.debtor_registry?.debtor?.id || null;

  const displayedOrganization = useMemo(
    () => buildDisplayedOrganization(debtorProfile, organizationPreview),
    [debtorProfile, organizationPreview]
  );

  const selectedCaseCard = useMemo(
    () => allCases.find((item: any) => Number(item.id) === Number(selectedCase)) || null,
    [allCases, selectedCase]
  );

  const hasSelectedCase = useMemo(
    () => allCases.some((item: any) => Number(item.id) === Number(selectedCase)),
    [allCases, selectedCase]
  );

  const selectedAmountText = useMemo(() => {
    const selectedRows = sortedPortfolioCaseRows.filter((item: any) =>
      selectedCaseIds.includes(item.id)
    );

    const amount = selectedRows.reduce(
      (acc: number, item: any) => acc + parseAmount(item?.principal_amount),
      0
    );

    return amount.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [sortedPortfolioCaseRows, selectedCaseIds]);

  const portfolioStats = useMemo(() => {
    const items = filteredPortfolioCaseRows || [];
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
  }, [filteredPortfolioCaseRows]);

  const controlPresetLabel = useMemo(
    () => controlRoomPresetLabel(controlRoomPreset),
    [controlRoomPreset]
  );

  return (
    <div className="layout">
      <CaseSidebar cases={allCases} selectedCase={selectedCase} onSelect={openCase}>
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

          <div
            style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
          >
            <WorkspaceSwitcher />

            {viewMode === "case" && (
              <button className="secondary-btn" onClick={returnToPortfolio}>
                Вернуться к портфелю
              </button>
            )}

            {viewMode === "portfolio" && hasSelectedCase && selectedCase && (
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
            <section className="panel control-room-shell">
              <div className="section-header">
                <div>
                  <div className="section-eyebrow">Recovery operations</div>
                  <div className="panel-title" style={{ marginBottom: 6 }}>
                    Recovery Control Room
                  </div>
                  <div className="muted">
                    Центральная панель управления портфелем взыскания
                  </div>
                </div>
              </div>

              <div className="control-room-tabs">
                {portfolioSectionButtons.map((item) => (
                  <button
                    key={item.key}
                    className={`control-room-tab ${
                      portfolioSection === item.key ? "is-active" : ""
                    }`}
                    onClick={() => setPortfolioSection(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            {controlPresetLabel && (
              <section className="panel" style={{ marginTop: 16 }}>
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
                    <div className="section-eyebrow">Control room drilldown</div>
                    <div className="panel-title" style={{ marginBottom: 6 }}>
                      Активный операционный срез
                    </div>
                    <div className="muted">{controlPresetLabel}</div>
                  </div>

                  <button className="secondary-btn" onClick={clearControlRoomPreset}>
                    Сбросить drilldown
                  </button>
                </div>
              </section>
            )}

            {portfolioSection === "overview" && (
              <ControlRoomLayout
                hero={
                  <ControlRoomHero
                    summary={controlRoomDashboard?.summary}
                    intelligenceKpi={controlRoomDashboard?.intelligence_kpi}
                    selectedCount={selectedCaseIds.length}
                    selectedAmount={selectedAmountText}
                  />
                }
                top={
                  <ControlRoomKPIs
                    dashboard={controlRoomDashboard}
                    portfolioStats={portfolioStats}
                    selectedCaseIds={selectedCaseIds}
                  />
                }
                main={
                  <>
                    <FocusQueuesPanel
                      dashboard={controlRoomDashboard}
                      selectedCase={selectedCase}
                      onOpenCase={openCase}
                      onOpenQueue={handleOpenFocusQueue}
                    />

                    <div className="dashboard-grid dashboard-grid-secondary">
                      <IntelligencePortfolioPanel
                        dashboard={controlRoomDashboard}
                        cases={sortedPortfolioCaseRows}
                        selectedCase={selectedCase}
                        onOpenCase={openCase}
                      />
                      <ExecutionSummaryPanel execution={controlRoomDashboard?.execution} />
                    </div>

                    <PriorityCasesPanel
                      dashboard={controlRoomDashboard}
                      selectedCase={selectedCase}
                      onOpenCase={openCase}
                      onOpenPreset={handleOpenPriorityPreset}
                    />

                    <RoutingOverviewPanel
                      routing={controlRoomDashboard?.routing}
                      onOpenBucket={handleOpenRoutingBucket}
                    />

                    <PortfolioOperationsPanel
                      cases={sortedPortfolioCaseRows}
                      selectedCaseIds={selectedCaseIds}
                      selectedCase={selectedCase}
                      onOpenCase={openCase}
                    />

                    <PortfolioLaneBoard
                      dashboard={controlRoomDashboard}
                      onOpenCase={openCase}
                    />

                    <WaitingBucketsPanel
                      onOpenCase={openCase}
                      onOpenPreset={handleOpenWaitingPreset}
                    />
                  </>
                }
                side={<PortfolioActionDock selectedCaseIds={selectedCaseIds} />}
                bottom={
                  <>
                    <PortfolioToolbar
                      filters={filters}
                      sorting={sorting}
                      onChange={handleChangeFilters}
                      onChangeSorting={handleChangeSorting}
                      onSaveView={handleSaveView}
                      activePresetLabel={controlPresetLabel}
                      onClearPreset={clearControlRoomPreset}
                    />

                    <SavedViewsPanel
                      items={savedViews}
                      activeViewId={activeViewId}
                      onApply={handleApplyView}
                    />
                  </>
                }
              />
            )}

            {portfolioSection === "lanes" && (
              <>
                <FocusQueuesPanel
                  dashboard={controlRoomDashboard}
                  selectedCase={selectedCase}
                  onOpenCase={openCase}
                  onOpenQueue={handleOpenFocusQueue}
                />

                <PriorityCasesPanel
                  dashboard={controlRoomDashboard}
                  selectedCase={selectedCase}
                  onOpenCase={openCase}
                  onOpenPreset={handleOpenPriorityPreset}
                />

                <RoutingOverviewPanel
                  routing={controlRoomDashboard?.routing}
                  onOpenBucket={handleOpenRoutingBucket}
                />

                <div className="portfolio-workspace-grid">
                  <div className="portfolio-workspace-main">
                    <PortfolioLaneBoard
                      dashboard={controlRoomDashboard}
                      onOpenCase={openCase}
                    />
                    <WaitingBucketsPanel
                      onOpenCase={openCase}
                      onOpenPreset={handleOpenWaitingPreset}
                    />
                  </div>

                  <div className="portfolio-workspace-side">
                    <PortfolioActionDock selectedCaseIds={selectedCaseIds} />
                  </div>
                </div>
              </>
            )}

            {portfolioSection === "registry" && (
              <div className="portfolio-workspace-grid">
                <div className="portfolio-workspace-main">
                  <PortfolioCasesTable
                    cases={sortedPortfolioCaseRows}
                    selectedCase={selectedCase}
                    selectedCaseIds={selectedCaseIds}
                    onOpenCase={openCase}
                    onToggleCaseSelection={toggleCaseSelection}
                    onToggleSelectAllVisible={toggleSelectAllVisible}
                    activePresetLabel={controlPresetLabel}
                    onClearPreset={clearControlRoomPreset}
                  />
                </div>

                <div className="portfolio-workspace-side">
                  <PortfolioActionDock selectedCaseIds={selectedCaseIds} />
                </div>
              </div>
            )}

            {portfolioSection === "batch" && (
              <div className="portfolio-workspace-grid">
                <div className="portfolio-workspace-main">
                  <BatchExecutionPanel
                    selectedCaseIds={selectedCaseIds}
                    onCompleted={async () => {
                      await loadCases();

                      if (selectedCase != null) {
                        await loadCaseData(selectedCase);
                      }

                      setExecutionRefreshKey((prev) => prev + 1);
                    }}
                  />
                </div>

                <div className="portfolio-workspace-side">
                  <PortfolioActionDock selectedCaseIds={selectedCaseIds} />
                </div>
              </div>
            )}

            {portfolioSection === "execution" && (
              <div className="portfolio-workspace-grid">
                <div className="portfolio-workspace-main">
                  <ExecutionSummaryPanel execution={controlRoomDashboard?.execution} />
                  <ExecutionConsolePanel refreshKey={executionRefreshKey} />
                </div>

                <div className="portfolio-workspace-side">
                  <PortfolioActionDock selectedCaseIds={selectedCaseIds} />
                </div>
              </div>
            )}

            {portfolioSection === "filters" && (
              <>
                <ControlRoomKPIs
                  dashboard={controlRoomDashboard}
                  portfolioStats={portfolioStats}
                  selectedCaseIds={selectedCaseIds}
                />

                <PortfolioOperationsPanel
                  cases={sortedPortfolioCaseRows}
                  selectedCaseIds={selectedCaseIds}
                  selectedCase={selectedCase}
                  onOpenCase={openCase}
                />

                <PortfolioToolbar
                  filters={filters}
                  sorting={sorting}
                  onChange={handleChangeFilters}
                  onChangeSorting={handleChangeSorting}
                  onSaveView={handleSaveView}
                  activePresetLabel={controlPresetLabel}
                  onClearPreset={clearControlRoomPreset}
                />

                <SavedViewsPanel
                  items={savedViews}
                  activeViewId={activeViewId}
                  onApply={handleApplyView}
                />

                <div className="portfolio-workspace-grid">
                  <div className="portfolio-workspace-main">
                    <PortfolioCasesTable
                      cases={sortedPortfolioCaseRows}
                      selectedCase={selectedCase}
                      selectedCaseIds={selectedCaseIds}
                      onOpenCase={openCase}
                      onToggleCaseSelection={toggleCaseSelection}
                      onToggleSelectAllVisible={toggleSelectAllVisible}
                      activePresetLabel={controlPresetLabel}
                      onClearPreset={clearControlRoomPreset}
                    />
                  </div>

                  <div className="portfolio-workspace-side">
                    <PortfolioActionDock selectedCaseIds={selectedCaseIds} />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {viewMode === "case" && selectedCase != null && (
          <CaseWorkspace
            selectedCase={selectedCase}
            selectedCaseCard={selectedCaseCard}
            dashboard={dashboard}
            timeline={timeline}
            loadingCase={loadingCase}
            error={error}
            participants={participants}
            debtorInn={debtorInn}
            debtorOgrn={debtorOgrn}
            debtorBusy={debtorBusy}
            debtorMessage={debtorMessage}
            setDebtorInn={setDebtorInn}
            setDebtorOgrn={setDebtorOgrn}
            handleLookupOrganization={handleLookupOrganization}
            handleIdentifyDebtor={handleIdentifyDebtor}
            handleRefreshDebtor={handleRefreshDebtor}
            displayedOrganization={displayedOrganization}
            softPolicy={softPolicy}
            setSoftPolicy={setSoftPolicy}
            softPolicyBusy={softPolicyBusy}
            softPolicyMessage={softPolicyMessage}
            handleSaveSoftPolicy={handleSaveSoftPolicy}
            recommendation={recommendation}
            relatedCases={relatedCases}
            relatedSummary={relatedSummary}
            debtorId={debtorId}
            actionBusy={actionBusy}
            runAction={runAction}
            onOpenCase={openCase}
            onDownloadDocument={downloadDocument}
          />
        )}
      </main>
    </div>
  );
}
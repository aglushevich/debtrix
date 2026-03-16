const DEFAULT_API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : `${window.location.origin}/proxy/8000`;

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) || DEFAULT_API_BASE;

async function parseResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;

    try {
      if (contentType.includes("application/json")) {
        const data = await res.json();
        detail = data?.detail || JSON.stringify(data);
      } else {
        detail = await res.text();
      }
    } catch {
      // ignore parse error
    }

    throw new Error(detail);
  }

  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  return (await res.blob()) as T;
}

async function safeParseOrFallback<T>(res: Response, fallback: T): Promise<T> {
  try {
    return await parseResponse<T>(res);
  } catch {
    return fallback;
  }
}

function parseFilenameFromDisposition(
  contentDisposition: string | null,
  fallback: string
): string {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return fallback;
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallback;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export type DebtorGraphNode = {
  id: string;
  type?: string;
  title?: string;
  subtitle?: string | null;
  is_current?: boolean;
};

export type DebtorGraphEdge = {
  source: string;
  target: string;
  label?: string;
  kind?: string;
};

export type DebtorGraphAutoLink = {
  type: string;
  label: string;
  value: string;
  from?: {
    node_id?: string;
    title?: string;
  };
  to?: {
    node_id?: string;
    title?: string;
  };
};

export type DebtorGraphRelatedCase = {
  case_id: number;
  contract_type?: string;
  principal_amount?: string;
  due_date?: string | null;
  status?: string;
  is_current?: boolean;
  is_archived?: boolean;
};

export type DebtorGraphResponse = {
  case_id: number;
  debtor?: {
    id?: number | null;
    name?: string | null;
    debtor_type?: string | null;
    inn?: string | null;
    ogrn?: string | null;
    address?: string | null;
    director_name?: string | null;
  };
  summary?: {
    cases_count?: number;
    participants_count?: number;
    auto_links_count?: number;
    risk_score?: number;
    risk_level?: string;
    signals?: string[];
  };
  related_cases?: DebtorGraphRelatedCase[];
  participants?: any[];
  auto_links?: DebtorGraphAutoLink[];
  graph?: {
    nodes?: DebtorGraphNode[];
    edges?: DebtorGraphEdge[];
  };
};

export type OrganizationStarterKitResponse = {
  case_id?: number;
  organization?: {
    id?: number | null;
    name?: string | null;
    name_full?: string | null;
    name_short?: string | null;
    inn?: string | null;
    ogrn?: string | null;
    kpp?: string | null;
    address?: string | null;
    director_name?: string | null;
    status?: string | null;
    registration_date?: string | null;
    okved_main?: string | null;
    source?: string | null;
    is_active?: boolean;
  };
  creditor?: {
    name?: string | null;
    inn?: string | null;
    ogrn?: string | null;
    kpp?: string | null;
    address?: string | null;
    signer_name?: string | null;
    signer_basis?: string | null;
  };
  summary?: {
    completion_percent?: number;
    filled_fields?: number;
    missing_fields_count?: number;
    linked_cases_count?: number;
    linked_debtors_count?: number;
    active_cases_count?: number;
    archived_cases_count?: number;
    total_principal_amount?: string;
    readiness_score?: number;
  };
  readiness?: {
    level?: "ready" | "partial" | "missing" | string;
    ready?: boolean;
    missing_fields?: string[];
    checks?: Array<{
      code?: string;
      label?: string;
      value?: string | null;
      ok?: boolean;
      hint?: string | null;
    }>;
  };
  linked_cases?: Array<{
    case_id: number;
    debtor_name?: string;
    contract_type?: string;
    principal_amount?: string;
    due_date?: string | null;
    status?: string;
    is_archived?: boolean;
    is_current?: boolean;
  }>;
  graph_hints?: string[];
  signals?: string[];
  recommendations?: string[];
};

export type CaseIntegrationItem = {
  id?: number;
  provider?: string;
  status?: string;
  mode?: string | null;
  external_id?: string | null;
  last_error?: string | null;
  last_payload_hash?: string | null;
  last_synced_at?: string | null;
  data?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CaseIntegrationsResponse = {
  case_id?: number;
  integrations?: CaseIntegrationItem[];
  providers?: Record<string, CaseIntegrationItem>;
};

export type ExternalActionItem = {
  id?: number;
  action_code?: string;
  provider?: string;
  status?: string;
  auth_type?: string | null;
  requires_user_auth?: boolean;
  title?: string;
  description?: string | null;
  external_reference?: string | null;
  redirect_url?: string | null;
  error_message?: string | null;
  payload?: Record<string, any> | null;
  result?: Record<string, any> | null;
  expires_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ExternalActionsResponse = {
  case_id?: number;
  actions?: ExternalActionItem[];
};

export type EsiaSessionItem = {
  id?: number;
  tenant_id?: number;
  case_id?: number;
  external_action_id?: number;
  provider?: string;
  status?: string;
  state_token?: string | null;
  redirect_url?: string | null;
  access_scope?: string | null;
  user_identifier?: string | null;
  is_active?: boolean;
  error_message?: string | null;
  payload?: Record<string, any> | null;
  result?: Record<string, any> | null;
  expires_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StartEsiaSessionResponse = {
  ok?: boolean;
  reused?: boolean;
  session?: EsiaSessionItem;
};

export type AuthorizeEsiaSessionResponse = {
  ok?: boolean;
  session?: EsiaSessionItem;
};

export type OutboundDispatchItem = {
  id?: number;
  tenant_id?: number;
  case_id?: number;
  external_action_id?: number;
  provider?: string;
  channel?: string | null;
  status?: string;
  request_payload?: Record<string, any> | null;
  response_payload?: Record<string, any> | null;
  external_reference?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DispatchExternalActionResponse = {
  ok?: boolean;
  action?: ExternalActionItem;
  dispatch?: OutboundDispatchItem;
};

export type SavedViewItem = {
  id: number;
  tenant_id?: number;
  code?: string | null;
  title?: string;
  name?: string;
  description?: string | null;
  entity_type?: string;
  filters?: Record<string, any>;
  sorting?: Record<string, any> | null;
  columns?: string[] | Record<string, any> | null;
  is_default?: boolean;
  is_shared?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SavedViewsResponse = {
  items: SavedViewItem[];
};

export type CreateSavedViewPayload = {
  title: string;
  description?: string;
  entity_type?: string;
  filters?: Record<string, any>;
  sorting?: Record<string, any> | null;
  columns?: string[] | null;
  is_default?: boolean;
  is_shared?: boolean;
};

export type BatchPreviewBucket = {
  key: string;
  title: string;
  count: number;
  case_ids?: number[];
};

export type BatchPreviewResponse = {
  ok?: boolean;
  action_code?: string;
  total_selected?: number;
  preview?: {
    eligible_now?: BatchPreviewBucket;
    waiting?: BatchPreviewBucket;
    blocked?: BatchPreviewBucket;
    not_applicable?: BatchPreviewBucket;
    already_processed?: BatchPreviewBucket;
  };
  items?: Array<{
    case_id: number;
    bucket: string;
    reason?: string | null;
    eligible_at?: string | null;
  }>;
};

export type BatchRunResponse = {
  ok?: boolean;
  action_code?: string;
  total_selected?: number;
  queued?: number;
  results?: Array<{
    case_id: number;
    status: string;
    reason?: string | null;
    eligible_at?: string | null;
    payload?: Record<string, any> | null;
  }>;
  summary?: Record<string, number>;
};

export type PortfolioFilters = {
  q?: string;
  status?: string;
  contract_type?: string;
  debtor_type?: string;
  include_archived?: boolean;
};

export type SoftPolicy = {
  payment_due_notice_delay_days: number;
  debt_notice_delay_days: number;
  pretension_delay_days: number;
};

export type SoftPolicyResponse = {
  case_id: number;
  soft_policy: SoftPolicy;
};

export type PolicyTiming = {
  base_due_date?: string | null;
  payment_due_notice_eligible_at?: string | null;
  debt_notice_eligible_at?: string | null;
  pretension_eligible_at?: string | null;
};

export type PortfolioRoutingCaseItem = {
  case_id: number;
  debtor_name?: string;
  contract_type?: string;
  debtor_type?: string;
  status?: string;
  routing_status?: string;
  is_archived?: boolean;
};

export type PortfolioRoutingResponse = {
  summary?: {
    total?: number;
    ready?: number;
    waiting?: number;
    blocked?: number;
    idle?: number;
  };
  buckets?: {
    ready?: PortfolioRoutingCaseItem[];
    waiting?: PortfolioRoutingCaseItem[];
    blocked?: PortfolioRoutingCaseItem[];
    idle?: PortfolioRoutingCaseItem[];
  };
};

export type WaitingBucketItem = {
  case_id: number;
  debtor_name?: string;
  step_code?: string;
  bucket_code?: string;
  reason?: string | null;
  eligible_at?: string | null;
  principal_amount?: string | null;
};

export type WaitingBucketsResponse = {
  items: WaitingBucketItem[];
};

export type ControlRoomSummary = {
  total_cases?: number;
  active_cases?: number;
  archived_cases?: number;
  draft_cases?: number;
  overdue_cases?: number;
  pretrial_cases?: number;
  court_cases?: number;
  fssp_cases?: number;
  closed_cases?: number;
  blocked_cases?: number;
  overdue_now_cases?: number;
  total_principal_amount?: string;
  average_principal_amount?: string;
};

export type ControlRoomPriorityCase = {
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

export type ControlRoomExecutionConsoleResponse = {
  batch_jobs?: Array<{
    id: number;
    title?: string;
    job_type?: string | null;
    status?: string;
    created_at?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    summary?: Record<string, number>;
    success?: number;
    blocked?: number;
    waiting?: number;
    errors?: number;
    not_applicable?: number;
    already_processed?: number;
  }>;
  batch_metrics?: Record<string, number>;
  automation_metrics?: Record<string, number>;
};

export type ControlRoomDashboardResponse = {
  summary?: ControlRoomSummary;
  routing?: PortfolioRoutingResponse;
  waiting_preview?: WaitingBucketsResponse;
  execution?: ControlRoomExecutionConsoleResponse;
  priority_cases?: {
    items?: ControlRoomPriorityCase[];
    total?: number;
  };
  intelligence_kpi?: {
    high_risk_cases?: number;
    critical_cases?: number;
    blocked_high_risk_cases?: number;
  };
};

function normalizeSavedView(item: any): SavedViewItem {
  return {
    id: item?.id,
    tenant_id: item?.tenant_id,
    title: item?.title || item?.name || `View #${item?.id}`,
    name: item?.name,
    description: item?.description || null,
    filters: item?.filters || {},
    sorting: item?.sorting || null,
    columns: item?.columns || null,
    is_default: Boolean(item?.is_default),
    is_shared: Boolean(item?.is_shared),
    created_at: item?.created_at || null,
    updated_at: item?.updated_at || null,
  };
}

function emptyDashboard(caseId: number) {
  return {
    case: {
      id: caseId,
      debtor_name: null,
      debtor_type: null,
      contract_type: null,
      principal_amount: null,
      due_date: null,
      status: "draft",
    },
    contract_data: {
      debtor: {
        inn: "",
        ogrn: "",
      },
    },
    stage: {
      status: "new",
      flags: {},
    },
    next_step: null,
    actions: [],
    documents: [],
    soft_policy: {
      payment_due_notice_delay_days: 0,
      debt_notice_delay_days: 3,
      pretension_delay_days: 10,
    },
    policy_timing: {
      base_due_date: null,
      payment_due_notice_eligible_at: null,
      debt_notice_eligible_at: null,
      pretension_eligible_at: null,
    },
    debtor_registry: {
      debtor: null,
      related_cases: [],
      summary: {
        cases_count: 0,
        total_principal_amount: "0.00",
      },
    },
  };
}

export async function getCases(includeArchived = false) {
  const params = new URLSearchParams();
  if (includeArchived) params.set("include_archived", "true");

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/cases${suffix}`);
  return parseResponse(res);
}

export async function createCase(payload: any) {
  const res = await fetch(`${API_BASE}/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
}

export async function archiveCase(caseId: number) {
  throw new Error(`Архивация дела #${caseId} пока не подключена на backend.`);
}

export async function unarchiveCase(caseId: number) {
  throw new Error(`Разархивация дела #${caseId} пока не подключена на backend.`);
}

export async function getDashboard(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/dashboard`);
  return safeParseOrFallback(res, emptyDashboard(caseId));
}

export async function getTimeline(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/timeline`);
  return safeParseOrFallback(res, { case_id: caseId, items: [] });
}

export async function applyAction(caseId: number, action: string) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/actions/${action}`, {
    method: "POST",
  });

  return parseResponse(res);
}

export async function downloadDocument(
  caseId: number,
  code: string,
  format: "pdf" | "docx"
) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/documents/${code}.${format}`);

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    let detail = `HTTP ${res.status}`;

    try {
      if (contentType.includes("application/json")) {
        const data = await res.json();
        detail = data?.detail || JSON.stringify(data);
      } else {
        detail = await res.text();
      }
    } catch {
      // ignore
    }

    throw new Error(detail);
  }

  const blob = await res.blob();
  const fallbackName = `case_${caseId}_${code}.${format}`;
  const filename = parseFilenameFromDisposition(
    res.headers.get("content-disposition"),
    fallbackName
  );

  triggerBrowserDownload(blob, filename);

  return { ok: true, filename };
}

export async function initRecovery(caseId: number) {
  throw new Error(`Recovery init для дела #${caseId} пока не подключён.`);
}

export async function getRecovery(caseId: number) {
  return {
    case_id: caseId,
    accrued: {},
    payments: [],
    status: "not_available",
  };
}

export async function patchAccrued(caseId: number, accrued: Record<string, any>) {
  return {
    ok: false,
    case_id: caseId,
    accrued,
    message: "Recovery accrued пока не подключён на backend.",
  };
}

export async function addPayment(caseId: number, amount: string) {
  return {
    ok: false,
    case_id: caseId,
    amount,
    message: "Payments пока не подключены на backend.",
  };
}

export async function getDebtorIntelligence(caseId: number) {
  return {
    case_id: caseId,
    summary: null,
    signals: [],
    recommendations: [],
  };
}

export async function getAvailableDocuments(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/available-documents`);
  return safeParseOrFallback(res, { case_id: caseId, documents: [] });
}

export async function getAvailableActions(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/available-actions`);
  return safeParseOrFallback(res, { case_id: caseId, actions: [] });
}

export async function getDocumentReadiness(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/document-readiness`);
  return safeParseOrFallback(res, { case_id: caseId, documents: [] });
}

export async function identifyDebtor(
  caseId: number,
  payload: { inn?: string; ogrn?: string }
) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/debtor/identify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
}

export async function refreshDebtor(
  caseId: number,
  payload?: { inn?: string; ogrn?: string }
) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/debtor/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  return parseResponse(res);
}

export async function getDebtorProfile(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/debtor/profile`);
  return parseResponse(res);
}

export async function getDebtorDashboard(debtorId: number) {
  return {
    debtor_id: debtorId,
    debtor: null,
    cases: [],
    summary: {
      cases_count: 0,
      total_principal_amount: "0.00",
    },
  };
}

export async function getDebtorCases(debtorId: number) {
  return {
    debtor_id: debtorId,
    items: [],
  };
}

export async function lookupOrganization(payload: { inn?: string; ogrn?: string }) {
  const params = new URLSearchParams();

  if (payload.inn) params.set("inn", payload.inn);
  if (payload.ogrn) params.set("ogrn", payload.ogrn);

  const res = await fetch(`${API_BASE}/organizations/lookup?${params.toString()}`);
  return parseResponse(res);
}

export async function getCaseParticipants(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/participants`);
  return safeParseOrFallback(res, { case_id: caseId, participants: [] });
}

export async function getDebtMap(caseId: number) {
  return {
    case_id: caseId,
    nodes: [],
    edges: [],
    summary: null,
  };
}

export async function getDebtorGraph(
  caseId: number
): Promise<DebtorGraphResponse> {
  return {
    case_id: caseId,
    debtor: null,
    summary: {
      cases_count: 0,
      participants_count: 0,
      auto_links_count: 0,
      risk_score: 0,
      risk_level: "unknown",
      signals: [],
    },
    related_cases: [],
    participants: [],
    auto_links: [],
    graph: {
      nodes: [],
      edges: [],
    },
  };
}

export async function getOrganizationStarterKit(
  caseId: number
): Promise<OrganizationStarterKitResponse> {
  return {
    case_id: caseId,
    organization: null,
    creditor: null,
    summary: {
      completion_percent: 0,
      filled_fields: 0,
      missing_fields_count: 0,
      linked_cases_count: 0,
      linked_debtors_count: 0,
      active_cases_count: 0,
      archived_cases_count: 0,
      total_principal_amount: "0.00",
      readiness_score: 0,
    },
    readiness: {
      level: "missing",
      ready: false,
      missing_fields: [],
      checks: [],
    },
    linked_cases: [],
    graph_hints: [],
    signals: [],
    recommendations: [],
  };
}

export async function getCaseIntegrations(
  caseId: number
): Promise<CaseIntegrationsResponse> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/integrations`);
  return safeParseOrFallback(res, {
    case_id: caseId,
    integrations: [],
    providers: {},
  });
}

export async function syncFnsIntegration(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/integrations/fns/sync`, {
    method: "POST",
  });
  return parseResponse(res);
}

export async function checkFsspIntegration(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/integrations/fssp/check`, {
    method: "POST",
  });
  return parseResponse(res);
}

export async function getExternalActions(
  caseId: number
): Promise<ExternalActionsResponse> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/external-actions`);
  return safeParseOrFallback(res, { case_id: caseId, actions: [] });
}

export async function prepareExternalAction(
  caseId: number,
  actionCode: string
) {
  const res = await fetch(
    `${API_BASE}/cases/${caseId}/external-actions/${actionCode}/prepare`,
    {
      method: "POST",
    }
  );
  return parseResponse(res);
}

export async function startEsiaSession(
  actionId: number
): Promise<StartEsiaSessionResponse> {
  const res = await fetch(
    `${API_BASE}/external-actions/${actionId}/esia-session/start`,
    { method: "POST" }
  );
  return parseResponse<StartEsiaSessionResponse>(res);
}

export async function authorizeEsiaSession(
  sessionId: number
): Promise<AuthorizeEsiaSessionResponse> {
  const res = await fetch(
    `${API_BASE}/esia-sessions/${sessionId}/authorize`,
    { method: "POST" }
  );
  return parseResponse<AuthorizeEsiaSessionResponse>(res);
}

export async function dispatchExternalAction(
  actionId: number
): Promise<DispatchExternalActionResponse> {
  const res = await fetch(
    `${API_BASE}/external-actions/${actionId}/dispatch`,
    { method: "POST" }
  );
  return parseResponse<DispatchExternalActionResponse>(res);
}

export async function getSavedViews(): Promise<SavedViewsResponse> {
  const res = await fetch(`${API_BASE}/portfolio/views`);
  const data = await safeParseOrFallback<any>(res, []);
  const items = Array.isArray(data)
    ? data.map(normalizeSavedView)
    : Array.isArray(data?.items)
      ? data.items.map(normalizeSavedView)
      : [];
  return { items };
}

export async function createSavedView(
  payload: CreateSavedViewPayload
): Promise<{ ok?: boolean; view?: SavedViewItem }> {
  const backendPayload = {
    name: payload.title,
    description: payload.description,
    filters: payload.filters || {},
    sorting: payload.sorting || {},
    columns: payload.columns || [],
    is_default: Boolean(payload.is_default),
    is_shared: Boolean(payload.is_shared),
    meta: {
      entity_type: payload.entity_type || "case",
    },
  };

  const res = await fetch(`${API_BASE}/portfolio/views`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(backendPayload),
  });

  const data = await parseResponse<any>(res);
  const rawView = data?.view || data;
  return {
    ok: true,
    view: normalizeSavedView(rawView),
  };
}

export async function applySavedView(
  viewId: number
): Promise<{ ok?: boolean; view?: SavedViewItem; filters?: Record<string, any> }> {
  const res = await fetch(`${API_BASE}/portfolio/views/${viewId}`);
  const data = await parseResponse<any>(res);
  const rawView = data?.view || data;

  return {
    ok: true,
    view: normalizeSavedView(rawView),
    filters: rawView?.filters || {},
  };
}

export async function getSoftPolicy(caseId: number): Promise<SoftPolicyResponse> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/soft-policy`);
  return safeParseOrFallback(res, {
    case_id: caseId,
    soft_policy: {
      payment_due_notice_delay_days: 0,
      debt_notice_delay_days: 3,
      pretension_delay_days: 10,
    },
  });
}

export async function updateSoftPolicy(
  caseId: number,
  payload: SoftPolicy
): Promise<{ ok?: boolean; case_id?: number; soft_policy?: SoftPolicy }> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/soft-policy`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse(res);
}

export async function getPortfolioRouting(): Promise<PortfolioRoutingResponse> {
  const res = await fetch(`${API_BASE}/portfolio/routing`);
  return safeParseOrFallback(res, {
    summary: { total: 0, ready: 0, waiting: 0, blocked: 0, idle: 0 },
    buckets: { ready: [], waiting: [], blocked: [], idle: [] },
  });
}

export async function getControlRoomSummary(): Promise<ControlRoomSummary> {
  const res = await fetch(`${API_BASE}/control-room/summary`);
  return safeParseOrFallback(res, {});
}

export async function getControlRoomDashboard(): Promise<ControlRoomDashboardResponse> {
  const res = await fetch(`${API_BASE}/control-room/dashboard`);
  return safeParseOrFallback(res, {
    summary: {},
    routing: {
      summary: { total: 0, ready: 0, waiting: 0, blocked: 0, idle: 0 },
      buckets: {
        ready: [],
        waiting: [],
        blocked: [],
        idle: [],
      },
    },
    waiting_preview: { items: [] },
    execution: {
      batch_jobs: [],
      batch_metrics: {},
      automation_metrics: {},
    },
    priority_cases: { items: [], total: 0 },
    intelligence_kpi: {},
  });
}

export async function getExecutionConsoleRuns(): Promise<ControlRoomExecutionConsoleResponse> {
  const res = await fetch(`${API_BASE}/control-room/execution-console`);
  return safeParseOrFallback(res, {
    batch_jobs: [],
    batch_metrics: {},
    automation_metrics: {},
  });
}

export async function getWaitingBuckets(): Promise<WaitingBucketsResponse> {
  const res = await fetch(`${API_BASE}/portfolio/waiting-buckets`);
  return safeParseOrFallback(res, { items: [] });
}

export async function previewBatchExecution(payload: {
  action_code: string;
  case_ids: number[];
}): Promise<BatchPreviewResponse> {
  const res = await fetch(`${API_BASE}/batch-actions/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseResponse<BatchPreviewResponse>(res);
}

export async function runBatchExecution(payload: {
  action_code: string;
  case_ids: number[];
  force?: boolean;
}): Promise<BatchRunResponse> {
  const res = await fetch(`${API_BASE}/batch-actions/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action_code: payload.action_code,
      case_ids: payload.case_ids,
      force: Boolean(payload.force),
    }),
  });

  return parseResponse<BatchRunResponse>(res);
}

export async function getPortfolioCases(filters: PortfolioFilters = {}) {
  const allCases = await getCases(Boolean(filters.include_archived));

  const normalizedQ = (filters.q || "").trim().toLowerCase();
  const normalizedStatus = (filters.status || "").trim().toLowerCase();
  const normalizedContractType = (filters.contract_type || "").trim().toLowerCase();
  const normalizedDebtorType = (filters.debtor_type || "").trim().toLowerCase();

  return (allCases || []).filter((item: any) => {
    const debtorName = String(item?.debtor_name || "").toLowerCase();
    const status = String(item?.status || "").toLowerCase();
    const contractType = String(item?.contract_type || "").toLowerCase();
    const debtorType = String(item?.debtor_type || "").toLowerCase();

    if (
      normalizedQ &&
      !debtorName.includes(normalizedQ) &&
      !String(item?.id || "").includes(normalizedQ)
    ) {
      return false;
    }

    if (normalizedStatus && status !== normalizedStatus) {
      return false;
    }

    if (normalizedContractType && contractType !== normalizedContractType) {
      return false;
    }

    if (normalizedDebtorType && debtorType !== normalizedDebtorType) {
      return false;
    }

    return true;
  });
}

export async function getExecutionHistory(caseId: number) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/execution-history`);

  return safeParseOrFallback(res, {
    case_id: caseId,
    items: [],
  });
}
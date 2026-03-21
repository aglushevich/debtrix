export type PortfolioSmartLevel = "ready" | "partial" | "waiting" | "blocked";

export type PortfolioPriorityBand = "low" | "medium" | "high" | "critical";

export type PortfolioCaseSmartSignals = {
  readinessScore: number;
  smartLevel: PortfolioSmartLevel;
  warningsCount: number;
  duplicatesCount: number;

  warnings: string[];
  duplicateCaseIds: number[];

  primaryWarning?: string | null;
  hint?: string | null;

  routingStatus?: string | null;
  routingHint?: string | null;
  waitingEligibleAt?: string | null;
  routeLane?: string | null;

  riskScore?: number | null;
  riskLevel?: string | null;
  priorityScore?: number | null;
  priorityBand?: string | null;
  priorityBandLabel?: string | null;
  priorityReasons?: string[];
  operatorFocus?: string | null;
  recommendedAction?: string | null;
};

export type PortfolioCaseRow = {
  id: number;
  debtor_name?: string | null;
  inn?: string | null;
  contract_type?: string | null;
  debtor_type?: string | null;
  principal_amount?: string | number | null;
  due_date?: string | null;
  status?: string | null;
  is_archived?: boolean;

  risk_score?: number | null;
  risk_level?: string | null;
  priority_score?: number | null;
  priority_band?: string | null;
  priority_band_label?: string | null;
  priority_reasons?: string[];
  operator_focus?: string | null;
  recommended_action?: string | null;

  smart: PortfolioCaseSmartSignals;
};

type RoutingRowLike = {
  case_id: number;
  routing_status?: string | null;
  routing_hint?: string | null;
  waiting_eligible_at?: string | null;
  waiting_reason?: string | null;
  route_lane?: string | null;
};

type PriorityRowLike = {
  case_id: number;
  risk_score?: number;
  risk_level?: string | null;
  priority_score?: number;
  priority_band?: string | null;
  priority_band_label?: string | null;
  priority_reasons?: string[];
  operator_focus?: string | null;
  recommended_action?: string | null;
  routing_status?: string | null;
  routing_hint?: string | null;
  waiting_eligible_at?: string | null;
  route_lane?: string | null;
};

function normalizeString(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function computeWarnings(item: any): string[] {
  const warnings: string[] = [];

  if (!item?.debtor_name) warnings.push("missing_debtor_name");
  if (!item?.inn && !item?.contract_data?.debtor?.inn) warnings.push("missing_inn");
  if (!item?.due_date) warnings.push("missing_due_date");
  if (!item?.principal_amount) warnings.push("missing_principal_amount");
  if (!item?.contract_type) warnings.push("missing_contract_type");
  if (item?.status === "draft") warnings.push("draft_status");
  if (item?.is_archived) warnings.push("archived_case");

  return warnings;
}

function computeDuplicates(item: any, all: any[]) {
  const inn = normalizeString(item?.inn || item?.contract_data?.debtor?.inn);
  const name = normalizeString(item?.debtor_name);

  return all
    .filter((other) => {
      if (other.id === item.id) return false;

      const otherInn = normalizeString(other?.inn || other?.contract_data?.debtor?.inn);
      const otherName = normalizeString(other?.debtor_name);

      if (inn && otherInn && otherInn === inn) return true;
      if (!inn && name && otherName === name) return true;

      return false;
    })
    .map((d) => d.id);
}

function computeReadiness(item: any, routingRow?: RoutingRowLike | null) {
  let score = 0;

  if (item?.debtor_name) score += 15;
  if (item?.inn || item?.contract_data?.debtor?.inn) score += 20;
  if (item?.principal_amount) score += 20;
  if (item?.due_date) score += 15;
  if (item?.contract_type) score += 10;
  if (item?.status !== "draft") score += 10;
  if (!item?.is_archived) score += 10;

  const routingStatus = String(routingRow?.routing_status || "").toLowerCase();
  if (routingStatus === "ready") score += 10;
  if (routingStatus === "blocked") score -= 15;
  if (routingStatus === "waiting") score -= 5;

  return Math.max(0, Math.min(score, 100));
}

function computeSmartLevel(
  item: any,
  score: number,
  warnings: string[],
  routingRow?: RoutingRowLike | null
): PortfolioSmartLevel {
  const routingStatus = String(routingRow?.routing_status || "").toLowerCase();

  if (routingStatus === "waiting" || item?.status === "waiting") return "waiting";
  if (routingStatus === "blocked") return "blocked";
  if (routingStatus === "ready") return "ready";

  if (
    !item?.debtor_name ||
    !item?.principal_amount ||
    !item?.due_date ||
    !item?.contract_type
  ) {
    return "blocked";
  }

  if (score >= 75 && warnings.length <= 1) return "ready";
  if (score >= 45) return "partial";

  return "blocked";
}

function warningLabel(code: string) {
  switch (code) {
    case "missing_debtor_name":
      return "Нет должника";
    case "missing_inn":
      return "Нет ИНН";
    case "missing_due_date":
      return "Нет срока оплаты";
    case "missing_principal_amount":
      return "Нет суммы";
    case "missing_contract_type":
      return "Нет типа договора";
    case "draft_status":
      return "Черновик";
    case "archived_case":
      return "В архиве";
    default:
      return code;
  }
}

function formatEligibleAtShort(value?: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isEligibleReached(value?: string | null): boolean {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() <= Date.now();
}

function laneLabel(code?: string | null): string | null {
  const map: Record<string, string> = {
    soft_lane: "Soft lane",
    court_lane: "Court lane",
    enforcement_lane: "Enforcement lane",
    closed_lane: "Closed lane",
  };

  if (!code) return null;
  return map[code] || code;
}

function buildHint(
  level: PortfolioSmartLevel,
  warnings: string[],
  duplicates: number[],
  routingRow?: RoutingRowLike | null,
  priorityRow?: PriorityRowLike | null
) {
  const routingStatus = String(
    priorityRow?.routing_status || routingRow?.routing_status || ""
  ).toLowerCase();
  const routingHint = priorityRow?.routing_hint || routingRow?.routing_hint || null;
  const waitingEligibleAt =
    priorityRow?.waiting_eligible_at || routingRow?.waiting_eligible_at || null;
  const routeLane = laneLabel(priorityRow?.route_lane || routingRow?.route_lane);

  if (priorityRow?.operator_focus) {
    return priorityRow.operator_focus;
  }

  if (priorityRow?.recommended_action) {
    return priorityRow.recommended_action;
  }

  if (routingStatus === "waiting") {
    if (waitingEligibleAt) {
      if (isEligibleReached(waitingEligibleAt)) {
        return "Срок ожидания уже наступил";
      }

      const formatted = formatEligibleAtShort(waitingEligibleAt);
      return formatted ? `Ожидает до ${formatted}` : "Ожидает окна действия";
    }

    return routingHint || "Ожидает окна действия";
  }

  if (routingStatus === "blocked") {
    return routingHint || (warnings.length > 0 ? warningLabel(warnings[0]) : "Требует данных");
  }

  if (routingStatus === "ready") {
    if (routeLane) return `${routeLane} · готово к шагу`;
    return routingHint || "Готово к действию";
  }

  if (duplicates.length > 0) {
    return `${duplicates.length} возможных дубля`;
  }

  if (warnings.length > 0) {
    return warningLabel(warnings[0]);
  }

  if (routeLane) {
    return routeLane;
  }

  if (level === "ready") return "Готово к действию";
  if (level === "waiting") return "Ожидает окна действия";
  if (level === "blocked") return "Требует данных";

  return "Частично готово";
}

function buildRoutingMap(routing?: any): Map<number, RoutingRowLike> {
  const map = new Map<number, RoutingRowLike>();
  const buckets = routing?.buckets || {};

  const allRows = [
    ...(Array.isArray(buckets.ready) ? buckets.ready : []),
    ...(Array.isArray(buckets.waiting) ? buckets.waiting : []),
    ...(Array.isArray(buckets.blocked) ? buckets.blocked : []),
    ...(Array.isArray(buckets.idle) ? buckets.idle : []),
  ];

  for (const row of allRows) {
    const caseId = Number(row?.case_id);
    if (!caseId) continue;
    map.set(caseId, row);
  }

  return map;
}

function buildPriorityMap(priorityItems?: any[]): Map<number, PriorityRowLike> {
  const map = new Map<number, PriorityRowLike>();

  for (const row of Array.isArray(priorityItems) ? priorityItems : []) {
    const caseId = Number(row?.case_id);
    if (!caseId) continue;
    map.set(caseId, row);
  }

  return map;
}

function fallbackPriorityBand(score: number): PortfolioPriorityBand {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function fallbackPriorityBandLabel(band: string): string {
  const map: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };

  return map[band] || band;
}

function buildFallbackPriorityReasons(
  item: any,
  warnings: string[],
  duplicates: number[],
  routingRow?: RoutingRowLike | null
): string[] {
  const result: string[] = [];

  const amount = Number(String(item?.principal_amount ?? 0).replace(",", "."));
  if (amount >= 500000) result.push("Крупная сумма долга");
  else if (amount >= 100000) result.push("Значимая сумма долга");

  if (item?.due_date) result.push("Есть срок оплаты");
  if (String(routingRow?.routing_status || "").toLowerCase() === "ready") {
    result.push("Кейс доступен к выполнению сейчас");
  }
  if (String(item?.status || "").toLowerCase() === "draft") {
    result.push("Карточка ещё черновая");
  }
  if (duplicates.length > 0) {
    result.push("Есть портфельный контекст по должнику");
  }
  if (warnings.length > 0) {
    result.push(`Требует проверки: ${warningLabel(warnings[0])}`);
  }

  return result.slice(0, 6);
}

export function buildPortfolioCaseRow(
  item: any,
  all: any[],
  routingMap?: Map<number, RoutingRowLike>,
  priorityMap?: Map<number, PriorityRowLike>
): PortfolioCaseRow {
  const warnings = computeWarnings(item);
  const duplicates = computeDuplicates(item, all);
  const routingRow = routingMap?.get(Number(item.id)) || null;
  const priorityRow = priorityMap?.get(Number(item.id)) || null;

  const readinessScore = computeReadiness(item, routingRow);
  const smartLevel = computeSmartLevel(item, readinessScore, warnings, routingRow);
  const hint = buildHint(smartLevel, warnings, duplicates, routingRow, priorityRow);

  const riskScore = Number(priorityRow?.risk_score ?? readinessScore) || 0;
  const riskLevel = priorityRow?.risk_level || fallbackPriorityBand(riskScore);

  const priorityScore = Number(priorityRow?.priority_score ?? riskScore) || 0;
  const priorityBand = priorityRow?.priority_band || fallbackPriorityBand(priorityScore);
  const priorityBandLabel =
    priorityRow?.priority_band_label || fallbackPriorityBandLabel(priorityBand);

  const priorityReasons =
    Array.isArray(priorityRow?.priority_reasons) && priorityRow.priority_reasons.length
      ? priorityRow.priority_reasons
      : buildFallbackPriorityReasons(item, warnings, duplicates, routingRow);

  const operatorFocus = priorityRow?.operator_focus || null;
  const recommendedAction = priorityRow?.recommended_action || null;
  const mergedRoutingStatus =
    priorityRow?.routing_status || routingRow?.routing_status || null;
  const mergedRoutingHint =
    priorityRow?.routing_hint || routingRow?.routing_hint || null;
  const mergedWaitingEligibleAt =
    priorityRow?.waiting_eligible_at || routingRow?.waiting_eligible_at || null;
  const mergedRouteLane =
    priorityRow?.route_lane || routingRow?.route_lane || null;

  return {
    id: item.id,
    debtor_name: item.debtor_name,
    inn: item?.inn || item?.contract_data?.debtor?.inn || null,
    contract_type: item.contract_type,
    debtor_type: item.debtor_type,
    principal_amount: item.principal_amount,
    due_date: item.due_date,
    status: item.status,
    is_archived: item.is_archived,

    risk_score: riskScore,
    risk_level: riskLevel,
    priority_score: priorityScore,
    priority_band: priorityBand,
    priority_band_label: priorityBandLabel,
    priority_reasons: priorityReasons,
    operator_focus: operatorFocus,
    recommended_action: recommendedAction,

    smart: {
      readinessScore,
      smartLevel,
      warningsCount: warnings.length,
      duplicatesCount: duplicates.length,
      warnings,
      duplicateCaseIds: duplicates,
      primaryWarning: warnings[0] || null,
      hint,
      routingStatus: mergedRoutingStatus,
      routingHint: mergedRoutingHint,
      waitingEligibleAt: mergedWaitingEligibleAt,
      routeLane: mergedRouteLane,
      riskScore,
      riskLevel,
      priorityScore,
      priorityBand,
      priorityBandLabel,
      priorityReasons,
      operatorFocus,
      recommendedAction,
    },
  };
}

export function buildPortfolioCaseRows(
  items: any[],
  routing?: any,
  priorityItems?: any[]
): PortfolioCaseRow[] {
  const routingMap = buildRoutingMap(routing);
  const priorityMap = buildPriorityMap(priorityItems);

  return (items || []).map((item) =>
    buildPortfolioCaseRow(item, items, routingMap, priorityMap)
  );
}
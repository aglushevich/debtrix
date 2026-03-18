export type PortfolioSmartLevel = "ready" | "partial" | "waiting" | "blocked";

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

  smart: PortfolioCaseSmartSignals;
};

type RoutingRowLike = {
  case_id: number;
  routing_status?: string | null;
  routing_hint?: string | null;
  waiting_eligible_at?: string | null;
  waiting_reason?: string | null;
};

function normalizeString(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function computeWarnings(item: any): string[] {
  const warnings: string[] = [];

  if (!item?.debtor_name) warnings.push("missing_debtor_name");
  if (!item?.inn) warnings.push("missing_inn");
  if (!item?.due_date) warnings.push("missing_due_date");
  if (!item?.principal_amount) warnings.push("missing_principal_amount");
  if (!item?.contract_type) warnings.push("missing_contract_type");
  if (item?.status === "draft") warnings.push("draft_status");
  if (item?.is_archived) warnings.push("archived_case");

  return warnings;
}

function computeDuplicates(item: any, all: any[]) {
  const inn = normalizeString(item?.inn);
  const name = normalizeString(item?.debtor_name);

  return all
    .filter((other) => {
      if (other.id === item.id) return false;

      if (inn && normalizeString(other?.inn) === inn) return true;

      if (!inn && name && normalizeString(other?.debtor_name) === name) return true;

      return false;
    })
    .map((d) => d.id);
}

function computeReadiness(item: any) {
  let score = 0;

  if (item?.debtor_name) score += 15;
  if (item?.inn) score += 20;
  if (item?.principal_amount) score += 20;
  if (item?.due_date) score += 15;
  if (item?.contract_type) score += 10;
  if (item?.status !== "draft") score += 10;
  if (!item?.is_archived) score += 10;

  return Math.min(score, 100);
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

function buildHint(
  level: PortfolioSmartLevel,
  warnings: string[],
  duplicates: number[],
  routingRow?: RoutingRowLike | null
) {
  const routingStatus = String(routingRow?.routing_status || "").toLowerCase();
  const routingHint = routingRow?.routing_hint || null;
  const waitingEligibleAt = routingRow?.waiting_eligible_at || null;

  if (routingStatus === "waiting") {
    if (waitingEligibleAt) {
      if (isEligibleReached(waitingEligibleAt)) {
        return "Срок ожидания наступил";
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
    return routingHint || "Готово к действию";
  }

  if (level === "waiting") return "Ожидает окна действия";

  if (level === "blocked") {
    if (warnings.length > 0) return warningLabel(warnings[0]);
    return "Требует данных";
  }

  if (duplicates.length > 0) {
    return `${duplicates.length} возможных дубля`;
  }

  if (warnings.length > 0) {
    return warningLabel(warnings[0]);
  }

  if (level === "ready") return "Готово к действию";

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

export function buildPortfolioCaseRow(
  item: any,
  all: any[],
  routingMap?: Map<number, RoutingRowLike>
): PortfolioCaseRow {
  const warnings = computeWarnings(item);
  const duplicates = computeDuplicates(item, all);
  const readinessScore = computeReadiness(item);
  const routingRow = routingMap?.get(Number(item.id)) || null;
  const smartLevel = computeSmartLevel(item, readinessScore, warnings, routingRow);

  const hint = buildHint(smartLevel, warnings, duplicates, routingRow);

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

    smart: {
      readinessScore,
      smartLevel,
      warningsCount: warnings.length,
      duplicatesCount: duplicates.length,
      warnings,
      duplicateCaseIds: duplicates,
      primaryWarning: warnings[0] || null,
      hint,
      routingStatus: routingRow?.routing_status || null,
      routingHint: routingRow?.routing_hint || null,
      waitingEligibleAt: routingRow?.waiting_eligible_at || null,
    },
  };
}

export function buildPortfolioCaseRows(items: any[], routing?: any): PortfolioCaseRow[] {
  const routingMap = buildRoutingMap(routing);
  return (items || []).map((item) => buildPortfolioCaseRow(item, items, routingMap));
}
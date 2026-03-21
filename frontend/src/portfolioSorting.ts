import { PortfolioCaseRow, PortfolioSmartLevel } from "./portfolioSmart";

export type PortfolioSortKey =
  | "priority"
  | "readiness"
  | "smart_level"
  | "warnings"
  | "duplicates"
  | "amount"
  | "due_date"
  | "status"
  | "id";

export type PortfolioSortDirection = "asc" | "desc";

export type PortfolioSorting = {
  key: PortfolioSortKey;
  direction: PortfolioSortDirection;
};

export const DEFAULT_PORTFOLIO_SORTING: PortfolioSorting = {
  key: "priority",
  direction: "desc",
};

function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateToTimestamp(value?: string | null): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function smartLevelWeight(level: PortfolioSmartLevel): number {
  const map: Record<PortfolioSmartLevel, number> = {
    ready: 4,
    partial: 3,
    waiting: 2,
    blocked: 1,
  };

  return map[level] || 0;
}

function statusWeight(status?: string | null): number {
  const map: Record<string, number> = {
    draft: 1,
    waiting: 2,
    active: 3,
    overdue: 4,
    pretrial: 5,
    court: 6,
    fssp: 7,
    enforcement: 8,
    closed: 9,
  };

  return map[String(status || "").toLowerCase()] || 0;
}

function compareNumbers(a: number, b: number, direction: PortfolioSortDirection): number {
  return direction === "asc" ? a - b : b - a;
}

export function sortPortfolioCaseRows(
  rows: PortfolioCaseRow[],
  sorting: PortfolioSorting
): PortfolioCaseRow[] {
  const source = Array.isArray(rows) ? [...rows] : [];
  const { key, direction } = sorting;

  return source.sort((a, b) => {
    let result = 0;

    switch (key) {
      case "priority":
        result = compareNumbers(
          Number(a.priority_score ?? a.risk_score ?? 0),
          Number(b.priority_score ?? b.risk_score ?? 0),
          direction
        );
        break;

      case "readiness":
        result = compareNumbers(a.smart.readinessScore, b.smart.readinessScore, direction);
        break;

      case "smart_level":
        result = compareNumbers(
          smartLevelWeight(a.smart.smartLevel),
          smartLevelWeight(b.smart.smartLevel),
          direction
        );
        break;

      case "warnings":
        result = compareNumbers(a.smart.warningsCount, b.smart.warningsCount, direction);
        break;

      case "duplicates":
        result = compareNumbers(a.smart.duplicatesCount, b.smart.duplicatesCount, direction);
        break;

      case "amount":
        result = compareNumbers(
          parseAmount(a.principal_amount),
          parseAmount(b.principal_amount),
          direction
        );
        break;

      case "due_date":
        result = compareNumbers(
          parseDateToTimestamp(a.due_date),
          parseDateToTimestamp(b.due_date),
          direction
        );
        break;

      case "status":
        result = compareNumbers(statusWeight(a.status), statusWeight(b.status), direction);
        break;

      case "id":
      default:
        result = compareNumbers(a.id, b.id, direction);
        break;
    }

    if (result !== 0) return result;

    if (key !== "priority") {
      const priorityTieBreak = compareNumbers(
        Number(a.priority_score ?? a.risk_score ?? 0),
        Number(b.priority_score ?? b.risk_score ?? 0),
        "desc"
      );
      if (priorityTieBreak !== 0) return priorityTieBreak;
    }

    const amountTieBreak = compareNumbers(
      parseAmount(a.principal_amount),
      parseAmount(b.principal_amount),
      "desc"
    );
    if (amountTieBreak !== 0) return amountTieBreak;

    const dueDateTieBreak = compareNumbers(
      parseDateToTimestamp(a.due_date),
      parseDateToTimestamp(b.due_date),
      "asc"
    );
    if (dueDateTieBreak !== 0) return dueDateTieBreak;

    return compareNumbers(a.id, b.id, "asc");
  });
}
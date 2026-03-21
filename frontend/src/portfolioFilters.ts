import { PortfolioFilters } from "./api";
import { PortfolioCaseRow } from "./portfolioSmart";

export function applySmartPortfolioFilters(
  rows: PortfolioCaseRow[],
  filters: PortfolioFilters
): PortfolioCaseRow[] {
  const source = Array.isArray(rows) ? rows : [];

  return source.filter((row) => {
    const smartLevel = String(filters.smart_level || "").trim().toLowerCase();
    const priorityBand = String(filters.priority_band || "").trim().toLowerCase();
    const warningsOnly = Boolean(filters.warnings_only);
    const duplicatesOnly = Boolean(filters.duplicates_only);

    if (smartLevel && row.smart.smartLevel !== smartLevel) {
      return false;
    }

    if (priorityBand && String(row.priority_band || "").toLowerCase() !== priorityBand) {
      return false;
    }

    if (warningsOnly && row.smart.warningsCount <= 0) {
      return false;
    }

    if (duplicatesOnly && row.smart.duplicatesCount <= 0) {
      return false;
    }

    return true;
  });
}
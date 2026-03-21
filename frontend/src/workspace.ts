export const WORKSPACE_STORAGE_KEY = "debtrix_active_workspace";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getActiveWorkspace(): number | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) return null;

  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;

  return id;
}

export function setActiveWorkspace(id: number) {
  if (!isBrowser()) return;
  if (!Number.isFinite(id) || id <= 0) return;

  localStorage.setItem(WORKSPACE_STORAGE_KEY, String(id));
}

export function clearActiveWorkspace() {
  if (!isBrowser()) return;
  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
}
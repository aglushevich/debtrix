export const WORKSPACE_STORAGE_KEY = "debtrix_active_workspace";

export function getActiveWorkspace(): number | null {
  const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) return null;

  const id = Number(raw);
  if (!Number.isFinite(id)) return null;

  return id;
}

export function setActiveWorkspace(id: number) {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, String(id));
}

export function clearActiveWorkspace() {
  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
}
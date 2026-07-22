// UI-only preferences stored in localStorage. Never stores tokens or PII.
const KEY_SIDEBAR = 'dv_sidebar_collapsed';

export function getSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(KEY_SIDEBAR) === 'true';
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY_SIDEBAR, value ? 'true' : 'false');
  } catch {
    // localStorage unavailable (private mode, permissions policy)  -  silently ignore
  }
}

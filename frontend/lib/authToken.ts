const STORAGE_KEY = 'domovault.accessToken';

// Guard every sessionStorage call: during Next.js static pre-rendering at
// build time there is no browser, so sessionStorage is not defined.
// Returning null / no-op keeps the pre-render safe and lets client-side
// hydration take over with the real value.

export function setAccessToken(token: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

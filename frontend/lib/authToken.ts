const STORAGE_KEY = 'domovault.accessToken';

// The access token lives in sessionStorage, not a cookie - it's sent
// explicitly via the Authorization header so the browser never attaches it
// automatically, keeping it outside CSRF's reach. The refresh token is the
// one in the httpOnly cookie; this short-lived token is the tradeoff that
// makes that split possible.
export function setAccessToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearAccessToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

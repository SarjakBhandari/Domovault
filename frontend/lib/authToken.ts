const STORAGE_KEY = 'domovault.accessToken';

export function setAccessToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearAccessToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

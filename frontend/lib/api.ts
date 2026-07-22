import { getCsrfToken } from './csrf';
import { getAccessToken } from './authToken';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!SAFE_METHODS.has(method)) {
    const csrf = await getCsrfToken();
    headers.set('x-csrf-token', csrf);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(path, { ...options, headers, credentials: 'include' });
}

export async function apiJson<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = new Error(data?.error ?? `Request failed with status ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

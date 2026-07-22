export async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf-token', { method: 'GET' });
  if (!res.ok) throw new Error('Could not obtain a CSRF token');
  const data = await res.json();
  return data.csrfToken as string;
}

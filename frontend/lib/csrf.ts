// Fetches a CSRF token and lets the backend set its matching cookie via the
// proxy (Set-Cookie passes through untouched). The token returned here is
// sent back as the X-CSRF-Token header on the following mutating request -
// double-submit cookie pattern, required on every state-changing request
// including login/register, not only on "later" forms.
export async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf-token', { method: 'GET' });

  if (!res.ok) {
    throw new Error('Could not obtain a CSRF token');
  }

  const data = await res.json();
  return data.csrfToken as string;
}

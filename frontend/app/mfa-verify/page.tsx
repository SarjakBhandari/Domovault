'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCsrfToken } from '@/lib/csrf';
import { setAccessToken } from '@/lib/authToken';

type Status = 'idle' | 'submitting' | 'error' | 'notoken';

export default function MfaVerifyPage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('domovault.mfaToken');
    if (!token) {
      setStatus('notoken');
    } else {
      setMfaToken(token);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mfaToken) return;
    setStatus('submitting');
    setError(null);

    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ mfaToken, code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Invalid code. Please try again.');
        setStatus('error');
        return;
      }

      const data = await res.json();
      sessionStorage.removeItem('domovault.mfaToken');
      setAccessToken(data.accessToken);
      window.location.href = '/dashboard';
    } catch {
      setError('We could not reach Domovault. Check your connection and try again.');
      setStatus('error');
    }
  }

  if (status === 'notoken') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-amber-600" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" x2="12" y1="9" y2="13" />
              <line x1="12" x2="12.01" y1="17" y2="17" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-slate-900">Session expired</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your login session has expired. Please start the login process again.
          </p>
          <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-brand-700" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Two-factor verification</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Enter the 6-digit code from your authenticator app, or a backup code.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="code" className="label">Authentication code</label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              maxLength={64}
              required
              placeholder="000000"
              className="input text-center text-xl tracking-widest font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'submitting' || !code}
            className="btn-primary w-full justify-center"
          >
            {status === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Verifying...
              </span>
            ) : 'Verify'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Problems accessing your code?{' '}
          <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 transition-colors">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

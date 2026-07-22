'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordField from '@/components/PasswordField';
import PasswordStrength, { getPasswordScore } from '@/components/PasswordStrength';
import { getCsrfToken } from '@/lib/csrf';

type Status = 'idle' | 'submitting' | 'done' | 'error';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !email) {
      router.replace('/forgot-password');
    }
  }, [token, email, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (getPasswordScore(password) < 5) {
      setError('Password does not meet all requirements. Please check the checklist.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setError(null);

    try {
      const csrf = await getCsrfToken();
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? 'Reset failed. The link may be expired.');
        setStatus('error');
        return;
      }

      setStatus('done');
    } catch {
      setError('Could not reach the server. Check your connection.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-extrabold text-slate-900">Password updated</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Your password has been changed. All existing sessions have been signed out.
        </p>
        <Link href="/login" className="btn-primary mt-6 inline-flex justify-center">
          Log in with new password
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Set a new password</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Choose a strong password of at least 12 characters.
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
          <PasswordField
            label="New password"
            name="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            minLength={12}
          />
          <PasswordStrength password={password} />
        </div>

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="btn-primary w-full justify-center"
        >
          {status === 'submitting' ? 'Saving...' : 'Set new password'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

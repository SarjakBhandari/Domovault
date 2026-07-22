'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getCsrfToken } from '@/lib/csrf';

type Status = 'idle' | 'submitting' | 'done' | 'error';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!email.trim() || !email.includes('@') || !email.includes('.')) return 'Please enter a valid email address.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); setStatus('error'); return; }
    setStatus('submitting');
    setError(null);

    try {
      const csrf = await getCsrfToken();
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Something went wrong. Please try again.');
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
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-700" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h1 className="mt-5 text-xl font-extrabold text-slate-900">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            If that email is registered, we sent a password reset link. Check your inbox and spam folder.
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-flex justify-center">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Reset your password</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Enter your email and we will send you a reset link.
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
            <label htmlFor="email" className="label">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="btn-primary w-full justify-center"
          >
            {status === 'submitting' ? 'Sending...' : 'Send reset link'}
          </button>

          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 transition-colors">
              Back to login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

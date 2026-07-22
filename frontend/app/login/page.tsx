'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PasswordField from '@/components/PasswordField';
import { getCsrfToken } from '@/lib/csrf';
import { setAccessToken } from '@/lib/authToken';

type Status = 'idle' | 'submitting' | 'error';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function validate(): string | null {
    if (!email.trim() || !email.includes('@') || !email.includes('.')) return 'Please enter a valid email address.';
    if (!password) return 'Please enter your password.';
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); setStatus('error'); return; }
    setStatus('submitting');
    setError(null);

    try {
      const csrfToken = await getCsrfToken();

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 403 && data?.error === 'EMAIL_NOT_VERIFIED') {
          sessionStorage.setItem('domovault.pendingEmail', email.toLowerCase().trim());
          router.push('/verify-email');
          return;
        }
        setError(data?.error ?? 'Invalid email or password.');
        setStatus('error');
        return;
      }

      const data = await res.json();
      if (data.mfaRequired) {
        sessionStorage.setItem('domovault.mfaToken', data.mfaToken ?? '');
        router.push('/mfa-verify');
        return;
      }

      if (!data.accessToken) {
        setError('Login failed: no access token received. Please try again.');
        setStatus('error');
        return;
      }

      setAccessToken(data.accessToken);
      router.push('/dashboard');
    } catch {
      setError('We could not reach Domovault. Check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span className="text-xl font-bold text-white tracking-tight">Domo<span className="font-extrabold">vault</span></span>
        </Link>

        <div>
          <blockquote className="text-xl font-semibold leading-relaxed text-white">
            "Manage your entire tenancy securely, from application to lease end."
          </blockquote>
          <div className="mt-8 flex flex-col gap-3">
            {[
              'AES-256 encrypted data at rest',
              'Multi-factor authentication',
              'Secure document management',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-brand-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-brand-300">Domovault - Secure by design</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </span>
              <span className="text-lg font-bold text-slate-900">Domo<span className="font-extrabold text-brand-700">vault</span></span>
            </Link>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            New here?{' '}
            <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800 transition-colors">
              Create an account
            </Link>
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
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label" style={{ marginBottom: 0 }}>Password</label>
                <Link href="/forgot-password" className="text-xs font-medium text-brand-700 hover:text-brand-800 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <PasswordField
                label=""
                name="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                required
                hideLabel
              />
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="btn-primary w-full justify-center"
            >
              {status === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Logging in...
                </span>
              ) : 'Log in'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PasswordField from '@/components/PasswordField';
import { getCsrfToken } from '@/lib/csrf';
import { setAccessToken } from '@/lib/authToken';

type Status = 'idle' | 'submitting' | 'error';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied:         'You cancelled the sign-in.',
  oauth_state_mismatch: 'Security check failed. Please try again.',
  oauth_no_email:       'Your account has no verified email. Use a different sign-in method.',
  oauth_missing_params: 'Sign-in flow was incomplete. Please try again.',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Surface any error forwarded back from the OAuth callback
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(OAUTH_ERROR_MESSAGES[oauthError] ?? 'Sign-in failed. Please try again.');
      setStatus('error');
    }
  }, [searchParams]);

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

          {/* OAuth divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">or continue with</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* OAuth buttons  -  full-page navigation, NOT fetch, so the browser
              follows the redirect chain through the provider and back */}
          <div className="mt-4 flex flex-col gap-3">
            <a
              href="/api/auth/oauth/google"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              {/* Google colour icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </a>

          </div>
        </div>
      </div>
    </div>
  );
}

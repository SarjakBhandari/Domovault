'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PasswordField from '@/components/PasswordField';
import PasswordStrength, { getPasswordScore } from '@/components/PasswordStrength';
import { getCsrfToken } from '@/lib/csrf';

type Status = 'idle' | 'submitting' | 'error';
type FieldErrors = Record<string, string[]>;

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const router = useRouter();

  function validate(): string | null {
    if (fullName.trim().length < 2) return 'Full name must be at least 2 characters.';
    if (!email.includes('@') || !email.includes('.')) return 'Please enter a valid email address.';
    if (getPasswordScore(password) < 5) return 'Password does not meet all requirements. Please check the checklist below.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setStatus('error');
      return;
    }

    setStatus('submitting');

    try {
      const csrfToken = await getCsrfToken();

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ fullName: fullName.trim(), email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.details && typeof data.details === 'object') {
          setFieldErrors(data.details as FieldErrors);
          setError('Please fix the errors below.');
        } else {
          setError(data?.error ?? 'We could not create your account. Please try again.');
        }
        setStatus('error');
        return;
      }

      sessionStorage.setItem('domovault.pendingEmail', email.toLowerCase().trim());
      router.push('/verify-email');
    } catch {
      setError('We could not reach Domovault. Check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12"
        style={{ background: 'linear-gradient(135deg, #134e4a 0%, #115e59 40%, #0f766e 100%)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span className="text-xl font-bold text-white tracking-tight">Domo<span className="font-extrabold">vault</span></span>
        </Link>

        <div>
          <p className="text-2xl font-bold text-white leading-snug">
            Start managing your rental securely.
          </p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: '#99f6e4' }}>
            Create your free account in under a minute. No credit card required.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {[
              'Encrypted document storage',
              'Maintenance request tracking',
              'Secure message inbox',
              'Transparent billing history',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm" style={{ color: '#ccfbf1' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs" style={{ color: '#5eead4' }}>Domovault - Secure by design</p>
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

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Create your account</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 transition-colors">
              Log in
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
              <label htmlFor="fullName" className="label">Full name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
                className="input"
              />
              {fieldErrors.fullName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName.join(' ')}</p>
              )}
            </div>

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
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email.join(' ')}</p>
              )}
            </div>

            <div>
              <PasswordField
                label="Password"
                name="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                minLength={12}
              />
              <PasswordStrength password={password} />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password.join(' ')}</p>
              )}
            </div>

            <PasswordField
              label="Confirm password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              required
              minLength={12}
            />

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
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>

            <p className="text-center text-xs text-slate-500">
              By signing up you agree to our{' '}
              <Link href="/terms" className="underline hover:text-slate-700">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline hover:text-slate-700">Privacy Policy</Link>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

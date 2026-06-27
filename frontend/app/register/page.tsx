'use client';

import { useState } from 'react';
import Link from 'next/link';
import PasswordField from '@/components/PasswordField';
import { getCsrfToken } from '@/lib/csrf';

type Status = 'idle' | 'submitting' | 'error' | 'success';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setStatus('error');
      return;
    }

    setStatus('submitting');

    try {
      const csrfToken = await getCsrfToken();

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        // Only the fields a guest is allowed to set are sent; role/isVerified
        // are never part of this payload, by design, and the backend allow-list
        // discards them even if a client tried to add them.
        body: JSON.stringify({ fullName, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'We could not create your account. Please try again.');
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setError('We could not reach Domovault. Check your connection and try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Check your inbox</h1>
        <p className="mt-3 text-slate-600">
          We&apos;ve sent a verification link to {email}. Verify your email to finish
          setting up your account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Create your Domovault account</h1>
      <p className="mt-2 text-sm text-slate-500">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Log in
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:border-brand-600"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:border-brand-600"
          />
        </div>

        <PasswordField
          label="Password"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={12}
          helpText="At least 12 characters."
        />

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
          className="w-full rounded-md bg-brand-700 px-4 py-3 font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'Creating account...' : 'Create account'}
        </button>

        <p className="text-xs text-slate-500">
          By signing up you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </div>
  );
}

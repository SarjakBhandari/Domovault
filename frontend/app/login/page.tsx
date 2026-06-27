'use client';

import { useState } from 'react';
import Link from 'next/link';
import PasswordField from '@/components/PasswordField';

type Status = 'idle' | 'submitting' | 'error';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Invalid email or password.');
        setStatus('error');
        return;
      }

      window.location.href = '/';
    } catch {
      setError('We could not reach Domovault. Check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Log in to Domovault</h1>
      <p className="mt-2 text-sm text-slate-500">
        New here?{' '}
        <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800">
          Create an account
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
          autoComplete="current-password"
          required
        />

        <div className="text-right text-sm">
          <Link href="#" className="font-medium text-brand-700 hover:text-brand-800">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full rounded-md bg-brand-700 px-4 py-3 font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  );
}

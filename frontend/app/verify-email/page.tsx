'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCsrfToken } from '@/lib/csrf';

type Status = 'idle' | 'submitting' | 'done' | 'error' | 'resending';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem('domovault.pendingEmail');
    if (!stored) {
      router.replace('/register');
      return;
    }
    setEmail(stored);
    inputRefs.current[0]?.focus();
  }, [router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    setOtp(next);
    const focusIdx = Math.min(digits.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      setMessage('Please enter the full 6-digit code.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setMessage(null);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        sessionStorage.removeItem('domovault.pendingEmail');
        setStatus('done');
        setMessage(data?.message ?? 'Email verified.');
      } else {
        setMessage(data?.error ?? 'Incorrect or expired code. Try again.');
        setStatus('error');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setMessage('Could not reach the server. Check your connection.');
      setStatus('error');
    }
  }

  async function handleResend() {
    setStatus('resending');
    setMessage(null);
    try {
      const csrf = await getCsrfToken();
      await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ email }),
      });
      setResendCooldown(60);
      setStatus('idle');
      setMessage('A new code has been sent to your email.');
    } catch {
      setStatus('idle');
      setMessage('Could not resend the code. Try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">Email verified</h1>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
          <Link href="/login" className="btn-primary mt-6 inline-flex justify-center">
            Log in to your account
          </Link>
        </div>
      </div>
    );
  }

  const submitting = status === 'submitting' || status === 'resending';

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-brand-700" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Check your email</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-slate-700">{email}</span>.{' '}
          Enter it below to verify your account.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
          {message && (
            <div
              role="alert"
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                status === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {message}
            </div>
          )}

          <div>
            <label className="label mb-3">Verification code</label>
            <div className="flex gap-2.5" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={submitting}
                  aria-label={`Digit ${i + 1}`}
                  style={{
                    width: '44px',
                    height: '52px',
                    textAlign: 'center',
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    borderRadius: '10px',
                    border: '1.5px solid #dde2ea',
                    background: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 150ms ease, box-shadow 150ms ease',
                    boxShadow: 'inset 0 1px 2px 0 rgb(0 0 0 / 0.04)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#14b8a6';
                    e.target.style.boxShadow = 'inset 0 1px 2px 0 rgb(0 0 0 / 0.03), 0 0 0 3.5px rgb(20 184 166 / 0.14)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#dde2ea';
                    e.target.style.boxShadow = 'inset 0 1px 2px 0 rgb(0 0 0 / 0.04)';
                  }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || otp.join('').length < 6}
            className="btn-primary w-full justify-center"
          >
            {status === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Verifying...
              </span>
            ) : 'Verify email'}
          </button>

          <div className="text-center text-sm text-slate-500">
            Did not receive it?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={submitting || resendCooldown > 0}
              className="font-semibold text-brand-700 hover:text-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'resending'
                ? 'Sending...'
                : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend code'}
            </button>
          </div>

          <p className="text-center text-sm text-slate-500">
            Wrong account?{' '}
            <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800 transition-colors">
              Start over
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

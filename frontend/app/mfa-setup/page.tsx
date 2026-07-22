'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiFetch, apiJson } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type ScanData = { qrCodeDataUrl: string };
type Phase = 'loading' | 'start' | 'scan' | 'done' | 'unauth' | 'error';

export default function MfaSetupPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    startTransition(() => setPhase('loading'));
    if (!getAccessToken()) {
      setPhase('unauth');
      return;
    }
    setPhase('start');
  }, []);

  async function beginSetup() {
    try {
      const data = await apiJson<ScanData>('/api/mfa/setup', { method: 'POST' });
      setScanData(data);
      setPhase('scan');
    } catch {
      setPhase('error');
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setCodeError('');
    try {
      const result = await apiJson<{ backupCodes: string[] }>('/api/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setBackupCodes(result.backupCodes ?? []);
      setPhase('done');
    } catch (err: unknown) {
      setCodeError((err as Error).message ?? 'Invalid code. Try again.');
    }
  }

  if (phase === 'unauth') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">Authentication required</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">Log in</Link>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-64 rounded-lg bg-slate-100" />
          <div className="h-40 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Something went wrong.</p>
        <p className="mt-1.5 text-sm text-slate-500">Please try again later.</p>
        <Link href="/profile" className="btn-primary mt-5 inline-flex justify-center">Back to profile</Link>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto max-w-md px-4 py-10 sm:px-6 space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">2FA is now enabled</h1>
          <p className="text-sm text-slate-500">
            Two-factor authentication is active on your account. Every login will require your authenticator code.
          </p>
        </div>

        {backupCodes.length > 0 && (
          <div className="card p-5 border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Save your backup codes</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  These are shown only once. Each code can be used once to log in without your authenticator.
                </p>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-1.5">
              {backupCodes.map((c) => (
                <li key={c} className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-center font-mono text-xs text-slate-700">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link href="/profile" className="btn-primary w-full justify-center inline-flex">
          Back to profile
        </Link>
      </div>
    );
  }

  if (phase === 'start') {
    return (
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Set up two-factor authentication</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            MFA adds a second layer of protection. You will need an authenticator app like Google Authenticator or Authy.
          </p>
        </div>

        <dl className="card p-5 space-y-4">
          {[
            { step: '1', text: 'Install Google Authenticator, Authy, or any TOTP app on your phone.' },
            { step: '2', text: 'Click "Begin setup" and scan the QR code with your authenticator app.' },
            { step: '3', text: 'Enter the 6-digit code from the app to confirm and activate 2FA.' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {step}
              </span>
              <p className="text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </dl>

        <button onClick={beginSetup} className="btn-primary w-full justify-center">
          Begin setup
        </button>
        <div className="text-center">
          <Link href="/profile" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancel</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Scan the QR code</h1>
        <p className="mt-2 text-sm text-slate-500">
          Open your authenticator app and scan the code below. Then enter the 6-digit code to confirm.
        </p>
      </div>

      {scanData?.qrCodeDataUrl && (
        <div className="flex justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <img
              src={scanData.qrCodeDataUrl}
              alt="MFA QR code for authenticator app"
              className="h-48 w-48"
            />
          </div>
        </div>
      )}

      <form onSubmit={confirmSetup} className="space-y-5">
        {codeError && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            {codeError}
          </div>
        )}
        <div>
          <label htmlFor="code" className="label">Verification code</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoComplete="one-time-code"
            placeholder="000000"
            className="input text-center text-xl tracking-widest font-mono"
          />
        </div>
        <button type="submit" className="btn-primary w-full justify-center">
          Confirm and enable 2FA
        </button>
      </form>
    </div>
  );
}

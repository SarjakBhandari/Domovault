'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

export default function DataExportPage() {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!getAccessToken()) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">Authentication required</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">Log in</Link>
      </div>
    );
  }

  async function handleExport() {
    setStatus('exporting');
    setError('');

    try {
      const res = await apiFetch('/api/profile/export');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Export failed.');
        setStatus('error');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'domovault-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch {
      setError('Could not reach the server.');
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Export your data</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Download a copy of all the data Domovault holds about you  -  your profile, applications,
          leases, billing history, and maintenance requests. The file contains only your own data,
          formatted as JSON.
        </p>
      </div>

      <div className="card p-5 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">GDPR data portability</p>
          <p className="mt-0.5 text-xs text-slate-500">You have the right to receive your personal data in a portable, machine-readable format.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
          {error}
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={status === 'exporting'}
        className="btn-primary w-full justify-center"
      >
        {status === 'exporting' ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Preparing download...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Download my data
          </span>
        )}
      </button>

      <div>
        <Link href="/profile" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to profile
        </Link>
      </div>
    </div>
  );
}

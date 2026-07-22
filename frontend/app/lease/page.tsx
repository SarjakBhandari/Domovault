'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type Lease = {
  _id: string;
  propertyId: { _id: string; title: string; address: string; city: string } | null;
  startDate: string;
  endDate?: string;
  rentAmount: number;
  status: 'active' | 'ended';
};

export default function LeasePage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    apiJson<Lease[]>('/api/billing/leases')
      .then((data) => { setLeases(data); setStatus('ready'); })
      .catch((err) => setStatus(err.status === 401 ? 'unauth' : 'error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded-lg bg-slate-100" />
          <div className="h-48 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (status === 'unauth') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">Authentication required</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">Log in</Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Could not load lease information.</p>
        <p className="mt-1.5 text-sm text-slate-500">Please refresh the page.</p>
      </div>
    );
  }

  const activeLease = leases.find((l) => l.status === 'active');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Lease Details</h1>
        <p className="mt-1 text-sm text-slate-500">Your current tenancy agreement and terms.</p>
      </div>

      {!activeLease ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">No active lease</p>
          <p className="text-xs text-slate-500">Once your application is approved, your lease details will appear here.</p>
          <Link href="/browse" className="btn-primary text-xs px-4 py-2">
            Browse properties
          </Link>
        </div>
      ) : (
        <div className="card p-6 space-y-6">
          {/* Property */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Property</p>
              <p className="mt-0.5 font-semibold text-slate-800">{activeLease.propertyId?.title ?? 'Unknown'}</p>
              <p className="text-sm text-slate-500">{activeLease.propertyId?.address}, {activeLease.propertyId?.city}</p>
            </div>
          </div>

          {/* Stats grid */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-5">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly rent</dt>
              <dd className="mt-1 text-xl font-extrabold text-brand-700">NPR {activeLease.rentAmount.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</dt>
              <dd className="mt-1">
                <span className="badge badge-green capitalize">{activeLease.status}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Start date</dt>
              <dd className="mt-1 text-sm font-medium text-slate-700">
                {new Date(activeLease.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </dd>
            </div>
            {activeLease.endDate && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">End date</dt>
                <dd className="mt-1 text-sm font-medium text-slate-700">
                  {new Date(activeLease.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </dd>
              </div>
            )}
          </dl>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
            <Link href="/billing" className="btn-primary">
              View billing
            </Link>
            <Link href="/maintenance" className="btn-secondary">
              Maintenance requests
            </Link>
          </div>
        </div>
      )}

      <div>
        <Link href="/dashboard" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

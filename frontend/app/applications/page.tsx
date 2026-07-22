'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type Application = {
  _id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  notes?: string;
  propertyId: {
    _id: string;
    title: string;
    city: string;
    address: string;
    rentPerMonth: number;
  };
  applicantId?: {
    fullName: string;
    email: string;
  };
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-red',
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unauth'>('loading');

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) {
      setStatus('unauth');
      return;
    }
    apiJson<Application[]>('/api/applications')
      .then((data) => {
        setApplications(data);
        setStatus('ready');
      })
      .catch((err) => {
        setStatus(err.status === 401 ? 'unauth' : 'error');
      });
  }, []);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-56 rounded-lg bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
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
        <p className="text-base font-semibold text-red-700">Could not load applications.</p>
        <p className="mt-1.5 text-sm text-slate-500">Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Applications</h1>
        <p className="mt-1 text-sm text-slate-500">Track the status of all your rental applications.</p>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">No applications yet</p>
          <Link href="/browse" className="btn-primary text-xs px-4 py-2">
            Browse properties
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {applications.map((app) => (
            <li key={app._id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-800">
                    {app.propertyId?.title ?? 'Property'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {app.propertyId?.address}, {app.propertyId?.city}
                    {app.propertyId?.rentPerMonth ? `  -  NPR ${app.propertyId.rentPerMonth.toLocaleString()}/mo` : ''}
                  </p>
                  {app.applicantId && (
                    <p className="mt-1 text-xs text-slate-400">
                      {app.applicantId.fullName} ({app.applicantId.email})
                    </p>
                  )}
                  {app.notes && (
                    <p className="mt-1.5 text-xs italic text-slate-400">{app.notes}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Applied {new Date(app.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`badge shrink-0 capitalize ${STATUS_BADGE[app.status] ?? 'badge-slate'}`}>
                  {app.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
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

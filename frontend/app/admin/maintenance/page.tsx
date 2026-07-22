'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type MaintenanceRequest = {
  _id: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  tenantId?: { fullName: string; email: string };
  propertyId?: { title: string };
};

const STATUS_BADGE: Record<string, string> = {
  open: 'badge-amber',
  in_progress: 'badge-blue',
  resolved: 'badge-green',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

const NEXT_STATUS: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'resolved',
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  open: 'In progress',
  in_progress: 'Resolved',
};

export default function AdminMaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    apiJson<MaintenanceRequest[]>('/api/maintenance')
      .then((data) => { setRequests(data); setStatus('ready'); })
      .catch((err) => setStatus(err.status === 403 || err.status === 401 ? 'unauth' : 'error'));
  }, []);

  async function advanceStatus(req: MaintenanceRequest) {
    const next = NEXT_STATUS[req.status];
    if (!next) return;
    setUpdating(req._id);
    setUpdateError(null);
    try {
      const res = await apiFetch(`/api/maintenance/${req._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setUpdateError(data?.error ?? 'Failed to update status. Please try again.');
        return;
      }
      setRequests((prev) => prev.map((r) => r._id === req._id ? { ...r, status: next as MaintenanceRequest['status'] } : r));
    } catch {
      setUpdateError('Could not reach the server. Check your connection and try again.');
    } finally {
      setUpdating(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-56 rounded-lg bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (status === 'unauth') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">Admin access required</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">Log in</Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Could not load maintenance requests.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Maintenance Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            {requests.length === 0 ? 'No requests.' : `${requests.length} request${requests.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Admin
        </Link>
      </div>

      {updateError && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
          {updateError}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">All caught up</p>
          <p className="text-xs text-slate-500">No maintenance requests at this time.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((req) => (
            <li key={req._id} className="card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {req.propertyId && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{req.propertyId.title}</p>
                  )}
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{req.description}</p>
                  {req.tenantId && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      <span className="font-medium text-slate-500">{req.tenantId.fullName}</span> ({req.tenantId.email})
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 shrink-0 sm:items-end">
                  <span className={`badge ${STATUS_BADGE[req.status] ?? 'badge-slate'}`}>
                    {STATUS_LABEL[req.status] ?? req.status}
                  </span>
                  {NEXT_STATUS[req.status] && (
                    <button
                      onClick={() => advanceStatus(req)}
                      disabled={updating === req._id}
                      className="rounded-lg border border-brand-300 px-3 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-60"
                    >
                      Mark as {NEXT_STATUS_LABEL[req.status]}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

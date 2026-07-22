'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type Application = {
  _id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  notes?: string;
  propertyId: { _id: string; title: string; city: string; rentPerMonth: number };
  applicantId: { fullName: string; email: string };
};

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    apiJson<Application[]>('/api/applications')
      .then((data) => { setApplications(data.filter((a) => a.status === 'pending')); setStatus('ready'); })
      .catch((err) => setStatus(err.status === 403 || err.status === 401 ? 'unauth' : 'error'));
  }, []);

  async function decide(appId: string, decision: 'approved' | 'rejected') {
    try {
      const res = await apiFetch(`/api/applications/${appId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status: decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionMsg((prev) => ({ ...prev, [appId]: data?.error ?? 'Action failed. Please try again.' }));
        return;
      }
      setActionMsg((prev) => ({ ...prev, [appId]: decision === 'approved' ? 'Approved.' : 'Rejected.' }));
      setApplications((prev) => prev.filter((a) => a._id !== appId));
    } catch {
      setActionMsg((prev) => ({ ...prev, [appId]: 'Could not reach the server. Check your connection.' }));
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
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
        <p className="text-base font-semibold text-slate-800">Admin access required</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">Log in</Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Could not load applications.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Application Review</h1>
          <p className="mt-1 text-sm text-slate-500">
            {applications.length === 0 ? 'All applications reviewed.' : `${applications.length} pending`}
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Admin
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">All caught up</p>
          <p className="text-xs text-slate-500">No pending applications to review right now.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {applications.map((app) => (
            <li key={app._id} className="card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{app.propertyId?.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {app.propertyId?.city} - NPR {app.propertyId?.rentPerMonth?.toLocaleString()}/mo
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">{app.applicantId?.fullName}</span>
                    <span className="ml-1.5 text-slate-500">({app.applicantId?.email})</span>
                  </p>
                  {app.notes && (
                    <p className="mt-1.5 text-xs italic text-slate-400">{app.notes}</p>
                  )}
                  <p className="mt-1.5 text-xs text-slate-400">
                    Applied {new Date(app.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {actionMsg[app._id] && (
                    <p className="mt-1.5 text-xs font-medium text-emerald-700">{actionMsg[app._id]}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => decide(app._id, 'approved')}
                    className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(app._id, 'rejected')}
                    className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

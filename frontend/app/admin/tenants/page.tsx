'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type Lease = {
  _id: string;
  startDate: string;
  endDate?: string;
  rentAmount: number;
  status: 'active' | 'ended';
  tenantId: { _id: string; fullName: string; email: string } | null;
  propertyId: { _id: string; title: string; address: string } | null;
};

export default function AdminTenantsPage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [actionMsg, setActionMsg] = useState<Record<string, { text: string; ok: boolean }>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    apiJson<Lease[]>('/api/billing/leases')
      .then((data) => { setLeases(data.filter((l) => l.status === 'active')); setStatus('ready'); })
      .catch((err) => setStatus(err.status === 403 || err.status === 401 ? 'unauth' : 'error'));
  }, []);

  async function handleRemoveTenant(tenantId: string) {
    setActionMsg((prev) => ({ ...prev, [tenantId]: { text: '', ok: true } }));
    try {
      const res = await apiFetch(`/api/admin/users/${tenantId}/remove-tenant`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionMsg((prev) => ({ ...prev, [tenantId]: { text: data?.error ?? 'Action failed.', ok: false } }));
        return;
      }
      setLeases((prev) => prev.filter((l) => l.tenantId?._id !== tenantId));
      setActionMsg((prev) => ({ ...prev, [tenantId]: { text: 'Tenant removed.', ok: true } }));
    } catch {
      setActionMsg((prev) => ({ ...prev, [tenantId]: { text: 'Could not reach the server.', ok: false } }));
    } finally {
      setConfirming(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 rounded-lg bg-slate-100" />
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
        <p className="text-base font-semibold text-red-700">Could not load tenants.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Active Tenants</h1>
          <p className="mt-1 text-sm text-slate-500">
            {leases.length === 0 ? 'No active leases.' : `${leases.length} active lease${leases.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Admin
        </Link>
      </div>

      {leases.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">No active leases</p>
          <p className="text-xs text-slate-500">Tenants will appear here once their leases are active.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {leases.map((lease) => {
            const tid = lease.tenantId?._id ?? '';
            const initials = (lease.tenantId?.fullName ?? 'T')
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <li key={lease._id} className="card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-xs font-bold text-brand-700">
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{lease.tenantId?.fullName ?? 'Unknown tenant'}</p>
                      <p className="text-xs text-slate-500">{lease.tenantId?.email}</p>
                      <p className="mt-1.5 text-sm text-slate-600">
                        {lease.propertyId?.title ?? 'Unknown property'}
                        {lease.propertyId?.address ? `  -  ${lease.propertyId.address}` : ''}
                      </p>
                      <p className="mt-1 text-sm font-bold text-brand-700">NPR {lease.rentAmount.toLocaleString()}/mo</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Since {new Date(lease.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="badge badge-green shrink-0">Active</span>
                    {confirming !== tid ? (
                      <button
                        onClick={() => setConfirming(tid)}
                        className="btn-secondary py-1.5 px-3 text-xs"
                      >
                        Remove tenant
                      </button>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <p className="text-xs font-medium text-slate-700">End lease and remove tenant?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirming(null)} className="btn-secondary py-1 px-3 text-xs">Cancel</button>
                          <button
                            onClick={() => handleRemoveTenant(tid)}
                            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}
                    {actionMsg[tid]?.text && (
                      <p className={`text-xs ${actionMsg[tid].ok ? 'text-emerald-700' : 'text-red-600'}`}>
                        {actionMsg[tid].text}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

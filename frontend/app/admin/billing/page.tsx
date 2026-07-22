'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type BillingCycle = {
  _id: string;
  dueDate: string;
  amount: number;
  status: string;
  tenantId?: string;
  leaseId?: string;
};

type BillRequest = {
  _id: string;
  message: string;
  status: 'pending' | 'sent';
  createdAt: string;
  tenantId: { _id: string; fullName: string; email: string } | null;
  propertyId: { _id: string; title: string } | null;
};

export default function AdminBillingPage() {
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [requests, setRequests] = useState<BillRequest[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    Promise.all([
      apiJson<BillingCycle[]>('/api/billing'),
      apiJson<BillRequest[]>('/api/billing/requests'),
    ])
      .then(([cycles, reqs]) => {
        setCycles(cycles.filter((c) => c.status === 'proof_submitted'));
        setRequests(reqs.filter((r) => r.status === 'pending'));
        setStatus('ready');
      })
      .catch((err) => setStatus(err.status === 403 || err.status === 401 ? 'unauth' : 'error'));
  }, []);

  async function decide(cycleId: string, decision: 'confirmed' | 'rejected') {
    try {
      const res = await apiFetch(`/api/billing/${cycleId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionMsg((prev) => ({ ...prev, [cycleId]: data?.error ?? 'Action failed. Please try again.' }));
        return;
      }
      setActionMsg((prev) => ({ ...prev, [cycleId]: decision === 'confirmed' ? 'Payment confirmed.' : 'Payment rejected.' }));
      setCycles((prev) => prev.filter((c) => c._id !== cycleId));
    } catch {
      setActionMsg((prev) => ({ ...prev, [cycleId]: 'Could not reach the server. Check your connection.' }));
    }
  }

  async function sendBillRequest(requestId: string) {
    try {
      const res = await apiFetch(`/api/billing/requests/${requestId}/send`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionMsg((prev) => ({ ...prev, [requestId]: data?.error ?? 'Action failed.' }));
        return;
      }
      setActionMsg((prev) => ({ ...prev, [requestId]: 'Bill sent to tenant.' }));
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch {
      setActionMsg((prev) => ({ ...prev, [requestId]: 'Could not reach the server.' }));
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
        <p className="text-base font-semibold text-red-700">Could not load billing data.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">Review payment proofs and respond to bill requests.</p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Admin
        </Link>
      </div>

      {/* Bill requests */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">
          Bill Requests
          {requests.length > 0 && (
            <span className="ml-2 badge badge-amber">{requests.length} pending</span>
          )}
        </h2>
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-6 text-center">
            <p className="text-sm text-slate-500">No pending bill requests.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((req) => (
              <li key={req._id} className="card p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-slate-800">{req.tenantId?.fullName ?? 'Unknown tenant'}</p>
                    <p className="text-xs text-slate-500">{req.tenantId?.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{req.propertyId?.title}</p>
                    {req.message && (
                      <p className="mt-1.5 text-sm text-slate-700 italic">"{req.message}"</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {actionMsg[req._id] && (
                      <p className="mt-1 text-xs font-medium text-emerald-700">{actionMsg[req._id]}</p>
                    )}
                  </div>
                  <button
                    onClick={() => sendBillRequest(req._id)}
                    className="btn-primary py-1.5 px-4 text-xs shrink-0"
                  >
                    Send Bill
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Payment proof review */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">
          Payment Proofs
          {cycles.length > 0 && (
            <span className="ml-2 badge badge-blue">{cycles.length} awaiting review</span>
          )}
        </h2>
        {cycles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">All caught up</p>
            <p className="text-xs text-slate-500">No payment proofs awaiting review.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {cycles.map((cycle) => (
              <li key={cycle._id} className="card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due date</p>
                    <p className="mt-0.5 font-semibold text-slate-800">
                      {new Date(cycle.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="mt-1 text-2xl font-extrabold text-brand-700">NPR {cycle.amount.toLocaleString()}</p>
                    <span className="badge badge-blue mt-2">Proof submitted</span>
                    {actionMsg[cycle._id] && (
                      <p className="mt-1.5 text-xs font-medium text-emerald-700">{actionMsg[cycle._id]}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => decide(cycle._id, 'confirmed')}
                      className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => decide(cycle._id, 'rejected')}
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
      </section>
    </div>
  );
}

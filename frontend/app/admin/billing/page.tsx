'use client';

import { useEffect, useRef, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type BillingCycle = {
  _id: string;
  dueDate: string;
  amount: number;
  status: string;
  tenantId?: { _id: string; fullName: string; email: string } | string;
  propertyId?: { _id: string; title: string; address: string } | string;
  confirmedAt?: string;
  rejectionReason?: string;
};

type BillRequest = {
  _id: string;
  message: string;
  status: 'pending' | 'sent';
  createdAt: string;
  tenantId: { _id: string; fullName: string; email: string } | null;
  propertyId: { _id: string; title: string } | null;
};

type ActionState = { text: string; ok: boolean; propertyId?: string };

const STATUS_BADGE: Record<string, string> = {
  pending_proof:        'badge-amber',
  proof_submitted:      'badge-blue',
  confirmed:            'badge-green',
  rejected:             'badge-red',
  pending_confirmation: 'badge-blue',
};

const STATUS_LABEL: Record<string, string> = {
  pending_proof:        'Awaiting receipt',
  proof_submitted:      'Under review',
  confirmed:            'Confirmed',
  rejected:             'Rejected',
  pending_confirmation: 'Under review',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminBillingPage() {
  const [pending, setPending]   = useState<BillingCycle[]>([]);
  const [history, setHistory]   = useState<BillingCycle[]>([]);
  const [requests, setRequests] = useState<BillRequest[]>([]);
  const [status, setStatus]     = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [actionMsg, setActionMsg] = useState<Record<string, ActionState>>({});
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofLoading, setProofLoading] = useState<string | null>(null);
  const [proofError, setProofError] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  const blobRegistry = useRef<string[]>([]);
  function makeBlobUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    blobRegistry.current.push(url);
    return url;
  }
  function revokeBlobUrl(url: string) {
    URL.revokeObjectURL(url);
    blobRegistry.current = blobRegistry.current.filter((u) => u !== url);
  }
  useEffect(() => { return () => { blobRegistry.current.forEach(URL.revokeObjectURL); }; }, []);

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    Promise.all([
      apiJson<BillingCycle[]>('/api/billing'),
      apiJson<BillRequest[]>('/api/billing/requests'),
    ])
      .then(([cycles, reqs]) => {
        setPending(cycles.filter((c) => c.status === 'proof_submitted'));
        setHistory(cycles.filter((c) => c.status !== 'proof_submitted'));
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
        setActionMsg((prev) => ({ ...prev, [cycleId]: { text: data?.error ?? 'Action failed. Please try again.', ok: false } }));
        return;
      }
      const decided = pending.find((c) => c._id === cycleId);
      if (decided) {
        setPending((prev) => prev.filter((c) => c._id !== cycleId));
        setHistory((prev) => [{ ...decided, status: decision }, ...prev]);
      }
      setActionMsg((prev) => ({ ...prev, [cycleId]: { text: decision === 'confirmed' ? 'Payment confirmed.' : 'Payment rejected.', ok: true } }));
    } catch {
      setActionMsg((prev) => ({ ...prev, [cycleId]: { text: 'Could not reach the server.', ok: false } }));
    }
  }

  async function sendBillRequest(requestId: string, propertyId: string | undefined) {
    try {
      const res = await apiFetch(`/api/billing/requests/${requestId}/send`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.error === 'NO_QR_CODE') {
          setActionMsg((prev) => ({
            ...prev,
            [requestId]: { text: data.message, ok: false, propertyId: data.propertyId ?? propertyId },
          }));
        } else {
          setActionMsg((prev) => ({ ...prev, [requestId]: { text: data?.error ?? 'Action failed.', ok: false } }));
        }
        return;
      }
      setActionMsg((prev) => ({ ...prev, [requestId]: { text: 'Bill sent. A billing cycle has been created for the tenant.', ok: true } }));
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch {
      setActionMsg((prev) => ({ ...prev, [requestId]: { text: 'Could not reach the server.', ok: false } }));
    }
  }

  async function viewProof(cycleId: string) {
    if (proofUrls[cycleId]) {
      revokeBlobUrl(proofUrls[cycleId]);
      setProofUrls((prev) => { const n = { ...prev }; delete n[cycleId]; return n; });
      return;
    }
    setProofLoading(cycleId);
    setProofError((prev) => { const n = { ...prev }; delete n[cycleId]; return n; });
    try {
      const res = await apiFetch(`/api/billing/${cycleId}/proof/admin-download`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setProofError((prev) => ({ ...prev, [cycleId]: data?.error ?? 'Could not load proof.' }));
        return;
      }
      const blob = await res.blob();
      setProofUrls((prev) => ({ ...prev, [cycleId]: makeBlobUrl(blob) }));
    } catch {
      setProofError((prev) => ({ ...prev, [cycleId]: 'Could not reach the server.' }));
    } finally {
      setProofLoading(null);
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
          {requests.length > 0 && <span className="ml-2 badge badge-amber">{requests.length} pending</span>}
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
                    {req.message && <p className="mt-1.5 text-sm text-slate-700 italic">"{req.message}"</p>}
                    <p className="mt-1 text-xs text-slate-400">{fmt(req.createdAt)}</p>
                    {actionMsg[req._id] && (
                      <div className="mt-1.5 space-y-1">
                        <p className={`text-xs font-medium ${actionMsg[req._id].ok ? 'text-emerald-700' : 'text-red-600'}`}>
                          {actionMsg[req._id].text}
                        </p>
                        {actionMsg[req._id].propertyId && (
                          <Link
                            href={`/admin/properties/${actionMsg[req._id].propertyId}/edit`}
                            className="text-xs font-semibold text-brand-700 underline hover:text-brand-800"
                          >
                            Go to property to upload QR code
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => sendBillRequest(req._id, req.propertyId?._id)}
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

      {/* Payment proofs awaiting review */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">
          Payment Proofs
          {pending.length > 0 && <span className="ml-2 badge badge-blue">{pending.length} awaiting review</span>}
        </h2>
        {pending.length === 0 ? (
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
            {pending.map((cycle) => (
              <li key={cycle._id} className="card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due date</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{fmt(cycle.dueDate)}</p>
                    <p className="mt-1 text-2xl font-extrabold text-brand-700">NPR {cycle.amount.toLocaleString()}</p>
                    <span className="badge badge-blue mt-2">Proof submitted</span>
                    {actionMsg[cycle._id] && (
                      <p className={`mt-1.5 text-xs font-medium ${actionMsg[cycle._id].ok ? 'text-emerald-700' : 'text-red-600'}`}>
                        {actionMsg[cycle._id].text}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => viewProof(cycle._id)}
                      disabled={proofLoading === cycle._id}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                      {proofLoading === cycle._id ? 'Loading...' : proofUrls[cycle._id] ? 'Hide' : 'View proof'}
                    </button>
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
                {proofError[cycle._id] && (
                  <p className="mt-3 text-xs text-red-600">{proofError[cycle._id]}</p>
                )}
                {proofUrls[cycle._id] && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <img
                      src={proofUrls[cycle._id]}
                      alt="Payment proof submitted by tenant"
                      loading="lazy"
                      className="max-w-full rounded-xl border border-slate-200 shadow-sm"
                      style={{ maxHeight: '480px', objectFit: 'contain' }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Billing history */}
      <section>
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
        >
          <span className="text-base font-semibold text-slate-800 flex items-center gap-2">
            Billing History
            {history.length > 0 && (
              <span className="text-xs font-medium text-slate-400">{history.length} cycle{history.length !== 1 ? 's' : ''}</span>
            )}
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`text-slate-400 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {historyOpen && (
          <div className="mt-3">
            {history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-6 text-center">
                <p className="text-sm text-slate-500">No billing history yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3 text-left">Due date</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Resolved</th>
                      <th className="px-4 py-3 text-left">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((cycle) => (
                      <tr key={cycle._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{fmt(cycle.dueDate)}</td>
                        <td className="px-4 py-3 font-semibold text-brand-700 whitespace-nowrap">NPR {cycle.amount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${STATUS_BADGE[cycle.status] ?? 'badge-slate'}`}>
                            {STATUS_LABEL[cycle.status] ?? cycle.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                          {cycle.confirmedAt ? fmt(cycle.confirmedAt) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {['proof_submitted', 'confirmed', 'rejected'].includes(cycle.status) && (
                            <button
                              onClick={() => viewProof(cycle._id)}
                              disabled={proofLoading === cycle._id}
                              className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50 transition-colors"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                              </svg>
                              {proofLoading === cycle._id ? '...' : proofUrls[cycle._id] ? 'Hide' : 'View'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Inline proof preview for history rows */}
                {history.some((c) => proofUrls[c._id]) && (
                  <div className="border-t border-slate-100 p-4 space-y-4">
                    {history.filter((c) => proofUrls[c._id] || proofError[c._id]).map((cycle) => (
                      <div key={cycle._id}>
                        <p className="text-xs font-semibold text-slate-500 mb-2">Receipt - {fmt(cycle.dueDate)}</p>
                        {proofError[cycle._id]
                          ? <p className="text-xs text-red-600">{proofError[cycle._id]}</p>
                          : <img
                              src={proofUrls[cycle._id]}
                              alt="Payment receipt"
                              loading="lazy"
                              className="max-w-full rounded-xl border border-slate-200 shadow-sm"
                              style={{ maxHeight: '400px', objectFit: 'contain' }}
                            />
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

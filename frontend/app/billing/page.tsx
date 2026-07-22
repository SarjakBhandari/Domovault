'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type BillingCycle = {
  _id: string;
  dueDate: string;
  amount: number;
  status: 'pending_proof' | 'proof_submitted' | 'confirmed' | 'rejected';
  rejectionReason?: string;
  leaseId: string;
  propertyId?: string;
};

type PaymentDetails = {
  rentPerMonth: number;
  electricityCharge: number | null;
  waterBill: number | null;
  otherBills: Array<{ label: string; amount: number }>;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankSortCode: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending_proof: 'Awaiting proof',
  proof_submitted: 'Under review',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
};

const STATUS_BADGE: Record<string, string> = {
  pending_proof: 'badge-amber',
  proof_submitted: 'badge-blue',
  confirmed: 'badge-green',
  rejected: 'badge-red',
};

export default function BillingPage() {
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<Record<string, { text: string; ok: boolean }>>({});
  const [paymentDetails, setPaymentDetails] = useState<Record<string, PaymentDetails>>({});
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [billReqMsg, setBillReqMsg] = useState<string | null>(null);
  const [billReqNote, setBillReqNote] = useState('');
  const [billReqSending, setBillReqSending] = useState(false);

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    apiJson<BillingCycle[]>('/api/billing')
      .then((data) => {
        setCycles(data);
        setStatus('ready');
        const propertyIds = [...new Set(
          data
            .filter((c) => ['pending_proof', 'rejected'].includes(c.status) && c.propertyId)
            .map((c) => c.propertyId as string)
        )];
        propertyIds.forEach(async (pid) => {
          try {
            const pd = await apiJson<PaymentDetails>(`/api/properties/${pid}/payment-details`);
            setPaymentDetails((prev) => ({ ...prev, [pid]: pd }));
          } catch { /* no payment details configured */ }
          try {
            const res = await apiFetch(`/api/properties/${pid}/qr-code`);
            if (res.ok) {
              const blob = await res.blob();
              setQrUrls((prev) => ({ ...prev, [pid]: URL.createObjectURL(blob) }));
            }
          } catch { /* no QR code */ }
        });
      })
      .catch((err) => setStatus(err.status === 401 ? 'unauth' : 'error'));
  }, []);

  async function handleBillRequest() {
    setBillReqSending(true);
    setBillReqMsg(null);
    try {
      const res = await apiFetch('/api/billing/requests', {
        method: 'POST',
        body: JSON.stringify({ message: billReqNote.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setBillReqMsg(data?.error ?? 'Failed to send request.');
      } else {
        setBillReqMsg('Bill request sent to your landlord.');
        setBillReqNote('');
      }
    } catch {
      setBillReqMsg('Could not reach the server.');
    } finally {
      setBillReqSending(false);
    }
  }

  async function handleProofUpload(cycleId: string, file: File) {
    setUploading(cycleId);
    setUploadMsg((prev) => ({ ...prev, [cycleId]: { text: '', ok: true } }));

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await apiFetch(`/api/billing/${cycleId}/proof`, { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setUploadMsg((prev) => ({ ...prev, [cycleId]: { text: data?.error ?? 'Upload failed. Please try again.', ok: false } }));
        return;
      }
      setUploadMsg((prev) => ({ ...prev, [cycleId]: { text: 'Proof uploaded. Awaiting owner review.', ok: true } }));
      const updated = await apiJson<BillingCycle[]>('/api/billing');
      setCycles(updated);
    } catch {
      setUploadMsg((prev) => ({ ...prev, [cycleId]: { text: 'Could not reach the server. Check your connection.', ok: false } }));
    } finally {
      setUploading(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded-lg bg-slate-100" />
          <div className="h-32 rounded-2xl bg-slate-100" />
          <div className="h-32 rounded-2xl bg-slate-100" />
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
        <p className="text-base font-semibold text-red-700">Could not load billing information.</p>
        <p className="mt-1.5 text-sm text-slate-500">Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-slate-500">View your rent cycles and upload payment proof.</p>
      </div>

      {/* Request bill */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Request a bill from your landlord</h2>
        <div className="space-y-3">
          <textarea
            value={billReqNote}
            onChange={(e) => setBillReqNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Optional message (e.g. 'Please send this month's bill')"
            className="input resize-none"
          />
          {billReqMsg && (
            <p className={`text-sm ${billReqMsg.startsWith('Bill request sent') ? 'text-emerald-700' : 'text-red-600'}`}>
              {billReqMsg}
            </p>
          )}
          <button
            onClick={handleBillRequest}
            disabled={billReqSending}
            className="btn-primary py-2 px-4 text-sm"
          >
            {billReqSending ? 'Sending...' : 'Request Bill'}
          </button>
        </div>
      </div>

      {cycles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" aria-hidden="true">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" x2="23" y1="10" y2="10" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">No billing cycles found</p>
          <p className="text-xs text-slate-500">Billing cycles will appear here once your lease starts.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {cycles.map((cycle) => (
            <li key={cycle._id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Due date
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">
                    {new Date(cycle.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="mt-2 text-2xl font-extrabold text-brand-700">
                    NPR{cycle.amount.toLocaleString()}
                  </p>
                </div>
                <span className={`badge shrink-0 ${STATUS_BADGE[cycle.status] ?? 'badge-slate'}`}>
                  {STATUS_LABELS[cycle.status] ?? cycle.status}
                </span>
              </div>

              {cycle.rejectionReason && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
                  </svg>
                  <span><span className="font-medium">Rejection reason:</span> {cycle.rejectionReason}</span>
                </div>
              )}

              {uploadMsg[cycle._id]?.text && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${uploadMsg[cycle._id].ok ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-700'}`}>
                  {uploadMsg[cycle._id].text}
                </div>
              )}

              {(cycle.status === 'pending_proof' || cycle.status === 'rejected') && cycle.propertyId && (paymentDetails[cycle.propertyId] || qrUrls[cycle.propertyId]) && (
                <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
                  {paymentDetails[cycle.propertyId] && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Payment breakdown</p>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-slate-600">Monthly rent</dt>
                          <dd className="font-semibold text-slate-800">NPR {paymentDetails[cycle.propertyId].rentPerMonth.toLocaleString()}</dd>
                        </div>
                        {paymentDetails[cycle.propertyId].electricityCharge != null && (
                          <div className="flex justify-between">
                            <dt className="text-slate-600">Electricity</dt>
                            <dd className="font-medium text-slate-700">NPR {paymentDetails[cycle.propertyId].electricityCharge!.toLocaleString()}</dd>
                          </div>
                        )}
                        {paymentDetails[cycle.propertyId].waterBill != null && (
                          <div className="flex justify-between">
                            <dt className="text-slate-600">Water bill</dt>
                            <dd className="font-medium text-slate-700">NPR {paymentDetails[cycle.propertyId].waterBill!.toLocaleString()}</dd>
                          </div>
                        )}
                        {paymentDetails[cycle.propertyId].otherBills.map((b, i) => (
                          <div key={i} className="flex justify-between">
                            <dt className="text-slate-600">{b.label}</dt>
                            <dd className="font-medium text-slate-700">NPR {b.amount.toLocaleString()}</dd>
                          </div>
                        ))}
                        <div className="flex justify-between border-t border-slate-100 pt-1.5 mt-1">
                          <dt className="font-semibold text-slate-700">Total this month</dt>
                          <dd className="font-bold text-brand-700">
                            NPR {(
                              paymentDetails[cycle.propertyId].rentPerMonth +
                              (paymentDetails[cycle.propertyId].electricityCharge ?? 0) +
                              (paymentDetails[cycle.propertyId].waterBill ?? 0) +
                              paymentDetails[cycle.propertyId].otherBills.reduce((s, b) => s + b.amount, 0)
                            ).toLocaleString()}
                          </dd>
                        </div>
                      </dl>
                      {paymentDetails[cycle.propertyId].bankAccountName && (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                          <p className="text-xs font-semibold text-slate-500">Bank transfer details</p>
                          <p className="text-sm font-medium text-slate-800">{paymentDetails[cycle.propertyId].bankAccountName}</p>
                          {paymentDetails[cycle.propertyId].bankSortCode && (
                            <p className="text-sm text-slate-600 font-mono">Sort code: {paymentDetails[cycle.propertyId].bankSortCode}</p>
                          )}
                          {paymentDetails[cycle.propertyId].bankAccountNumber && (
                            <p className="text-sm text-slate-600 font-mono">
                              Account: {paymentDetails[cycle.propertyId].bankAccountNumber!.replace(/(\d{4})(\d{4})/, '$1 $2')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {qrUrls[cycle.propertyId] && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Scan to pay</p>
                      <div className="inline-block rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <img
                          src={qrUrls[cycle.propertyId]}
                          alt="Payment QR code"
                          className="h-36 w-36 object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(cycle.status === 'pending_proof' || cycle.status === 'rejected') && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <label className="label">Upload payment proof (JPEG, PNG, or WebP)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading === cycle._id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleProofUpload(cycle._id, file);
                    }}
                    className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800 disabled:opacity-60 file:cursor-pointer"
                  />
                </div>
              )}
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

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
  ownerNotes?: string | null;
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

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');

  function loadRequests() {
    return apiJson<MaintenanceRequest[]>('/api/maintenance')
      .then((data) => { setRequests(data); setStatus('ready'); })
      .catch((err) => setStatus(err.status === 401 ? 'unauth' : 'error'));
  }

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    loadRequests();
  }, []);

  function validate(): string | null {
    if (description.trim().length < 10) return 'Description must be at least 10 characters.';
    if (description.trim().length > 2000) return 'Description cannot exceed 2000 characters.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setSubmitMsg(validationError); setSubmitStatus('error'); return; }
    setSubmitStatus('submitting');
    setSubmitMsg('');

    try {
      const res = await apiFetch('/api/maintenance', {
        method: 'POST',
        body: JSON.stringify({ description: description.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSubmitMsg(data?.error ?? 'Could not submit request. Please try again.');
        setSubmitStatus('error');
        return;
      }
      const created = await res.json() as { _id: string };

      if (photo && created._id) {
        const form = new FormData();
        form.append('file', photo);
        const photoRes = await apiFetch(`/api/maintenance/${created._id}/photos`, { method: 'POST', body: form });
        if (!photoRes.ok) {
          const data = await photoRes.json().catch(() => null);
          setSubmitMsg(`Request submitted but photo upload failed: ${data?.error ?? 'unknown error'}`);
          setSubmitStatus('error');
          setDescription('');
          setPhoto(null);
          loadRequests();
          return;
        }
      }

      setDescription('');
      setPhoto(null);
      setSubmitMsg('Request submitted successfully.');
      setSubmitStatus('done');
      loadRequests();
    } catch {
      setSubmitMsg('Could not reach the server. Check your connection.');
      setSubmitStatus('error');
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-56 rounded-lg bg-slate-100" />
          <div className="h-40 rounded-2xl bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
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
        <p className="text-base font-semibold text-red-700">Could not load maintenance requests.</p>
        <p className="mt-1.5 text-sm text-slate-500">Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Maintenance Requests</h1>
        <p className="mt-1 text-sm text-slate-500">Submit issues and track their resolution status.</p>
      </div>

      {/* Submit form */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-5">Submit a new request</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitMsg && (
            <div
              role="alert"
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                submitStatus === 'done'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {submitMsg}
            </div>
          )}
          <div>
            <label htmlFor="description" className="label">Describe the issue</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="Describe what needs attention and where in the property..."
              className="input resize-none"
            />
          </div>
          <div>
            <label className="label">Photo (optional, JPEG / PNG / WebP)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800 file:cursor-pointer"
            />
          </div>
          <button
            type="submit"
            disabled={submitStatus === 'submitting'}
            className="btn-primary"
          >
            {submitStatus === 'submitting' ? 'Submitting...' : 'Submit request'}
          </button>
        </form>
      </section>

      {/* Request list */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" aria-hidden="true">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">No requests yet</p>
          <p className="text-xs text-slate-500">Your submitted maintenance requests will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req._id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-slate-700">{req.description}</p>
                  {req.ownerNotes && (
                    <p className="mt-2 text-xs italic text-slate-500">
                      <span className="font-medium not-italic text-slate-600">Owner note:</span> {req.ownerNotes}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Submitted {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`badge shrink-0 ${STATUS_BADGE[req.status] ?? 'badge-slate'}`}>
                  {STATUS_LABEL[req.status] ?? req.status}
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

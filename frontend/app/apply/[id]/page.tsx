'use client';

import { useEffect, useState, startTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type Property = {
  _id: string;
  title: string;
  city: string;
  address: string;
  rentPerMonth: number;
  bedrooms: number;
  bathrooms: number;
  description: string;
  status: string;
};

type Status = 'loading' | 'ready' | 'unauth' | 'not-found' | 'unavailable' | 'submitting' | 'success' | 'error';

export default function ApplyPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [pageStatus, setPageStatus] = useState<Status>('loading');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    startTransition(() => setPageStatus('loading'));
    if (!getAccessToken()) {
      setPageStatus('unauth');
      return;
    }
    apiJson<Property>(`/api/properties/${id}`)
      .then((data) => {
        setProperty(data);
        setPageStatus(data.status !== 'available' ? 'unavailable' : 'ready');
      })
      .catch((err) => {
        setPageStatus(err.status === 404 ? 'not-found' : 'error');
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setPageStatus('submitting');

    try {
      const res = await apiFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ propertyId: id, notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error ?? 'Application failed. Please try again.');
        setPageStatus('ready');
        return;
      }
      setPageStatus('success');
    } catch {
      setErrorMsg('Could not reach the server. Check your connection.');
      setPageStatus('ready');
    }
  }

  if (pageStatus === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-64 rounded-lg bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="h-32 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (pageStatus === 'unauth') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">You must be logged in to apply</p>
        <Link href={`/login?return=/apply/${id}`} className="btn-primary mt-5 inline-flex justify-center">
          Log in
        </Link>
      </div>
    );
  }

  if (pageStatus === 'not-found' || !property) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">Property not found</p>
        <Link href="/browse" className="btn-primary mt-5 inline-flex justify-center">Browse properties</Link>
      </div>
    );
  }

  if (pageStatus === 'unavailable') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">Property unavailable</p>
        <p className="mt-1.5 text-sm text-slate-500">This property is no longer accepting applications.</p>
        <Link href="/browse" className="btn-primary mt-5 inline-flex justify-center">Browse properties</Link>
      </div>
    );
  }

  if (pageStatus === 'success') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="mt-5 text-xl font-extrabold text-slate-900">Application submitted</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Your application for <span className="font-medium text-slate-700">{property.title}</span> has been received. The owner will review it and get back to you.
          </p>
          <Link href="/applications" className="btn-primary mt-6 inline-flex justify-center">
            View my applications
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Apply for this property</h1>
        <p className="mt-1 text-sm text-slate-500">Review the details and send a message to the owner.</p>
      </div>

      {/* Property summary */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800">{property.title}</p>
            <p className="mt-0.5 text-sm text-slate-500">{property.address}, {property.city}</p>
            <p className="mt-0.5 text-xs text-slate-400">{property.bedrooms}bd {property.bathrooms}ba</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-extrabold text-brand-700">NPR {property.rentPerMonth.toLocaleString()}</p>
            <p className="text-xs text-slate-400">per month</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="notes" className="label">Message to owner (optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="Introduce yourself, mention your move-in date, employment status, etc."
            className="input resize-none"
          />
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          By submitting you agree to the owner reviewing your profile. You can upload ID and income proof after submitting via My Applications.
        </p>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={pageStatus === 'submitting'}
            className="btn-primary"
          >
            {pageStatus === 'submitting' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Submitting...
              </span>
            ) : 'Submit application'}
          </button>
          <Link href={`/properties/${id}`} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

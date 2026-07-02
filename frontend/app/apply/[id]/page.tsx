'use client';

import { useEffect, useState, startTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
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
        if (data.status !== 'available') {
          setPageStatus('unavailable');
        } else {
          setPageStatus('ready');
        }
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
      await apiFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ propertyId: id, notes }),
      });
      setPageStatus('success');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message ?? 'Application failed. Please try again.');
      setPageStatus('ready');
    }
  }

  if (pageStatus === 'loading') {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">Loading...</div>;
  }

  if (pageStatus === 'unauth') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p>You must be logged in to apply.</p>
        <Link href={`/login?return=/apply/${id}`} className="mt-4 inline-block text-brand-700 underline">
          Log in
        </Link>
      </div>
    );
  }

  if (pageStatus === 'not-found' || !property) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-600">
        <p>This property could not be found.</p>
        <Link href="/browse" className="mt-4 inline-block text-brand-700 underline">Browse properties</Link>
      </div>
    );
  }

  if (pageStatus === 'unavailable') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-600">
        <p>This property is no longer available for applications.</p>
        <Link href="/browse" className="mt-4 inline-block text-brand-700 underline">Browse other properties</Link>
      </div>
    );
  }

  if (pageStatus === 'success') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-lg border border-green-200 bg-green-50 p-8">
          <h1 className="text-xl font-bold text-green-800">Application submitted</h1>
          <p className="mt-2 text-sm text-green-700">
            Your application for <strong>{property.title}</strong> has been received.
            The owner will review it and get back to you.
          </p>
          <Link href="/applications" className="mt-6 inline-block text-brand-700 underline text-sm">
            View my applications
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Apply for this property</h1>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">{property.title}</p>
        <p className="mt-0.5 text-slate-500">
          {property.address}, {property.city} &mdash; {property.bedrooms}bd {property.bathrooms}ba
        </p>
        <p className="mt-1 font-semibold text-brand-700">
          &pound;{property.rentPerMonth.toLocaleString()} / month
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {errorMsg && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
            Message to owner (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Introduce yourself, mention your move-in date, etc."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <p className="text-xs text-slate-500">
          By submitting you agree to the owner reviewing your profile and any documents you upload.
          You can upload ID and income proof after submitting via My Applications.
        </p>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={pageStatus === 'submitting'}
            className="rounded-md bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {pageStatus === 'submitting' ? 'Submitting...' : 'Submit application'}
          </button>
          <Link href={`/properties/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

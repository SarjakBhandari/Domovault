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

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
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
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Loading...</div>;
  }
  if (status === 'unauth') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Link href="/login" className="text-brand-700 underline">Log in</Link> to view your applications.
      </div>
    );
  }
  if (status === 'error') {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-red-600">Could not load applications.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">My Applications</h1>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          No applications yet.{' '}
          <Link href="/browse" className="text-brand-700 underline">
            Browse properties
          </Link>{' '}
          to get started.
        </div>
      ) : (
        <ul className="space-y-4">
          {applications.map((app) => (
            <li key={app._id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-800">
                    {app.propertyId?.title ?? 'Property'}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {app.propertyId?.address}, {app.propertyId?.city} &mdash;
                    &pound;{app.propertyId?.rentPerMonth.toLocaleString()}/mo
                  </p>
                  {app.applicantId && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Applicant: {app.applicantId.fullName} ({app.applicantId.email})
                    </p>
                  )}
                  {app.notes && (
                    <p className="mt-1 text-xs text-slate-400 italic">{app.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    Applied {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[app.status] ?? 'bg-slate-100 text-slate-700'}`}
                >
                  {app.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 text-sm">
        <Link href="/dashboard" className="text-brand-700 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

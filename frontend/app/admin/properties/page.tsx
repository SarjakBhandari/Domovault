'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type Property = {
  _id: string;
  title: string;
  city: string;
  address: string;
  rentPerMonth: number;
  status: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  available: boolean;
};

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [deleteState, setDeleteState] = useState<Record<string, 'idle' | 'confirming' | 'deleting'>>({});
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!getAccessToken()) { setPageStatus('unauth'); return; }
    apiJson<Property[]>('/api/properties/mine')
      .then((data) => { setProperties(data); setPageStatus('ready'); })
      .catch((err) => setPageStatus(err.status === 401 || err.status === 403 ? 'unauth' : 'error'));
  }, []);

  async function handleDelete(id: string) {
    setDeleteState((s) => ({ ...s, [id]: 'deleting' }));
    setDeleteError((e) => ({ ...e, [id]: '' }));
    try {
      await apiFetch(`/api/properties/${id}`, { method: 'DELETE' });
      setProperties((prev) => prev.filter((p) => p._id !== id));
    } catch (err: unknown) {
      setDeleteState((s) => ({ ...s, [id]: 'idle' }));
      setDeleteError((e) => ({ ...e, [id]: (err as Error).message ?? 'Delete failed.' }));
    }
  }

  if (pageStatus === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (pageStatus === 'unauth') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">Admin access required</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">Log in</Link>
      </div>
    );
  }

  if (pageStatus === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Could not load properties.</p>
        <p className="mt-1.5 text-sm text-slate-500">Please refresh and try again.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Properties</h1>
          <p className="mt-1 text-sm text-slate-500">
            {properties.length === 0 ? 'No listings yet.' : `${properties.length} listing${properties.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link
          href="/admin/properties/new"
          className="btn-primary gap-2 self-start sm:self-auto"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="12" x2="12" y1="5" y2="19" />
            <line x1="5" x2="19" y1="12" y2="12" />
          </svg>
          Add property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No properties yet</p>
            <p className="mt-0.5 text-xs text-slate-500">Add your first listing to get started.</p>
          </div>
          <Link href="/admin/properties/new" className="btn-primary gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            Add property
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {properties.map((p) => (
            <li key={p._id} className="card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800 truncate">{p.title}</p>
                    <span className={`badge ${p.status === 'available' ? 'badge-green' : p.status === 'leased' ? 'badge-blue' : 'badge-slate'} capitalize shrink-0`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500 truncate">{p.address}, {p.city}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="font-bold text-base text-brand-700">NPR {p.rentPerMonth.toLocaleString()}<span className="text-xs font-normal text-slate-500">/mo</span></span>
                    <span>{p.bedrooms === 0 ? 'Studio' : `${p.bedrooms} bed`}</span>
                    <span>{p.bathrooms} bath</span>
                    <span>{p.sizeSqft} sqft</span>
                  </div>
                  {deleteError[p._id] && (
                    <p className="mt-2 text-xs text-red-600">{deleteError[p._id]}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/properties/${p._id}/edit`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Edit
                  </Link>

                  {deleteState[p._id] === 'confirming' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(p._id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteState((s) => ({ ...s, [p._id]: 'idle' }))}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteState((s) => ({ ...s, [p._id]: 'confirming' }))}
                      disabled={deleteState[p._id] === 'deleting'}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleteState[p._id] === 'deleting' ? 'Deleting...' : 'Delete'}
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

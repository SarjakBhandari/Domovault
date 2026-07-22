'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type AppUser = {
  _id: string;
  fullName: string;
  email: string;
  role: 'applicant' | 'tenant';
  isVerified: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [actionMsg, setActionMsg] = useState<Record<string, { text: string; ok: boolean }>>({});
  const [confirming, setConfirming] = useState<{ id: string; action: 'delete' | 'remove-tenant' } | null>(null);

  useEffect(() => {
    startTransition(() => setPageStatus('loading'));
    if (!getAccessToken()) { setPageStatus('unauth'); return; }
    apiJson<AppUser[]>('/api/admin/users')
      .then((data) => { setUsers(data); setPageStatus('ready'); })
      .catch((err) => setPageStatus(err.status === 403 || err.status === 401 ? 'unauth' : 'error'));
  }, []);

  async function handleAction(userId: string, action: 'delete' | 'remove-tenant') {
    setActionMsg((prev) => ({ ...prev, [userId]: { text: '', ok: true } }));
    try {
      const endpoint = action === 'delete'
        ? `/api/admin/users/${userId}/delete`
        : `/api/admin/users/${userId}/remove-tenant`;

      const res = await apiFetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionMsg((prev) => ({ ...prev, [userId]: { text: data?.error ?? 'Action failed.', ok: false } }));
        return;
      }
      if (action === 'delete') {
        setUsers((prev) => prev.filter((u) => u._id !== userId));
      } else {
        setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, role: 'applicant' } : u));
        setActionMsg((prev) => ({ ...prev, [userId]: { text: 'Tenant removed  -  role set to applicant.', ok: true } }));
      }
    } catch {
      setActionMsg((prev) => ({ ...prev, [userId]: { text: 'Could not reach the server.', ok: false } }));
    } finally {
      setConfirming(null);
    }
  }

  if (pageStatus === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 rounded-lg bg-slate-100" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100" />
          ))}
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
        <p className="text-base font-semibold text-red-700">Could not load users.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            {users.length === 0 ? 'No users found.' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Admin
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">No users</p>
          <p className="text-xs text-slate-500">Registered users will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => {
            const initials = u.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
            const isPending = confirming?.id === u._id;
            return (
              <li key={u._id} className="card p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-xs font-bold text-brand-700">
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{u.fullName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      <div className="mt-1.5 flex gap-2 flex-wrap">
                        <span className={`badge ${u.role === 'tenant' ? 'badge-green' : 'badge-blue'}`}>
                          {u.role === 'tenant' ? 'Tenant' : 'Applicant'}
                        </span>
                        {!u.isVerified && <span className="badge badge-amber">Unverified</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 min-w-[10rem]">
                    {!isPending ? (
                      <div className="flex gap-2 flex-wrap justify-end">
                        {u.role === 'tenant' && (
                          <>
                            <button
                              onClick={() => router.push(`/messages/${u._id}`)}
                              className="btn-secondary py-1.5 px-3 text-xs"
                            >
                              Message
                            </button>
                            <button
                              onClick={() => setConfirming({ id: u._id, action: 'remove-tenant' })}
                              className="btn-secondary py-1.5 px-3 text-xs"
                            >
                              Remove tenant
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setConfirming({ id: u._id, action: 'delete' })}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                        >
                          Delete account
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-xs font-medium text-slate-700">
                          {confirming.action === 'delete' ? 'Delete this account permanently?' : 'Remove tenant and end their lease?'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirming(null)}
                            className="btn-secondary py-1 px-3 text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAction(u._id, confirming.action)}
                            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}

                    {actionMsg[u._id]?.text && (
                      <p className={`text-xs ${actionMsg[u._id].ok ? 'text-emerald-700' : 'text-red-600'}`}>
                        {actionMsg[u._id].text}
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

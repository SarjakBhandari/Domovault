'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type Conversation = {
  conversationId: string;
  other: { _id: string; fullName: string; role: string; avatarStoredName?: string | null } | null;
  latestMessage: { body: string; createdAt: string; senderId: string };
  unreadCount: number;
};

type Lease = {
  ownerId: { _id: string; fullName: string } | null;
};

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [landlord, setLandlord] = useState<{ _id: string; fullName: string } | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }
    Promise.all([
      apiJson<Conversation[]>('/api/messages'),
      apiJson<{ role: string }>('/api/profile'),
    ])
      .then(async ([convs, profile]) => {
        setConversations(convs);
        setMyRole(profile.role);
        if (profile.role === 'tenant') {
          try {
            const leases = await apiJson<Lease[]>('/api/billing/leases');
            const active = leases.find((l) => l.ownerId);
            if (active?.ownerId) setLandlord(active.ownerId);
          } catch { /* no lease */ }
        }
        setStatus('ready');
      })
      .catch((err) => setStatus(err.status === 401 || err.status === 403 ? 'unauth' : 'error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded-lg bg-slate-100" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-100" />
          ))}
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
        <p className="text-base font-semibold text-red-700">Could not load messages.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Messages</h1>

      {myRole === 'tenant' && landlord && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm text-slate-700">
            Your landlord: <span className="font-semibold text-brand-800">{landlord.fullName}</span>
          </p>
          <button
            onClick={() => router.push(`/messages/${landlord._id}`)}
            className="btn-primary py-1.5 px-4 text-xs shrink-0"
          >
            Message landlord
          </button>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">No conversations yet</p>
          <p className="text-xs text-slate-500">Messages between you and the other party will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((conv) => {
            const initials = (conv.other?.fullName ?? '?')
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              <li key={conv.conversationId}>
                <Link
                  href={`/messages/${conv.other?._id}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-700">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800 truncate">{conv.other?.fullName ?? 'Unknown'}</p>
                      <span className="text-xs text-slate-400 shrink-0">
                        {new Date(conv.latestMessage.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate">{conv.latestMessage.body}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/dashboard" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to dashboard
      </Link>
    </div>
  );
}

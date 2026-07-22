'use client';

import { useEffect, useState, useRef, startTransition } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type Message = {
  _id: string;
  senderId: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type OtherUser = {
  _id: string;
  fullName: string;
  role: string;
};

type ConversationData = {
  messages: Message[];
  other: OtherUser;
};

export default function ConversationPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [data, setData] = useState<ConversationData | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauth' | 'error'>('loading');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startTransition(() => setStatus('loading'));
    if (!getAccessToken()) { setStatus('unauth'); return; }

    Promise.all([
      apiJson<ConversationData>(`/api/messages/${userId}`),
      apiJson<{ _id: string }>('/api/profile'),
    ])
      .then(([conv, profile]) => {
        setData(conv);
        setMyId(profile._id);
        setStatus('ready');
      })
      .catch((err) => setStatus(err.status === 401 || err.status === 403 ? 'unauth' : 'error'));
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setSendErr(null);
    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ recipientId: userId, body: body.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setSendErr(d?.error ?? 'Failed to send message.');
        return;
      }
      const newMsg = await res.json() as Message;
      setData((prev) => prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev);
      setBody('');
    } catch {
      setSendErr('Could not reach the server.');
    } finally {
      setSending(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded-lg bg-slate-100" />
          <div className="h-64 rounded-2xl bg-slate-100" />
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

  if (status === 'error' || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Could not load conversation.</p>
      </div>
    );
  }

  const initials = data.other.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 flex flex-col h-[calc(100dvh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-4">
        <Link href="/messages" className="text-slate-400 hover:text-slate-700 transition-colors mr-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-700">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-slate-800 leading-tight">{data.other.fullName}</p>
          <p className="text-xs text-slate-500 capitalize">{data.other.role}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {data.messages.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">No messages yet. Say hello.</p>
        )}
        {data.messages.map((msg) => {
          const isMine = msg.senderId === myId || msg.senderId.toString() === myId;
          return (
            <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMine
                    ? 'bg-brand-700 text-white rounded-br-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                }`}
              >
                <p className="leading-relaxed">{msg.body}</p>
                <p className={`mt-1 text-[10px] ${isMine ? 'text-brand-200' : 'text-slate-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="pt-3 border-t border-slate-200">
        {sendErr && <p className="mb-2 text-xs text-red-600">{sendErr}</p>}
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); } }}
            placeholder="Type a message..."
            maxLength={2000}
            rows={2}
            className="input flex-1 resize-none py-2"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="btn-primary px-4 py-2 self-end text-sm disabled:opacity-50"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

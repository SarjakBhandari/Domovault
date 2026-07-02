'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type UserProfile = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string | null;
  bio?: string | null;
  mfaEnabled: boolean;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'error' | 'unauth'>('loading');

  // Profile edit state.
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [profileMsg, setProfileMsg] = useState('');

  // Password change state.
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    startTransition(() => setPageStatus('loading'));
    if (!getAccessToken()) {
      setPageStatus('unauth');
      return;
    }
    apiJson<UserProfile>('/api/profile')
      .then((data) => {
        setUser(data);
        setFullName(data.fullName);
        setPhone(data.phone ?? '');
        setBio(data.bio ?? '');
        setPageStatus('ready');
      })
      .catch((err) => {
        setPageStatus(err.status === 401 ? 'unauth' : 'error');
      });
  }, []);

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg('');
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, phone: phone || undefined, bio: bio || undefined }),
      });
      setProfileMsg('Profile updated.');
    } catch (err: unknown) {
      setProfileMsg((err as Error).message ?? 'Update failed.');
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg('');
    try {
      const res = await apiFetch('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.status === 204) {
        setPwMsg('Password changed. Please log in again.');
        setCurrentPw('');
        setNewPw('');
      } else {
        const data = await res.json().catch(() => null);
        setPwMsg(data?.error ?? 'Password change failed.');
      }
    } catch (err: unknown) {
      setPwMsg((err as Error).message ?? 'Password change failed.');
    }
  }

  if (pageStatus === 'loading') {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">Loading...</div>;
  }
  if (pageStatus === 'unauth') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p>You must be logged in to view this page.</p>
        <Link href="/login" className="mt-4 inline-block text-brand-700 underline">Log in</Link>
      </div>
    );
  }
  if (pageStatus === 'error' || !user) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-red-600">Could not load profile.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile &amp; Security</h1>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
      </div>

      {/* Profile edit */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Personal details</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <Field label="Full name" id="fullName">
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Phone (optional)" id="phone">
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Bio (optional)" id="bio">
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          {profileMsg && <p className="text-sm text-green-700">{profileMsg}</p>}
          <button
            type="submit"
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Save changes
          </button>
        </form>
      </section>

      {/* Password change */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Change password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Field label="Current password" id="currentPw">
            <input
              id="currentPw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="New password (min 12 characters)" id="newPw">
            <input
              id="newPw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.includes('changed') ? 'text-green-700' : 'text-red-700'}`}>
              {pwMsg}
            </p>
          )}
          <button
            type="submit"
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Change password
          </button>
        </form>
      </section>

      {/* MFA */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-800 mb-2">Two-factor authentication</h2>
        <p className="text-sm text-slate-500 mb-4">
          {user.mfaEnabled
            ? 'Two-factor authentication is enabled on your account.'
            : 'Add a second layer of security by enabling TOTP authentication.'}
        </p>
        {user.mfaEnabled ? (
          <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            Enabled
          </span>
        ) : (
          <Link
            href="/mfa-setup"
            className="inline-block rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
          >
            Enable two-factor authentication
          </Link>
        )}
      </section>

      <div className="text-sm">
        <Link href="/dashboard" className="text-brand-700 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

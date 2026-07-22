'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiJson, apiFetch } from '@/lib/api';
import { getAccessToken, clearAccessToken } from '@/lib/authToken';

type UserProfile = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string | null;
  bio?: string | null;
  mfaEnabled: boolean;
  avatarStoredName?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'error' | 'unauth'>('loading');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [deletePw, setDeletePw] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ text: string; ok: boolean } | null>(null);

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

  function validateProfile(): string | null {
    if (fullName.trim().length < 2) return 'Full name must be at least 2 characters.';
    if (phone && !/^\+?[0-9\s\-().]{7,30}$/.test(phone.trim())) return 'Please enter a valid phone number (e.g. +44 7700 900123).';
    if (bio.length > 500) return 'Bio cannot exceed 500 characters.';
    return null;
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateProfile();
    if (validationError) { setProfileMsg({ text: validationError, ok: false }); return; }
    setProfileMsg(null);
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, phone: phone.trim() || undefined, bio: bio.trim() || undefined }),
      });
      setProfileMsg({ text: 'Profile updated successfully.', ok: true });
    } catch (err: unknown) {
      setProfileMsg({ text: (err as Error).message ?? 'Update failed.', ok: false });
    }
  }

  function validatePasswordChange(): string | null {
    if (!currentPw) return 'Please enter your current password.';
    if (newPw.length < 12) return 'New password must be at least 12 characters.';
    return null;
  }

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    setAvatarMsg(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await apiFetch('/api/profile/avatar', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setAvatarMsg({ text: data?.error ?? 'Upload failed.', ok: false });
      } else {
        setUser((prev) => prev ? { ...prev, avatarStoredName: 'updated' } : prev);
        setAvatarMsg({ text: 'Profile picture updated.', ok: true });
      }
    } catch {
      setAvatarMsg({ text: 'Could not upload. Check your connection.', ok: false });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validatePasswordChange();
    if (validationError) { setPwMsg({ text: validationError, ok: false }); return; }
    setPwMsg(null);
    try {
      const res = await apiFetch('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.status === 204) {
        setPwMsg({ text: 'Password changed. Please log in again with your new password.', ok: true });
        setCurrentPw('');
        setNewPw('');
      } else {
        const data = await res.json().catch(() => null);
        setPwMsg({ text: data?.error ?? 'Password change failed.', ok: false });
      }
    } catch (err: unknown) {
      setPwMsg({ text: (err as Error).message ?? 'Password change failed.', ok: false });
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!deletePw) { setDeleteMsg({ text: 'Enter your password to confirm.', ok: false }); return; }
    setDeleteMsg(null);
    try {
      const res = await apiFetch('/api/profile/delete', {
        method: 'POST',
        body: JSON.stringify({ password: deletePw }),
      });
      if (res.status === 204) {
        clearAccessToken();
        router.push('/login');
      } else {
        const data = await res.json().catch(() => null);
        setDeleteMsg({ text: data?.error ?? 'Account deletion failed.', ok: false });
      }
    } catch {
      setDeleteMsg({ text: 'Could not reach the server.', ok: false });
    }
  }

  if (pageStatus === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-6">
          <div className="h-7 w-48 rounded-lg bg-slate-100" />
          <div className="h-48 rounded-2xl bg-slate-100" />
          <div className="h-36 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (pageStatus === 'unauth') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">You must be logged in</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">Log in</Link>
      </div>
    );
  }

  if (pageStatus === 'error' || !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Could not load profile.</p>
        <p className="mt-1.5 text-sm text-slate-500">Please refresh to try again.</p>
      </div>
    );
  }

  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {user.avatarStoredName ? (
            <img
              src={`/api/profile/avatar/${user._id}`}
              alt={user.fullName}
              className="h-14 w-14 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-sm font-bold text-white">
              {initials}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Profile and Security</h1>
          <p className="mt-0.5 text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      {/* Avatar */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Profile picture</h2>
        <div className="flex items-center gap-5">
          <div className="shrink-0">
            {user.avatarStoredName ? (
              <img
                src={`/api/profile/avatar/${user._id}`}
                alt={user.fullName}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-400">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-3">JPEG, PNG, or WebP. Max 10 MB.</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={avatarUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
              className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800 disabled:opacity-60 file:cursor-pointer"
            />
            {avatarMsg && (
              <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${avatarMsg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {avatarUploading ? 'Uploading...' : avatarMsg.text}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Personal details */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-5">Personal details</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="label">Full name</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="phone" className="label">Phone (optional)</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="bio" className="label">Bio (optional)</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="input resize-none"
            />
          </div>
          {profileMsg && (
            <div
              role="alert"
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                profileMsg.ok
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {profileMsg.text}
            </div>
          )}
          <button type="submit" className="btn-primary">
            Save changes
          </button>
        </form>
      </section>

      {/* Password change */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-5">Change password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="currentPw" className="label">Current password</label>
            <input
              id="currentPw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="newPw" className="label">New password</label>
            <input
              id="newPw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              className="input"
            />
            <p className="mt-1.5 text-xs text-slate-500">At least 12 characters.</p>
          </div>
          {pwMsg && (
            <div
              role="alert"
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                pwMsg.ok
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {pwMsg.text}
            </div>
          )}
          <button type="submit" className="btn-primary">
            Change password
          </button>
        </form>
      </section>

      {/* MFA */}
      <section className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Two-factor authentication</h2>
            <p className="mt-1 text-sm text-slate-500">
              {user.mfaEnabled
                ? 'Your account is protected with TOTP two-factor authentication.'
                : 'Add a second layer of security to your account.'}
            </p>
          </div>
          {user.mfaEnabled ? (
            <span className="badge badge-green shrink-0">Enabled</span>
          ) : (
            <Link
              href="/mfa-setup"
              className="btn-primary shrink-0 text-xs px-3 py-2"
            >
              Enable 2FA
            </Link>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="card border-red-200 p-6">
        <h2 className="text-sm font-semibold text-red-700 mb-1">Delete account</h2>
        <p className="text-xs text-slate-500 mb-4">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
          >
            Delete my account
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-3">
            <div>
              <label htmlFor="deletePw" className="label">Confirm with your password</label>
              <input
                id="deletePw"
                type="password"
                value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)}
                autoComplete="current-password"
                className="input"
              />
            </div>
            {deleteMsg && (
              <div role="alert" className={`rounded-lg px-3 py-2.5 text-sm ${deleteMsg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {deleteMsg.text}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDeleteConfirm(false); setDeletePw(''); setDeleteMsg(null); }} className="btn-secondary text-sm py-2">Cancel</button>
              <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
                Delete permanently
              </button>
            </div>
          </form>
        )}
      </section>

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

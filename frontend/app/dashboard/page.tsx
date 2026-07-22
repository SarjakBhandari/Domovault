'use client';

import { useEffect, useState, startTransition } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type UserProfile = {
  _id: string;
  fullName: string;
  email: string;
  role: 'applicant' | 'tenant' | 'admin';
  isVerified: boolean;
  mfaEnabled: boolean;
  phone?: string | null;
  bio?: string | null;
};

type Status = 'loading' | 'ready' | 'error' | 'unauthenticated';

const ROLE_LABELS: Record<UserProfile['role'], string> = {
  applicant: 'Applicant',
  tenant: 'Tenant',
  admin: 'Administrator',
};

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    startTransition(() => setStatus('loading'));

    if (!getAccessToken()) {
      setStatus('unauthenticated');
      return;
    }

    apiJson<UserProfile>('/api/profile')
      .then((data) => {
        setUser(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (err.status === 401) {
          setStatus('unauthenticated');
        } else {
          setStatus('error');
        }
      });
  }, []);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-56 rounded-lg bg-slate-100" />
          <div className="h-4 w-32 rounded-lg bg-slate-100" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-slate-400" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="mt-4 text-base font-semibold text-slate-800">You are not logged in</p>
        <p className="mt-1.5 text-sm text-slate-500">Sign in to access your dashboard.</p>
        <Link href="/login" className="btn-primary mt-6 inline-flex justify-center">
          Log in
        </Link>
      </div>
    );
  }

  if (status === 'error' || !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Could not load your dashboard.</p>
        <p className="mt-1.5 text-sm text-slate-500">Please refresh the page to try again.</p>
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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Welcome header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-sm font-bold text-white">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Welcome back, {user.fullName.split(' ')[0]}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="badge badge-blue">{ROLE_LABELS[user.role]}</span>
            {!user.isVerified && (
              <span className="badge badge-amber">Email unverified</span>
            )}
            {user.mfaEnabled && (
              <span className="badge badge-green">2FA enabled</span>
            )}
          </div>
        </div>
      </div>

      {/* MFA nudge */}
      {!user.mfaEnabled && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          <div className="text-sm">
            <span className="font-semibold text-amber-800">Secure your account. </span>
            <span className="text-amber-700">
              Enable two-factor authentication in{' '}
              <Link href="/profile" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                Profile Settings
              </Link>{' '}
              for stronger protection.
            </span>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(user.role === 'applicant' || user.role === 'tenant') && (
          <>
            <DashboardCard
              href="/browse"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              }
              title="Browse Properties"
              description="Find available rental properties and apply."
            />
            <DashboardCard
              href="/applications"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" x2="8" y1="13" y2="13" />
                  <line x1="16" x2="8" y1="17" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
              title="My Applications"
              description="Track the status of your rental applications."
            />
          </>
        )}

        {user.role === 'tenant' && (
          <>
            <DashboardCard
              href="/lease"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              }
              title="Lease Details"
              description="View your current lease terms and move-in date."
            />
            <DashboardCard
              href="/billing"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" x2="23" y1="10" y2="10" />
                </svg>
              }
              title="Billing"
              description="View your rent due and upload payment proof."
            />
            <DashboardCard
              href="/maintenance"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              }
              title="Maintenance"
              description="Submit and track maintenance requests."
            />
          </>
        )}

        {user.role === 'admin' && (
          <>
            <DashboardCard
              href="/admin/properties"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              }
              title="My Properties"
              description="Add, edit and manage your property listings."
            />
            <DashboardCard
              href="/admin/applications"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" x2="8" y1="13" y2="13" />
                  <line x1="16" x2="8" y1="17" y2="17" />
                </svg>
              }
              title="Applications"
              description="Review and approve rental applications."
            />
            <DashboardCard
              href="/admin/billing"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" x2="23" y1="10" y2="10" />
                </svg>
              }
              title="Billing"
              description="Confirm tenant payment proofs."
            />
            <DashboardCard
              href="/admin/maintenance"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              }
              title="Maintenance"
              description="Manage requests across your properties."
            />
            <DashboardCard
              href="/admin/tenants"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              title="Tenants"
              description="View and manage your current tenants."
            />
            <DashboardCard
              href="/admin/users"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
              title="User Management"
              description="View, remove, and delete user accounts."
            />
            <DashboardCard
              href="/admin/audit"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" x2="8" y1="17" y2="17" />
                  <line x1="16" x2="8" y1="13" y2="13" />
                </svg>
              }
              title="Audit Logs"
              description="Review all system activity."
            />
          </>
        )}

        <DashboardCard
          href="/profile"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
          title="Profile and Security"
          description={`Manage your details${user.mfaEnabled ? '' : ' and enable two-factor authentication'}.`}
        />
        <DashboardCard
          href="/data-export"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
          }
          title="Export My Data"
          description="Download a copy of all your personal data."
        />
      </div>
    </div>
  );
}

function DashboardCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group card card-hover flex flex-col gap-3 p-5"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

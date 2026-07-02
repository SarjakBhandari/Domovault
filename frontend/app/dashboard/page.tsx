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
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Loading...</div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-600">You are not logged in.</p>
        <Link href="/login" className="mt-4 inline-block text-brand-700 underline">
          Log in
        </Link>
      </div>
    );
  }

  if (status === 'error' || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-red-600">
        Could not load your dashboard. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome back, {user.fullName}
      </h1>
      <p className="mt-1 text-sm text-slate-500 capitalize">
        Role: {user.role}
        {!user.isVerified && (
          <span className="ml-2 text-amber-600">(email not yet verified)</span>
        )}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(user.role === 'applicant' || user.role === 'tenant') && (
          <>
            <DashboardCard
              href="/browse"
              title="Browse Properties"
              description="Find available rental properties and apply."
            />
            <DashboardCard
              href="/applications"
              title="My Applications"
              description="Track the status of your rental applications."
            />
          </>
        )}

        {user.role === 'tenant' && (
          <>
            <DashboardCard
              href="/billing"
              title="Billing"
              description="View your rent due and upload payment proof."
            />
            <DashboardCard
              href="/maintenance"
              title="Maintenance"
              description="Submit and track maintenance requests for your property."
            />
          </>
        )}

        {user.role === 'admin' && (
          <>
            <DashboardCard
              href="/admin/properties"
              title="My Properties"
              description="Manage your property listings, rent, and QR codes."
            />
            <DashboardCard
              href="/applications"
              title="Applications"
              description="Review rental applications for your properties."
            />
            <DashboardCard
              href="/billing"
              title="Billing"
              description="Review and confirm tenant payment proofs."
            />
            <DashboardCard
              href="/maintenance"
              title="Maintenance"
              description="Manage maintenance requests across your properties."
            />
          </>
        )}

        <DashboardCard
          href="/profile"
          title="Profile &amp; Security"
          description={`Manage your details${user.mfaEnabled ? '' : ' and enable two-factor authentication'}.`}
        />
        <DashboardCard
          href="/messaging"
          title="Messages"
          description="View and send messages about your properties."
        />
      </div>

      {!user.mfaEnabled && (
        <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Recommended:</strong> Enable two-factor authentication in{' '}
          <Link href="/profile" className="underline">
            Profile Settings
          </Link>{' '}
          to better protect your account.
        </div>
      )}
    </div>
  );
}

function DashboardCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-400 hover:shadow-md"
    >
      <h2 className="font-semibold text-slate-800 group-hover:text-brand-700">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Link>
  );
}

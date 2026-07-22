'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken } from '@/lib/authToken';

// Landing page after OAuth provider redirect.
// The backend sets the refreshToken httpOnly cookie and redirects here with
// the access token in the URL. We move it to sessionStorage immediately and
// replace the URL so the token never sits in browser history.
export default function OAuthCallbackPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    const token      = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      const messages: Record<string, string> = {
        oauth_denied:          'You cancelled the sign-in. Please try again.',
        oauth_state_mismatch:  'Security check failed. Please try again.',
        oauth_no_email:        'Your account has no verified email address. Please use a different sign-in method.',
        oauth_missing_params:  'The sign-in flow was incomplete. Please try again.',
      };
      setError(messages[errorParam] ?? 'Sign-in failed. Please try again.');
      return;
    }

    if (!token) {
      setError('No access token received. Please try again.');
      return;
    }

    // Store in sessionStorage and immediately remove from URL
    setAccessToken(token);
    window.history.replaceState({}, '', '/oauth/callback');

    router.push('/dashboard');
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-red-50 border border-red-200">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Sign-in failed</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <a
            href="/login"
            className="btn-primary inline-flex justify-center"
          >
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin text-brand-700" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p className="text-sm font-medium text-slate-500">Completing sign-in...</p>
      </div>
    </div>
  );
}

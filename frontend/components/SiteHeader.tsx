'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getAccessToken, clearAccessToken } from '@/lib/authToken';
import { apiJson } from '@/lib/api';
import { getCsrfToken } from '@/lib/csrf';

type AuthUser = {
  fullName: string;
  email: string;
  role: 'applicant' | 'tenant' | 'admin';
  avatarStoredName?: string | null;
  _id?: string;
};

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  applicant: 'Applicant',
  tenant: 'Tenant',
  admin: 'Administrator',
};

function LogoMark() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="30" height="30" rx="8" fill="#0f766e" />
      <path d="M15 7.5L23.5 14V22.5H18.5V17H11.5V22.5H6.5V14L15 7.5Z" fill="white" fillOpacity="0.92" />
      <rect x="12" y="18" width="6" height="4.5" rx="0.75" fill="#0f766e" />
    </svg>
  );
}

export default function SiteHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    apiJson<AuthUser>('/api/profile')
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, [mounted, pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  async function handleLogout() {
    try {
      const csrf = await getCsrfToken();
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf },
        credentials: 'include',
      });
    } finally {
      clearAccessToken();
      setUser(null);
      router.push('/login');
    }
  }

  const isLoggedIn = mounted && !!getAccessToken();

  const initials = user
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  const navLinkClass =
    'rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-800';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg text-lg font-bold text-slate-900 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <LogoMark />
          <span className="tracking-tight">
            Domo<span className="text-brand-700">vault</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {user?.role !== 'admin' && (
            <Link href="/browse" className={navLinkClass}>
              Browse
            </Link>
          )}

          {isLoggedIn && (
            <>
              <Link href="/dashboard" className={navLinkClass}>
                Dashboard
              </Link>
              {user?.role === 'admin' && (
                <Link href="/admin/properties" className={navLinkClass}>
                  Properties
                </Link>
              )}
            </>
          )}

          {!isLoggedIn && (
            <>
              <Link href="/login" className={navLinkClass}>
                Log in
              </Link>
              <Link href="/register" className="btn-primary ml-1">
                Get started
              </Link>
            </>
          )}

          {/* User avatar dropdown */}
          {isLoggedIn && (
            <div className="relative ml-2" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-sm font-bold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                {user?.avatarStoredName && user?._id ? (
                  <img
                    src={`/api/profile/avatar/${user._id}`}
                    alt={user.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : initials || (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-slate-200 bg-white py-2 shadow-lg ring-1 ring-black/5">
                  {user && (
                    <div className="border-b border-slate-100 px-4 pb-2.5 pt-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{user.fullName}</p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">{user.email}</p>
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {ROLE_LABEL[user.role]}
                      </span>
                    </div>
                  )}
                  <div className="py-1">
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-900"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="9" rx="1" />
                        <rect x="14" y="3" width="7" height="5" rx="1" />
                        <rect x="14" y="12" width="7" height="9" rx="1" />
                        <rect x="3" y="16" width="7" height="5" rx="1" />
                      </svg>
                      Dashboard
                    </Link>
                    <Link
                      href="/profile"
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-900"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Profile and security
                    </Link>
                    {user?.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-900"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        Admin panel
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" x2="9" y1="12" y2="12" />
                      </svg>
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile right side */}
        <div className="flex items-center gap-2 md:hidden">
          {isLoggedIn && (
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-xs font-bold text-white">
              {user?.avatarStoredName && user?._id ? (
                <img src={`/api/profile/avatar/${user._id}`} alt="" className="h-full w-full object-cover" />
              ) : (initials || '?')}
            </div>
          )}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 md:hidden">
          {user && (
            <div className="mb-3 flex items-center gap-3 border-b border-slate-100 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-sm font-bold text-white">
                {user?.avatarStoredName && user?._id ? (
                  <img src={`/api/profile/avatar/${user._id}`} alt="" className="h-full w-full object-cover" />
                ) : initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
                <p className="truncate text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
          )}

          <nav className="flex flex-col gap-0.5">
            {user?.role !== 'admin' && (
              <Link href="/browse" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-900">
                Browse properties
              </Link>
            )}

            {isLoggedIn && (
              <>
                <Link href="/dashboard" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-900">
                  Dashboard
                </Link>
                {user?.role === 'admin' && (
                  <>
                    <Link href="/admin/properties" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-900">
                      My properties
                    </Link>
                    <Link href="/admin/applications" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-900">
                      Applications
                    </Link>
                  </>
                )}
                <Link href="/profile" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-900">
                  Profile and security
                </Link>
                {user?.role === 'admin' && (
                  <Link href="/admin" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-900">
                    Admin panel
                  </Link>
                )}
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" x2="9" y1="12" y2="12" />
                    </svg>
                    Log out
                  </button>
                </div>
              </>
            )}

            {!isLoggedIn && (
              <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2">
                <Link href="/login" className="rounded-lg px-3 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                  Log in
                </Link>
                <Link href="/register" className="btn-primary justify-center">
                  Get started
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

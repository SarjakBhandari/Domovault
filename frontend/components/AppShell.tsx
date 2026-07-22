'use client';

import { useState, useEffect, useRef, startTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getAccessToken, clearAccessToken } from '@/lib/authToken';
import { apiJson } from '@/lib/api';
import { getCsrfToken } from '@/lib/csrf';
import { getSidebarCollapsed, setSidebarCollapsed } from '@/lib/uiPrefs';

type AuthUser = {
  _id: string;
  fullName: string;
  email: string;
  role: 'applicant' | 'tenant' | 'admin';
  avatarStoredName?: string | null;
};

type NavItem = {
  href: string;
  label: string;
  Icon: React.FC;
  exact?: boolean;
};

const NO_SIDEBAR_PATHS = new Set([
  '/',
  '/login', '/register', '/verify-email',
  '/forgot-password', '/mfa-verify', '/mfa-setup',
]);

function isNoSidebarPage(p: string) {
  return NO_SIDEBAR_PATHS.has(p) || p.startsWith('/reset-password');
}

const SVG_PROPS = {
  width: 18, height: 18, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function IcDashboard() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function IcSearch() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function IcFileText() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
    </svg>
  );
}
function IcCard() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" x2="23" y1="10" y2="10" />
    </svg>
  );
}
function IcWrench() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function IcUsers() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IcClipboard() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <line x1="16" x2="8" y1="12" y2="12" />
      <line x1="12" x2="8" y1="16" y2="16" />
    </svg>
  );
}
function IcUpload() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}
function IcUser() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IcDownload() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
function IcHome() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IcLogIn() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" x2="3" y1="12" y2="12" />
    </svg>
  );
}
function IcLogOut() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}
function IcBuilding() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V9h6v12" />
    </svg>
  );
}
function IcMessage() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IcChevronLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IcChevronRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IcMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}
function IcClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}
function IcChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const APPLICANT_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: IcDashboard },
  { href: '/browse',    label: 'Browse',    Icon: IcSearch },
  { href: '/applications', label: 'Applications', Icon: IcFileText },
];

const TENANT_NAV: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',  Icon: IcDashboard },
  { href: '/browse',       label: 'Browse',     Icon: IcSearch },
  { href: '/lease',        label: 'My Lease',   Icon: IcHome },
  { href: '/billing',      label: 'Billing',    Icon: IcCard },
  { href: '/maintenance',  label: 'Maintenance', Icon: IcWrench },
  { href: '/messages',     label: 'Messages',   Icon: IcMessage },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin',                label: 'Overview',     Icon: IcDashboard, exact: true },
  { href: '/admin/properties',     label: 'Properties',  Icon: IcBuilding },
  { href: '/admin/applications',   label: 'Applications', Icon: IcFileText },
  { href: '/admin/billing',        label: 'Billing',     Icon: IcCard },
  { href: '/admin/maintenance',    label: 'Maintenance', Icon: IcWrench },
  { href: '/admin/tenants',        label: 'Tenants',     Icon: IcUsers },
  { href: '/admin/users',          label: 'Users',       Icon: IcUser },
  { href: '/messages',             label: 'Messages',    Icon: IcMessage },
  { href: '/admin/audit',          label: 'Audit Logs',  Icon: IcClipboard },
  { href: '/admin/bulk-import',    label: 'Bulk Import', Icon: IcUpload },
];

const GUEST_NAV: NavItem[] = [
  { href: '/browse', label: 'Browse Properties', Icon: IcSearch },
];

const BOTTOM_NAV: NavItem[] = [
  { href: '/profile',     label: 'Profile',     Icon: IcUser },
  { href: '/data-export', label: 'Export Data', Icon: IcDownload },
];

function getMainNav(user: AuthUser | null): NavItem[] {
  if (!user) return GUEST_NAV;
  if (user.role === 'admin') return ADMIN_NAV;
  if (user.role === 'tenant') return TENANT_NAV;
  return APPLICANT_NAV;
}

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="30" height="30" rx="8" fill="#800020" />
      <path d="M15 7.5L23.5 14V22.5H18.5V17H11.5V22.5H6.5V14L15 7.5Z" fill="white" fillOpacity="0.92" />
      <rect x="12" y="18" width="6" height="4.5" rx="0.75" fill="#800020" />
    </svg>
  );
}

function NavLink({
  item,
  collapsed,
  pathname,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  onClick?: () => void;
}) {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={[
        'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1',
        collapsed ? 'justify-center p-2' : 'px-3 py-2',
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      ].join(' ')}
    >
      <span className={`shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`}>
        <item.Icon />
      </span>
      {!collapsed && <span className="truncate leading-none">{item.label}</span>}
    </Link>
  );
}

function Sidebar({
  collapsed,
  mobileOpen,
  onClose,
  onToggle,
  user,
  pathname,
  onLogout,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  user: AuthUser | null;
  pathname: string;
  onLogout: () => void;
}) {
  const mainNav = getMainNav(user);
  const homeHref = user?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <aside
      id="app-sidebar"
      aria-label="Application navigation"
      className={[
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-slate-100',
        'transition-[width,transform] duration-200 ease-in-out',
        'md:relative md:translate-x-0 md:z-auto',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:shadow-none',
        collapsed ? 'w-[3.5rem]' : 'w-[15rem]',
      ].join(' ')}
    >
      {/* Logo row */}
      <div className={`flex h-14 shrink-0 items-center border-b border-slate-100 ${collapsed ? 'justify-center' : 'gap-2.5 px-4'}`}>
        <Link
          href={homeHref}
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <LogoMark size={27} />
          {!collapsed && (
            <span className="text-[14px] font-bold tracking-tight text-slate-900 leading-none">
              Domo<span className="text-brand-700">vault</span>
            </span>
          )}
        </Link>

        {/* Mobile close */}
        <button
          className="ml-auto mr-2 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 md:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <IcClose />
        </button>
      </div>

      {/* Main nav */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5"
        aria-label="Main navigation"
      >
        {mainNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            pathname={pathname}
            onClick={onClose}
          />
        ))}

        {user && (
          <>
            <div className="my-2 border-t border-slate-100" />
            {BOTTOM_NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
                onClick={onClose}
              />
            ))}
          </>
        )}

        {!user && (
          <>
            <div className="my-2 border-t border-slate-100" />
            <NavLink item={{ href: '/login',    label: 'Log in',   Icon: IcLogIn  }} collapsed={collapsed} pathname={pathname} onClick={onClose} />
            <NavLink item={{ href: '/register', label: 'Register', Icon: IcUser   }} collapsed={collapsed} pathname={pathname} onClick={onClose} />
          </>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="shrink-0 border-t border-slate-100 px-2 py-2 space-y-0.5">
        {user && (
          <button
            onClick={onLogout}
            title={collapsed ? 'Log out' : undefined}
            className={[
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500',
              'transition-colors hover:bg-red-50 hover:text-red-600',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
              collapsed ? 'justify-center p-2' : '',
            ].join(' ')}
          >
            <IcLogOut />
            {!collapsed && 'Log out'}
          </button>
        )}

        {/* Desktop collapse toggle */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={[
            'hidden md:flex w-full items-center gap-3 rounded-lg py-2 text-xs font-medium text-slate-400',
            'transition-colors hover:bg-slate-50 hover:text-slate-600',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
            collapsed ? 'justify-center p-2' : 'px-3',
          ].join(' ')}
        >
          {collapsed ? <IcChevronRight /> : <IcChevronLeft />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}

const ROLE_LABEL: Record<AuthUser['role'], string> = {
  applicant: 'Applicant',
  tenant: 'Tenant',
  admin: 'Administrator',
};

function Topbar({
  onMobileOpen,
  user,
  onLogout,
  mounted,
}: {
  onMobileOpen: () => void;
  user: AuthUser | null;
  onLogout: () => void;
  mounted: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => { startTransition(() => setMenuOpen(false)); }, [pathname]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && menuOpen) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const initials = user
    ? user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4">
      {/* Mobile hamburger */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 md:hidden"
        onClick={onMobileOpen}
        aria-label="Open navigation"
        aria-controls="app-sidebar"
      >
        <IcMenu />
      </button>

      <div className="flex-1" />

      {/* User area */}
      {mounted && (
        <div className="relative" ref={menuRef}>
          {user ? (
            <>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="User menu"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-[10px] font-bold text-white">
                  {user.avatarStoredName && user._id ? (
                    <img src={`/api/profile/avatar/${user._id}`} alt={user.fullName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{initials || '?'}</span>
                  )}
                </div>
                <span className="hidden max-w-[120px] truncate sm:block leading-none">{user.fullName}</span>
                <IcChevronDown />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="User options"
                  className="absolute right-0 top-full mt-2 w-52 origin-top-right rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 z-50"
                >
                  <div className="border-b border-slate-100 px-3.5 py-2.5">
                    <p className="text-xs font-semibold text-slate-900 truncate">{user.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
                    <span className="mt-1.5 inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 uppercase tracking-wide">
                      {ROLE_LABEL[user.role]}
                    </span>
                  </div>
                  <div className="px-1 py-1">
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                    >
                      <IcUser />
                      Profile and security
                    </Link>
                  </div>
                  <div className="border-t border-slate-100 px-1 py-1">
                    <button
                      role="menuitem"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                    >
                      <IcLogOut />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Log in
              </Link>
              <Link href="/register" className="btn-primary py-1.5 px-4 text-[13px]">
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
      setCollapsed(getSidebarCollapsed());
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const token = getAccessToken();
    if (!token) {
      startTransition(() => setUser(null));
      return;
    }
    apiJson<AuthUser>('/api/profile')
      .then((data) => startTransition(() => setUser(data)))
      .catch(() => startTransition(() => setUser(null)));
  }, [mounted, pathname]);

  useEffect(() => { startTransition(() => setMobileOpen(false)); }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    setSidebarCollapsed(next);
  }

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

  // No-sidebar pages: landing page gets a full nav header; auth pages get a minimal logo header.
  if (isNoSidebarPage(pathname)) {
    const isLanding = pathname === '/';
    return (
      <div className={`flex min-h-dvh flex-col ${isLanding ? 'bg-white' : 'bg-slate-50'}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>

        {isLanding ? (
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
            <nav
              aria-label="Primary navigation"
              className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
            >
              <Link
                href="/"
                className="flex items-center gap-2.5 rounded-lg text-[15px] font-bold tracking-tight text-slate-900 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <LogoMark size={27} />
                Domo<span className="text-brand-700">vault</span>
              </Link>

              {/* Desktop nav */}
              <div className="hidden items-center gap-1 md:flex">
                <Link
                  href="/browse"
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
                >
                  Browse
                </Link>
                {!user ? (
                  <>
                    <Link
                      href="/login"
                      className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
                    >
                      Log in
                    </Link>
                    <Link href="/register" className="btn-primary ml-1">
                      Register
                    </Link>
                  </>
                ) : (
                  <Link href="/dashboard" className="btn-primary ml-1">
                    Dashboard
                  </Link>
                )}
              </div>

              {/* Mobile nav */}
              <div className="flex items-center gap-2 md:hidden">
                {!user ? (
                  <>
                    <Link
                      href="/login"
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-brand-700"
                    >
                      Log in
                    </Link>
                    <Link href="/register" className="btn-primary py-1.5 px-4 text-xs">
                      Register
                    </Link>
                  </>
                ) : (
                  <Link href="/dashboard" className="btn-primary py-1.5 px-4 text-xs">
                    Dashboard
                  </Link>
                )}
              </div>
            </nav>
          </header>
        ) : (
          <div className="border-b border-slate-100 bg-white px-6 py-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md text-[14px] font-bold tracking-tight text-slate-900 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <LogoMark size={25} />
              Domo<span className="text-brand-700">vault</span>
            </Link>
          </div>
        )}

        <main id="main-content" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-slate-100 bg-white px-4 py-2.5 text-center text-xs text-slate-400">
          Security project by Sarjak Bhandari
        </footer>
      </div>
    );
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex h-dvh overflow-hidden bg-slate-50">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onToggle={toggleCollapsed}
          user={user}
          pathname={pathname}
          onLogout={handleLogout}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            onMobileOpen={() => setMobileOpen(true)}
            user={user}
            onLogout={handleLogout}
            mounted={mounted}
          />

          <main id="main-content" className="flex-1 overflow-y-auto">
            {children}
          </main>

          <footer className="shrink-0 border-t border-slate-100 bg-white px-4 py-2 text-center text-[11px] text-slate-400">
            Security project by Sarjak Bhandari
          </footer>
        </div>
      </div>
    </>
  );
}

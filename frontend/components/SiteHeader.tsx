import Link from 'next/link';

export default function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md text-lg font-bold text-brand-800"
        >
          Domovault
        </Link>

        <ul className="flex items-center gap-2 sm:gap-4">
          <li>
            <Link
              href="/browse"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-brand-800"
            >
              Browse Properties
            </Link>
          </li>
          <li>
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-brand-800"
            >
              Log in
            </Link>
          </li>
          <li>
            <Link
              href="/register"
              className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Sign up
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

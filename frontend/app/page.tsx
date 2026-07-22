import Link from 'next/link';
import { getFeaturedProperties } from '@/lib/properties';
import PropertyCard from '@/components/PropertyCard';
import EmptyState from '@/components/EmptyState';
import SearchForm from '@/components/SearchForm';

const STATS = [
  { value: 'Secure', label: 'end-to-end encrypted' },
  { value: 'GDPR', label: 'compliant by design' },
  { value: '2FA', label: 'multi-factor auth' },
  { value: 'Fast', label: 'instant applications' },
];

export default async function HomePage() {
  const featured = await getFeaturedProperties();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.07),transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent"
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-300">
              Trusted rental platform
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Rent smarter,{' '}
              <span className="text-brand-300">live safer.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-100 sm:text-lg">
              Domovault connects you with quality rentals and manages your entire tenancy securely,
              from application to lease end. Your documents, never in an unprotected inbox.
            </p>

            <div className="mt-8 max-w-xl">
              <SearchForm />
            </div>

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{stat.value}</span>
                  <span className="text-sm text-brand-200">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured properties */}
      <section
        aria-labelledby="featured-heading"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="flex items-end justify-between">
          <div>
            <h2 id="featured-heading" className="section-heading">
              Featured properties
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Hand-picked listings available right now.
            </p>
          </div>
          <Link
            href="/browse"
            className="hidden text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 sm:inline-flex items-center gap-1"
          >
            Browse all
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No properties available right now"
              description="Check back soon, or browse the full catalogue for upcoming availability."
            />
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </ul>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/browse"
            className="btn-secondary inline-block"
          >
            Browse all properties
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="section-heading">Built for security, designed for ease</h2>
            <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto">
              Every feature is built with your data and your tenancy in mind.
            </p>
          </div>

          <dl className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                title: 'End-to-end security',
                description:
                  'AES-256 encryption for sensitive data, multi-factor authentication, and zero unprotected document inboxes.',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.99 16l-.07.92z" />
                  </svg>
                ),
                title: 'Direct communication',
                description:
                  'Message landlords and manage your application through a single, secure platform. No third-party email needed.',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" x2="23" y1="10" y2="10" />
                  </svg>
                ),
                title: 'Transparent billing',
                description:
                  'Upload payment proof, track rent status, and access your full billing history in one place.',
              },
            ].map(({ icon, title, description }) => (
              <div key={title} className="card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  {icon}
                </div>
                <dt className="mt-4 text-sm font-semibold text-slate-900">{title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-500">{description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-brand-800 to-brand-700">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to find your next home?
          </h2>
          <p className="mt-3 text-brand-100 text-sm">
            Join thousands of tenants managing their rental journey securely.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/browse"
              className="rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-brand-800 shadow-sm transition-colors hover:bg-brand-50"
            >
              Browse properties
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-brand-400 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600/50"
            >
              Create free account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

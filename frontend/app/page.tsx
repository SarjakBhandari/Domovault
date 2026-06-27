import Link from 'next/link';
import { getFeaturedProperties } from '@/lib/properties';
import PropertyCard from '@/components/PropertyCard';
import EmptyState from '@/components/EmptyState';
import SearchForm from '@/components/SearchForm';

export default async function HomePage() {
  const featured = await getFeaturedProperties();

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-900 to-brand-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Rent with confidence.
          </h1>
          <p className="mt-4 max-w-xl text-base text-brand-100 sm:text-lg">
            Domovault helps you find a home, apply securely, and manage your
            tenancy end to end, without your personal documents ever sitting
            in an unprotected inbox.
          </p>

          <div className="mt-8 max-w-2xl">
            <SearchForm />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="featured-heading"
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="featured-heading" className="text-2xl font-bold text-slate-900">
            Featured available properties
          </h2>
          <Link
            href="/browse"
            className="rounded-md text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Browse all
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
      </section>
    </div>
  );
}

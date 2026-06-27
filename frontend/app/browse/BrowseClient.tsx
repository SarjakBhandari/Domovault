'use client';

import { startTransition, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProperties } from '@/lib/properties';
import type { Property } from '@/lib/types';
import PropertyCard from '@/components/PropertyCard';
import PropertyCardSkeleton from '@/components/PropertyCardSkeleton';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';

type Status = 'loading' | 'success' | 'error';

export default function BrowseClient() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('query') ?? '');
  const [maxRent, setMaxRent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let active = true;
    startTransition(() => {
      setStatus('loading');
    });

    getProperties({
      query: query || undefined,
      maxRent: maxRent ? Number(maxRent) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
    })
      .then((results) => {
        if (!active) return;
        setProperties(results);
        setStatus('success');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });

    return () => {
      active = false;
    };
    // requestId lets the "Try again" button re-run the same query on failure.
  }, [query, maxRent, bedrooms, requestId]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Browse properties</h1>

      <form
        role="search"
        aria-label="Filter properties"
        className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label htmlFor="filter-query" className="block text-sm font-medium text-slate-700">
            City or address
          </label>
          <input
            id="filter-query"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Leeds"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:border-brand-600"
          />
        </div>

        <div>
          <label htmlFor="filter-bedrooms" className="block text-sm font-medium text-slate-700">
            Bedrooms
          </label>
          <select
            id="filter-bedrooms"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:border-brand-600"
          >
            <option value="">Any</option>
            <option value="0">Studio</option>
            <option value="1">1 bed</option>
            <option value="2">2 bed</option>
            <option value="3">3 bed</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-rent" className="block text-sm font-medium text-slate-700">
            Max rent (£/month)
          </label>
          <input
            id="filter-rent"
            type="number"
            min="0"
            inputMode="numeric"
            value={maxRent}
            onChange={(e) => setMaxRent(e.target.value)}
            placeholder="e.g. 1200"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:border-brand-600"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setMaxRent('');
              setBedrooms('');
            }}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      </form>

      <div className="mt-8" aria-live="polite">
        {status === 'loading' && (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </ul>
        )}

        {status === 'error' && (
          <ErrorState
            message="We couldn't load properties right now. Please try again."
            onRetry={() => setRequestId((id) => id + 1)}
          />
        )}

        {status === 'success' && properties.length === 0 && (
          <EmptyState
            title="No properties match your filters"
            description="Try widening your search, for example by raising the max rent or clearing the bedroom filter."
          />
        )}

        {status === 'success' && properties.length > 0 && (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

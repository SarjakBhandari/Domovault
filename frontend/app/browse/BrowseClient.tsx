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

  const hasFilters = query !== '' || maxRent !== '' || bedrooms !== '';

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
      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Browse properties</h1>
        <p className="mt-1 text-sm text-slate-500">Filter by location, size, or budget to find your next home.</p>
      </div>

      {/* Filter bar */}
      <div
        role="search"
        aria-label="Filter properties"
        className="card p-4 sm:p-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="filter-query" className="label">City or address</label>
            <div className="relative mt-1.5">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <input
                id="filter-query"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Leeds"
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="filter-bedrooms" className="label">Bedrooms</label>
            <select
              id="filter-bedrooms"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="input mt-1.5"
            >
              <option value="">Any</option>
              <option value="0">Studio</option>
              <option value="1">1 bed</option>
              <option value="2">2 bed</option>
              <option value="3">3 bed</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-rent" className="label">Max rent (NPR/month)</label>
            <input
              id="filter-rent"
              type="number"
              min="0"
              inputMode="numeric"
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              placeholder="e.g. 1200"
              className="input mt-1.5"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={!hasFilters}
              onClick={() => {
                setQuery('');
                setMaxRent('');
                setBedrooms('');
              }}
              className="btn-secondary w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* Result count */}
      {status === 'success' && (
        <p className="mt-5 text-sm text-slate-500">
          {properties.length === 0
            ? 'No properties match your filters.'
            : `Showing ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}`}
          {hasFilters && properties.length > 0 && ' matching your filters'}
        </p>
      )}

      {/* Results */}
      <div className="mt-5" aria-live="polite">
        {status === 'loading' && (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
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

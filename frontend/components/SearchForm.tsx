'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('query', query.trim());
    }
    router.push(`/browse${params.size ? `?${params.toString()}` : ''}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search properties"
      className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row"
    >
      <label htmlFor="home-search" className="sr-only">
        Search by city or address
      </label>
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <input
          id="home-search"
          name="query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City, postcode, or address..."
          className="w-full rounded-xl border-0 bg-transparent py-3.5 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 text-sm"
        />
      </div>
      <button
        type="submit"
        className="rounded-xl bg-brand-700 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        Search
      </button>
    </form>
  );
}

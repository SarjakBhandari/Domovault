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
      className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow-lg sm:flex-row"
    >
      <label htmlFor="home-search" className="sr-only">
        Search by city or address
      </label>
      <input
        id="home-search"
        name="query"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by city or address, e.g. Manchester"
        className="flex-1 rounded-md border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:border-brand-600"
      />
      <button
        type="submit"
        className="rounded-md bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
      >
        Search
      </button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getCsrfToken } from '@/lib/csrf';

type FormData = {
  title: string;
  description: string;
  city: string;
  address: string;
  bedrooms: string;
  bathrooms: string;
  sizeSqft: string;
  rentPerMonth: string;
  amenities: string;
};

const EMPTY: FormData = {
  title: '', description: '', city: '', address: '',
  bedrooms: '1', bathrooms: '1', sizeSqft: '', rentPerMonth: '', amenities: '',
};

export default function NewPropertyPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setError(null);
    setFieldErrors({});

    const amenities = form.amenities
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    const body = {
      title: form.title,
      description: form.description,
      city: form.city,
      address: form.address,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      sizeSqft: Number(form.sizeSqft),
      rentPerMonth: Number(form.rentPerMonth),
      amenities,
    };

    try {
      const csrf = await getCsrfToken();
      const res = await apiFetch('/api/properties', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.details && typeof data.details === 'object') {
          setFieldErrors(data.details as Record<string, string[]>);
          setError('Please fix the errors below.');
        } else {
          setError(data?.error ?? 'Could not create property.');
        }
        setStatus('error');
        return;
      }

      router.push('/admin/properties');
    } catch {
      setError('Could not reach the server. Check your connection.');
      setStatus('error');
    }
  }

  const inputClass = 'input';
  const labelClass = 'label';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/admin/properties"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="sr-only">Back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Add property</h1>
          <p className="mt-0.5 text-sm text-slate-500">Fill in the details for your new listing.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div className="card p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">Basic details</h2>

          <div>
            <label htmlFor="title" className={labelClass}>Property title</label>
            <input id="title" type="text" value={form.title} onChange={set('title')} required minLength={3} maxLength={200} placeholder="e.g. Modern 2-bed flat in city centre" className={inputClass} />
            {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title.join(' ')}</p>}
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea id="description" value={form.description} onChange={set('description')} required minLength={10} maxLength={5000} rows={5} placeholder="Describe the property, its features and surroundings..." className="input resize-y" />
            {fieldErrors.description && <p className="mt-1 text-xs text-red-600">{fieldErrors.description.join(' ')}</p>}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={labelClass}>City</label>
              <input id="city" type="text" value={form.city} onChange={set('city')} required minLength={2} maxLength={100} placeholder="e.g. London" className={inputClass} />
              {fieldErrors.city && <p className="mt-1 text-xs text-red-600">{fieldErrors.city.join(' ')}</p>}
            </div>
            <div>
              <label htmlFor="address" className={labelClass}>Address</label>
              <input id="address" type="text" value={form.address} onChange={set('address')} required minLength={5} maxLength={300} placeholder="e.g. 12 Baker Street, London" className={inputClass} />
              {fieldErrors.address && <p className="mt-1 text-xs text-red-600">{fieldErrors.address.join(' ')}</p>}
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">Property specs</h2>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div>
              <label htmlFor="bedrooms" className={labelClass}>Bedrooms</label>
              <input id="bedrooms" type="number" value={form.bedrooms} onChange={set('bedrooms')} min={0} max={20} required className={inputClass} />
            </div>
            <div>
              <label htmlFor="bathrooms" className={labelClass}>Bathrooms</label>
              <input id="bathrooms" type="number" value={form.bathrooms} onChange={set('bathrooms')} min={0} max={20} required className={inputClass} />
            </div>
            <div>
              <label htmlFor="sizeSqft" className={labelClass}>Size (sqft)</label>
              <input id="sizeSqft" type="number" value={form.sizeSqft} onChange={set('sizeSqft')} min={0} required placeholder="650" className={inputClass} />
              {fieldErrors.sizeSqft && <p className="mt-1 text-xs text-red-600">{fieldErrors.sizeSqft.join(' ')}</p>}
            </div>
            <div>
              <label htmlFor="rentPerMonth" className={labelClass}>Rent / month (NPR)</label>
              <input id="rentPerMonth" type="number" value={form.rentPerMonth} onChange={set('rentPerMonth')} min={0} required placeholder="1200" className={inputClass} />
              {fieldErrors.rentPerMonth && <p className="mt-1 text-xs text-red-600">{fieldErrors.rentPerMonth.join(' ')}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="amenities" className={labelClass}>Amenities <span className="text-slate-400 font-normal">(comma-separated)</span></label>
            <input id="amenities" type="text" value={form.amenities} onChange={set('amenities')} maxLength={1000} placeholder="e.g. WiFi, Parking, Garden, Dishwasher" className={inputClass} />
            <p className="mt-1 text-xs text-slate-400">Separate each item with a comma.</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/admin/properties" className="btn-secondary justify-center">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="btn-primary justify-center"
          >
            {status === 'submitting' ? (
              <>
                <svg className="animate-spin mr-2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Saving...
              </>
            ) : 'Create property'}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/authToken';

type ImportResult = { imported: number };
type RowError = { row: number; issues: Record<string, string[]> };

const TEMPLATE = JSON.stringify(
  [
    {
      title: 'Example flat in city centre',
      description: 'A bright two-bedroom flat with modern kitchen and open-plan living.',
      city: 'London',
      address: '12 Example Street, E1 4AB',
      bedrooms: 2,
      bathrooms: 1,
      sizeSqft: 750,
      amenities: ['parking', 'dishwasher'],
      rentPerMonth: 1800,
    },
  ],
  null,
  2
);

export default function BulkImportPage() {
  const [json, setJson] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [generalError, setGeneralError] = useState('');

  if (!getAccessToken()) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-slate-800">Authentication required</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex justify-center">Log in</Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setResult(null);
    setRowErrors([]);
    setGeneralError('');

    let rows: unknown;
    try {
      rows = JSON.parse(json);
    } catch {
      setGeneralError('Invalid JSON. Check the format and try again.');
      setStatus('error');
      return;
    }

    try {
      const res = await apiFetch('/api/admin/properties/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          setRowErrors(data.errors as RowError[]);
        } else {
          setGeneralError(data.error ?? 'Import failed.');
        }
        setStatus('error');
        return;
      }
      setResult(data as ImportResult);
      setJson('');
      setStatus('done');
    } catch (err: unknown) {
      setGeneralError((err as Error).message ?? 'Could not reach the server.');
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Bulk Import Properties</h1>
          <p className="mt-1 text-sm text-slate-500">Paste a JSON array  -  all rows are validated before saving.</p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Admin
        </Link>
      </div>

      {status === 'done' && result && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Successfully imported {result.imported} {result.imported === 1 ? 'property' : 'properties'}.
        </div>
      )}

      {generalError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
          {generalError}
        </div>
      )}

      {rowErrors.length > 0 && (
        <div role="alert" className="card p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">Validation errors ({rowErrors.length} row{rowErrors.length !== 1 ? 's' : ''}):</p>
          <ul className="space-y-1.5">
            {rowErrors.map((e) => (
              <li key={e.row} className="text-xs text-red-600">
                <span className="font-medium">Row {e.row + 1}:</span>{' '}
                {Object.entries(e.issues).map(([f, msgs]) => `${f}: ${msgs.join(', ')}`).join(' | ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="json" className="label">JSON array (max 100 properties)</label>
          <textarea
            id="json"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            required
            rows={18}
            className="input font-mono text-xs resize-y"
            placeholder={TEMPLATE}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="btn-primary"
          >
            {status === 'submitting' ? 'Importing...' : 'Import properties'}
          </button>
          <button
            type="button"
            onClick={() => setJson(TEMPLATE)}
            className="btn-secondary"
          >
            Load example
          </button>
        </div>
      </form>
    </div>
  );
}

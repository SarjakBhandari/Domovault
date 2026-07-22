'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiJson, apiFetch } from '@/lib/api';
import { getCsrfToken } from '@/lib/csrf';
import { getAccessToken } from '@/lib/authToken';

type Property = {
  _id: string;
  title: string;
  description: string;
  city: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  rentPerMonth: number;
  amenities: string[];
  status: string;
  imageUrl?: string | null;
  imageStoredName?: string | null;
  qrCodeStoredName?: string | null;
};

type OtherBill = { label: string; amount: string };

type PaymentForm = {
  electricityCharge: string;
  waterBill: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankSortCode: string;
  otherBills: OtherBill[];
};

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

export default function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState<FormData | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    electricityCharge: '', waterBill: '', bankAccountName: '',
    bankAccountNumber: '', bankSortCode: '', otherBills: [],
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});

  const [imageUploading, setImageUploading] = useState(false);
  const [imageMsg, setImageMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrMsg, setQrMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!getAccessToken()) { setLoadStatus('error'); return; }
    apiJson<Property>(`/api/properties/${id}`)
      .then((p) => {
        setProperty(p);
        setForm({
          title: p.title,
          description: p.description,
          city: p.city,
          address: p.address,
          bedrooms: String(p.bedrooms),
          bathrooms: String(p.bathrooms),
          sizeSqft: String(p.sizeSqft),
          rentPerMonth: String(p.rentPerMonth),
          amenities: (p.amenities ?? []).join(', '),
        });
        setLoadStatus('ready');
      })
      .catch(() => setLoadStatus('error'));
  }, [id]);

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => f ? { ...f, [field]: e.target.value } : f);
    };
  }

  function validatePayment(): Record<string, string> {
    const errs: Record<string, string> = {};
    const el = paymentForm.electricityCharge;
    const wb = paymentForm.waterBill;
    const an = paymentForm.bankAccountNumber;
    const sc = paymentForm.bankSortCode;
    if (el && (isNaN(Number(el)) || Number(el) < 0 || Number(el) > 99999)) errs.electricityCharge = 'Must be a number between 0 and 99,999.';
    if (wb && (isNaN(Number(wb)) || Number(wb) < 0 || Number(wb) > 99999)) errs.waterBill = 'Must be a number between 0 and 99,999.';
    if (an && !/^\d{8}$/.test(an)) errs.bankAccountNumber = 'Must be exactly 8 digits.';
    if (sc && !/^\d{2}-\d{2}-\d{2}$/.test(sc)) errs.bankSortCode = 'Format: 12-34-56.';
    paymentForm.otherBills.forEach((b, i) => {
      if (!b.label.trim()) errs[`otherBill_label_${i}`] = 'Label required.';
      if (!b.amount || isNaN(Number(b.amount)) || Number(b.amount) < 0) errs[`otherBill_amount_${i}`] = 'Valid amount required.';
    });
    return errs;
  }

  async function handlePaymentSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validatePayment();
    if (Object.keys(errs).length > 0) { setPaymentErrors(errs); return; }
    setPaymentErrors({});
    setPaymentSaving(true);
    setPaymentMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (paymentForm.electricityCharge !== '') body.electricityCharge = Number(paymentForm.electricityCharge);
      if (paymentForm.waterBill !== '') body.waterBill = Number(paymentForm.waterBill);
      if (paymentForm.bankAccountName) body.bankAccountName = paymentForm.bankAccountName;
      if (paymentForm.bankAccountNumber) body.bankAccountNumber = paymentForm.bankAccountNumber;
      if (paymentForm.bankSortCode) body.bankSortCode = paymentForm.bankSortCode;
      if (paymentForm.otherBills.length > 0) {
        body.otherBills = paymentForm.otherBills.map((b) => ({ label: b.label.trim(), amount: Number(b.amount) }));
      }
      const res = await apiFetch(`/api/properties/${id}/payment-details`, { method: 'PATCH', body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPaymentMsg({ text: data?.error ?? 'Save failed.', ok: false });
      } else {
        setPaymentMsg({ text: 'Payment details saved.', ok: true });
      }
    } catch {
      setPaymentMsg({ text: 'Could not reach the server.', ok: false });
    } finally {
      setPaymentSaving(false);
    }
  }

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    setImageMsg(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await apiFetch(`/api/properties/${id}/upload-image`, { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setImageMsg({ text: data?.error ?? 'Upload failed.', ok: false });
      } else {
        setProperty((prev) => prev ? { ...prev, imageStoredName: 'updated' } : prev);
        setImageMsg({ text: 'Property image uploaded.', ok: true });
      }
    } catch {
      setImageMsg({ text: 'Could not upload image.', ok: false });
    } finally {
      setImageUploading(false);
    }
  }

  async function handleQrUpload(file: File) {
    setQrUploading(true);
    setQrMsg(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await apiFetch(`/api/properties/${id}/qr-code`, { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setQrMsg({ text: data?.error ?? 'Upload failed.', ok: false });
      } else {
        setQrMsg({ text: 'Payment QR code uploaded.', ok: true });
      }
    } catch {
      setQrMsg({ text: 'Could not upload QR code.', ok: false });
    } finally {
      setQrUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaveStatus('saving');
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
      const res = await apiFetch(`/api/properties/${id}`, {
        method: 'PATCH',
        headers: { 'x-csrf-token': csrf },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.details && typeof data.details === 'object') {
          setFieldErrors(data.details as Record<string, string[]>);
          setError('Please fix the errors below.');
        } else {
          setError(data?.error ?? 'Could not save changes.');
        }
        setSaveStatus('error');
        return;
      }

      router.push('/admin/properties');
    } catch {
      setError('Could not reach the server. Check your connection.');
      setSaveStatus('error');
    }
  }

  if (loadStatus === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-slate-100" />
          <div className="h-64 rounded-2xl bg-slate-100" />
          <div className="h-48 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (loadStatus === 'error' || !form) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-base font-semibold text-red-700">Could not load property.</p>
        <Link href="/admin/properties" className="btn-secondary mt-5 inline-flex justify-center">Back to properties</Link>
      </div>
    );
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
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Edit property</h1>
          <p className="mt-0.5 text-sm text-slate-500 truncate max-w-xs">{form.title}</p>
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
            <input id="title" type="text" value={form.title} onChange={set('title')} required minLength={3} maxLength={200} className={inputClass} />
            {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title.join(' ')}</p>}
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea id="description" value={form.description} onChange={set('description')} required minLength={10} maxLength={5000} rows={5} className="input resize-y" />
            {fieldErrors.description && <p className="mt-1 text-xs text-red-600">{fieldErrors.description.join(' ')}</p>}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={labelClass}>City</label>
              <input id="city" type="text" value={form.city} onChange={set('city')} required minLength={2} maxLength={100} className={inputClass} />
              {fieldErrors.city && <p className="mt-1 text-xs text-red-600">{fieldErrors.city.join(' ')}</p>}
            </div>
            <div>
              <label htmlFor="address" className={labelClass}>Address</label>
              <input id="address" type="text" value={form.address} onChange={set('address')} required minLength={5} maxLength={300} className={inputClass} />
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
              <input id="sizeSqft" type="number" value={form.sizeSqft} onChange={set('sizeSqft')} min={0} required className={inputClass} />
              {fieldErrors.sizeSqft && <p className="mt-1 text-xs text-red-600">{fieldErrors.sizeSqft.join(' ')}</p>}
            </div>
            <div>
              <label htmlFor="rentPerMonth" className={labelClass}>Rent / month (NPR)</label>
              <input id="rentPerMonth" type="number" value={form.rentPerMonth} onChange={set('rentPerMonth')} min={0} required className={inputClass} />
              {fieldErrors.rentPerMonth && <p className="mt-1 text-xs text-red-600">{fieldErrors.rentPerMonth.join(' ')}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="amenities" className={labelClass}>Amenities <span className="text-slate-400 font-normal">(comma-separated)</span></label>
            <input id="amenities" type="text" value={form.amenities} onChange={set('amenities')} maxLength={1000} placeholder="e.g. WiFi, Parking, Garden" className={inputClass} />
            <p className="mt-1 text-xs text-slate-400">Separate each item with a comma.</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/admin/properties" className="btn-secondary justify-center">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saveStatus === 'saving'}
            className="btn-primary justify-center"
          >
            {saveStatus === 'saving' ? (
              <>
                <svg className="animate-spin mr-2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Saving...
              </>
            ) : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Property image upload */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Property image</h2>
        {property?.imageStoredName && (
          <div className="relative h-40 w-full overflow-hidden rounded-xl bg-slate-100">
            <img src={`/api/properties/${id}/image`} alt="Property" className="h-full w-full object-cover" />
          </div>
        )}
        {!property?.imageStoredName && property?.imageUrl && (
          <div className="relative h-40 w-full overflow-hidden rounded-xl bg-slate-100">
            <img src={property.imageUrl} alt="Property" className="h-full w-full object-cover" />
          </div>
        )}
        <p className="text-xs text-slate-500">JPEG, PNG, or WebP. Max 10 MB.</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={imageUploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
          className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800 disabled:opacity-60 file:cursor-pointer"
        />
        {imageMsg && (
          <p className={`text-sm ${imageMsg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{imageMsg.text}</p>
        )}
      </div>

      {/* Payment details */}
      <form onSubmit={handlePaymentSave} className="card p-6 space-y-5" noValidate>
        <h2 className="text-sm font-semibold text-slate-900">Payment details</h2>
        <p className="text-xs text-slate-500">These details are shown to tenants on their billing page.</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Electricity charge (NPR/mo)</label>
            <input
              type="number"
              min={0}
              max={99999}
              step="0.01"
              value={paymentForm.electricityCharge}
              onChange={(e) => setPaymentForm((f) => ({ ...f, electricityCharge: e.target.value }))}
              placeholder="e.g. 80"
              className="input"
            />
            {paymentErrors.electricityCharge && <p className="mt-1 text-xs text-red-600">{paymentErrors.electricityCharge}</p>}
          </div>
          <div>
            <label className="label">Water bill (NPR/mo)</label>
            <input
              type="number"
              min={0}
              max={99999}
              step="0.01"
              value={paymentForm.waterBill}
              onChange={(e) => setPaymentForm((f) => ({ ...f, waterBill: e.target.value }))}
              placeholder="e.g. 30"
              className="input"
            />
            {paymentErrors.waterBill && <p className="mt-1 text-xs text-red-600">{paymentErrors.waterBill}</p>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label" style={{ marginBottom: 0 }}>Other bills</label>
            <button
              type="button"
              onClick={() => setPaymentForm((f) => ({ ...f, otherBills: [...f.otherBills, { label: '', amount: '' }] }))}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              + Add bill
            </button>
          </div>
          {paymentForm.otherBills.length === 0 && (
            <p className="text-xs text-slate-400">No other bills added.</p>
          )}
          {paymentForm.otherBills.map((bill, i) => (
            <div key={i} className="mb-3 flex items-start gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={bill.label}
                  onChange={(e) => setPaymentForm((f) => {
                    const next = [...f.otherBills];
                    next[i] = { ...next[i], label: e.target.value };
                    return { ...f, otherBills: next };
                  })}
                  placeholder="e.g. Council tax"
                  maxLength={100}
                  className="input"
                />
                {paymentErrors[`otherBill_label_${i}`] && <p className="mt-1 text-xs text-red-600">{paymentErrors[`otherBill_label_${i}`]}</p>}
              </div>
              <div className="w-28 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={99999}
                  step="0.01"
                  value={bill.amount}
                  onChange={(e) => setPaymentForm((f) => {
                    const next = [...f.otherBills];
                    next[i] = { ...next[i], amount: e.target.value };
                    return { ...f, otherBills: next };
                  })}
                  placeholder="NPR"
                  className="input"
                />
                {paymentErrors[`otherBill_amount_${i}`] && <p className="mt-1 text-xs text-red-600">{paymentErrors[`otherBill_amount_${i}`]}</p>}
              </div>
              <button
                type="button"
                onClick={() => setPaymentForm((f) => ({ ...f, otherBills: f.otherBills.filter((_, j) => j !== i) }))}
                className="mt-2.5 text-xs text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bank account (for QR code reference)</h3>
          <div>
            <label className="label">Account name</label>
            <input
              type="text"
              value={paymentForm.bankAccountName}
              onChange={(e) => setPaymentForm((f) => ({ ...f, bankAccountName: e.target.value }))}
              placeholder="e.g. J Smith Properties Ltd"
              maxLength={100}
              className="input"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Account number (8 digits)</label>
              <input
                type="text"
                inputMode="numeric"
                value={paymentForm.bankAccountNumber}
                onChange={(e) => setPaymentForm((f) => ({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                placeholder="12345678"
                maxLength={8}
                className="input font-mono"
              />
              {paymentErrors.bankAccountNumber && <p className="mt-1 text-xs text-red-600">{paymentErrors.bankAccountNumber}</p>}
            </div>
            <div>
              <label className="label">Sort code (format: 12-34-56)</label>
              <input
                type="text"
                value={paymentForm.bankSortCode}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d-]/g, '');
                  if (v.length === 2 && !v.includes('-')) v += '-';
                  if (v.length === 5 && v.indexOf('-', 3) === -1) v += '-';
                  setPaymentForm((f) => ({ ...f, bankSortCode: v.slice(0, 8) }));
                }}
                placeholder="12-34-56"
                maxLength={8}
                className="input font-mono"
              />
              {paymentErrors.bankSortCode && <p className="mt-1 text-xs text-red-600">{paymentErrors.bankSortCode}</p>}
            </div>
          </div>
        </div>

        {paymentMsg && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${paymentMsg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {paymentMsg.text}
          </div>
        )}

        <button type="submit" disabled={paymentSaving} className="btn-primary">
          {paymentSaving ? 'Saving...' : 'Save payment details'}
        </button>
      </form>

      {/* Payment QR code */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Payment QR code</h2>
        <p className="text-xs text-slate-500">
          Upload a QR code image (from your banking app or generated online) that tenants can scan to pay. JPEG or PNG, max 10 MB.
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={qrUploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleQrUpload(f); }}
          className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800 disabled:opacity-60 file:cursor-pointer"
        />
        {qrMsg && (
          <p className={`text-sm ${qrMsg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{qrMsg.text}</p>
        )}
      </div>
    </div>
  );
}

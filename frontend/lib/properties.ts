import type { Property } from './types';

function fromApiProperty(doc: Record<string, unknown>): Property {
  const pd = doc.paymentDetails as Record<string, unknown> | null | undefined;
  return {
    id: String(doc._id),
    title: String(doc.title),
    city: String(doc.city),
    address: String(doc.address),
    rentPerMonth: Number(doc.rentPerMonth),
    bedrooms: Number(doc.bedrooms),
    bathrooms: Number(doc.bathrooms),
    sizeSqft: Number(doc.sizeSqft),
    amenities: Array.isArray(doc.amenities) ? (doc.amenities as string[]) : [],
    description: String(doc.description),
    imageAlt: String(doc.title),
    imageUrl: typeof doc.imageUrl === 'string' ? doc.imageUrl : null,
    imageStoredName: typeof doc.imageStoredName === 'string' ? doc.imageStoredName : null,
    electricityCharge: typeof pd?.electricityCharge === 'number' ? pd.electricityCharge : null,
    available: doc.status === 'available',
  };
}

// Server components fetch directly from the backend origin; browser client
// components use a relative path that the Next.js rewrite proxy forwards.
function apiBase(): string {
  return typeof window === 'undefined'
    ? (process.env.BACKEND_ORIGIN ?? 'http://localhost:4000')
    : '';
}

export type PropertyFilters = {
  city?: string;
  maxRent?: number;
  bedrooms?: number;
  query?: string;
};

export async function getProperties(filters: PropertyFilters = {}): Promise<Property[]> {
  const body: Record<string, unknown> = {};
  if (filters.city) body.city = filters.city;
  if (typeof filters.maxRent === 'number') body.maxRent = filters.maxRent;
  if (typeof filters.bedrooms === 'number') body.bedrooms = filters.bedrooms;
  if (filters.query) body.query = filters.query;

  const res = await fetch(`${apiBase()}/api/properties/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Properties API error: ${res.status}`);
  const data = (await res.json()) as { items: Record<string, unknown>[] };
  return data.items.map(fromApiProperty);
}

export async function getFeaturedProperties(): Promise<Property[]> {
  try {
    const res = await fetch(`${apiBase()}/api/properties/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 3 }),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items: Record<string, unknown>[] };
    return data.items.map(fromApiProperty);
  } catch {
    return [];
  }
}

export async function getPropertyById(id: string): Promise<Property | null> {
  try {
    const res = await fetch(`${apiBase()}/api/properties/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const doc = (await res.json()) as Record<string, unknown>;
    return fromApiProperty(doc);
  } catch {
    return null;
  }
}

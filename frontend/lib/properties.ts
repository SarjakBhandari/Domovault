import type { Property } from './types';

// Static data is used as a graceful fallback when the backend API is not
// reachable (local development without a running server). In production the
// API calls below will succeed and this data is not used.
const MOCK_PROPERTIES: Property[] = [
  {
    id: 'p-001',
    title: 'Sunny 2-Bed Apartment near City Park',
    city: 'Manchester',
    address: '14 Birch Grove, Manchester',
    rentPerMonth: 1150,
    bedrooms: 2,
    bathrooms: 1,
    sizeSqft: 760,
    amenities: ['Washer/Dryer', 'Pet friendly', 'Balcony', 'Parking'],
    description:
      'A bright two-bedroom apartment with a south-facing balcony, recently refurbished kitchen, and a five-minute walk to City Park. Unfurnished, available for long-term let.',
    imageAlt: 'Living room with large windows and a wooden floor',
    available: true,
  },
  {
    id: 'p-002',
    title: 'Modern Studio in the Northern Quarter',
    city: 'Manchester',
    address: '3 Tib Street, Manchester',
    rentPerMonth: 825,
    bedrooms: 0,
    bathrooms: 1,
    sizeSqft: 410,
    amenities: ['Furnished', 'High-speed internet', 'Bike storage'],
    description:
      'Compact, fully furnished studio in the heart of the Northern Quarter. Walking distance to cafes, transit, and coworking spaces. Ideal for a single professional.',
    imageAlt: 'Compact studio apartment with a fold-out bed and desk',
    available: true,
  },
  {
    id: 'p-003',
    title: 'Family 3-Bed Terraced House',
    city: 'Leeds',
    address: '88 Hollin Lane, Leeds',
    rentPerMonth: 1450,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqft: 1100,
    amenities: ['Garden', 'Garage', 'Pet friendly', 'Dishwasher'],
    description:
      'Spacious three-bedroom terraced house with a private garden and garage. Close to good schools and local amenities. Available from next month.',
    imageAlt: 'Terraced house exterior with a small front garden',
    available: false,
  },
  {
    id: 'p-004',
    title: 'Riverside 1-Bed Flat',
    city: 'Leeds',
    address: '21 Wharf Approach, Leeds',
    rentPerMonth: 980,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqft: 540,
    amenities: ['Concierge', 'Gym access', 'River view'],
    description:
      'One-bedroom flat in a riverside development with concierge service and resident gym. Open-plan living area with floor-to-ceiling windows.',
    imageAlt: 'Modern flat interior overlooking a river',
    available: true,
  },
];

// Converts a backend API property document to the frontend Property type.
// The backend uses MongoDB _id; the frontend type uses id.
function fromApiProperty(doc: Record<string, unknown>): Property {
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
    available: doc.status === 'available',
  };
}

export type PropertyFilters = {
  city?: string;
  maxRent?: number;
  bedrooms?: number;
  query?: string;
};

export async function getProperties(filters: PropertyFilters = {}): Promise<Property[]> {
  const params = new URLSearchParams();
  if (filters.city) params.set('city', filters.city);
  if (typeof filters.maxRent === 'number') params.set('maxRent', String(filters.maxRent));
  if (typeof filters.bedrooms === 'number') params.set('bedrooms', String(filters.bedrooms));
  if (filters.query) params.set('query', filters.query);

  try {
    const res = await fetch(`/api/properties?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('API error');
    const data = (await res.json()) as { items: Record<string, unknown>[] };
    return data.items.map(fromApiProperty);
  } catch {
    // Fall back to mock data when the backend is unavailable (local dev).
    const results = MOCK_PROPERTIES.filter((p) => {
      if (filters.city && p.city.toLowerCase() !== filters.city.toLowerCase()) return false;
      if (typeof filters.maxRent === 'number' && p.rentPerMonth > filters.maxRent) return false;
      if (typeof filters.bedrooms === 'number' && p.bedrooms !== filters.bedrooms) return false;
      if (filters.query) {
        const haystack = `${p.title} ${p.city} ${p.address}`.toLowerCase();
        if (!haystack.includes(filters.query.toLowerCase())) return false;
      }
      return true;
    });
    return results;
  }
}

export async function getFeaturedProperties(): Promise<Property[]> {
  try {
    const res = await fetch('/api/properties?limit=3', { cache: 'no-store' });
    if (!res.ok) throw new Error('API error');
    const data = (await res.json()) as { items: Record<string, unknown>[] };
    return data.items.map(fromApiProperty);
  } catch {
    return MOCK_PROPERTIES.filter((p) => p.available).slice(0, 3);
  }
}

export async function getPropertyById(id: string): Promise<Property | null> {
  try {
    const res = await fetch(`/api/properties/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('API error');
    const doc = (await res.json()) as Record<string, unknown>;
    return fromApiProperty(doc);
  } catch {
    return MOCK_PROPERTIES.find((p) => p.id === id) ?? null;
  }
}

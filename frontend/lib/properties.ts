import type { Property } from './types';

const PROPERTIES: Property[] = [
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

function simulateNetworkDelay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export type PropertyFilters = {
  city?: string;
  maxRent?: number;
  bedrooms?: number;
  query?: string;
};

export async function getProperties(filters: PropertyFilters = {}): Promise<Property[]> {
  const results = PROPERTIES.filter((property) => {
    if (filters.city && property.city.toLowerCase() !== filters.city.toLowerCase()) {
      return false;
    }
    if (typeof filters.maxRent === 'number' && property.rentPerMonth > filters.maxRent) {
      return false;
    }
    if (typeof filters.bedrooms === 'number' && property.bedrooms !== filters.bedrooms) {
      return false;
    }
    if (filters.query) {
      const haystack = `${property.title} ${property.city} ${property.address}`.toLowerCase();
      if (!haystack.includes(filters.query.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  return simulateNetworkDelay(results);
}

export async function getFeaturedProperties(): Promise<Property[]> {
  return simulateNetworkDelay(PROPERTIES.filter((p) => p.available).slice(0, 3));
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const found = PROPERTIES.find((p) => p.id === id) ?? null;
  return simulateNetworkDelay(found);
}

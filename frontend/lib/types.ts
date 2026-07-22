export type Property = {
  id: string;
  title: string;
  city: string;
  address: string;
  rentPerMonth: number;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  amenities: string[];
  description: string;
  imageAlt: string;
  imageUrl?: string | null;
  imageStoredName?: string | null;
  electricityCharge?: number | null;
  available: boolean;
};

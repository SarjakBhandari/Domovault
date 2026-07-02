import Link from 'next/link';
import type { Property } from '@/lib/types';

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <li className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div
        role="img"
        aria-label={property.imageAlt}
        className="flex h-40 items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700"
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">
            <Link
              href={`/properties/${property.id}`}
              className="rounded-md hover:text-brand-700"
            >
              {property.title}
            </Link>
          </h3>
          {!property.available && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              Leased
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-slate-500">{property.city}</p>

        <p className="mt-3 text-lg font-bold text-brand-800">
          £{property.rentPerMonth.toLocaleString()}
          <span className="text-sm font-normal text-slate-500"> /month</span>
        </p>

        <dl className="mt-3 flex gap-4 text-sm text-slate-600">
          <div>
            <dt className="sr-only">Bedrooms</dt>
            <dd>
              {property.bedrooms === 0 ? 'Studio' : `${property.bedrooms} bed`}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Bathrooms</dt>
            <dd>{property.bathrooms} bath</dd>
          </div>
          <div>
            <dt className="sr-only">Size</dt>
            <dd>{property.sizeSqft} sqft</dd>
          </div>
        </dl>

        <Link
          href={`/properties/${property.id}`}
          className="mt-4 inline-block rounded-md px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          View details
          <span className="sr-only"> for {property.title}</span>
        </Link>
      </div>
    </li>
  );
}

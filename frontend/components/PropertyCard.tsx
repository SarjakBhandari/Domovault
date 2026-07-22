import Link from 'next/link';
import type { Property } from '@/lib/types';

function BedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4v16M2 8h20v12H2M7 8v4" />
      <rect x="11" y="8" width="8" height="4" rx="1" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <line x1="10" x2="8" y1="5" y2="7" />
      <line x1="2" x2="22" y1="12" y2="12" />
    </svg>
  );
}

function SqftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <li className="group card card-hover flex flex-col overflow-hidden">
      <Link
        href={`/properties/${property.id}`}
        className="relative block h-44 overflow-hidden bg-gradient-to-br from-brand-700 to-brand-900"
        tabIndex={-1}
        aria-hidden="true"
      >
        {property.imageStoredName ? (
          <img
            src={`/api/properties/${property.id}/image`}
            alt={property.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt={property.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
              <path d="M9 21V12h6v9" fill="white" />
            </svg>
          </div>
        )}
        {property.available ? (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            Available
          </span>
        ) : (
          <span className="absolute left-3 top-3 rounded-full bg-slate-700/80 px-2.5 py-1 text-xs font-semibold text-white">
            Leased
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div>
          <p className="text-xl font-bold text-brand-800">
            NPR{property.rentPerMonth.toLocaleString()}
            <span className="text-sm font-normal text-slate-500">/mo</span>
          </p>
          {property.electricityCharge != null && (
            <p className="mt-0.5 text-xs text-slate-500">
              + NPR{property.electricityCharge.toLocaleString()} electricity/mo
            </p>
          )}
          <h3 className="mt-1 text-sm font-semibold leading-snug text-slate-900">
            <Link
              href={`/properties/${property.id}`}
              className="transition-colors group-hover:text-brand-700"
            >
              {property.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {property.city}
          </p>
        </div>

        <dl className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <BedIcon />
            <dt className="sr-only">Bedrooms</dt>
            <dd>{property.bedrooms === 0 ? 'Studio' : `${property.bedrooms} bed`}</dd>
          </div>
          <div className="flex items-center gap-1">
            <BathIcon />
            <dt className="sr-only">Bathrooms</dt>
            <dd>{property.bathrooms} bath</dd>
          </div>
          <div className="flex items-center gap-1">
            <SqftIcon />
            <dt className="sr-only">Size</dt>
            <dd>{property.sizeSqft} sqft</dd>
          </div>
        </dl>

        <Link
          href={`/properties/${property.id}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          View details
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span className="sr-only"> for {property.title}</span>
        </Link>
      </div>
    </li>
  );
}

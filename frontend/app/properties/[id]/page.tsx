import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPropertyById } from '@/lib/properties';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const property = await getPropertyById(id);
  return { title: property ? property.title : 'Property not found' };
}

export default async function PropertyDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const property = await getPropertyById(id);

  if (!property) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/browse" className="hover:text-brand-700 transition-colors">
          Browse properties
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span aria-current="page" className="text-slate-700 font-medium truncate max-w-xs">{property.title}</span>
      </nav>

      {/* Image area */}
      <div
        className="relative mt-5 flex h-72 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 sm:h-80 lg:h-96"
      >
        {property.imageStoredName ? (
          <img
            src={`/api/properties/${property.id}/image`}
            alt={property.imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt={property.imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <svg
            width="120"
            height="120"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
            className="text-white/10"
            aria-hidden="true"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        )}
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${
            property.available
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-600 text-white'
          }`}
        >
          {property.available ? 'Available' : 'Leased'}
        </span>
      </div>

      {/* Title + price row */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {property.title}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {property.address}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-extrabold text-brand-700">
            NPR{property.rentPerMonth.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">per month</p>
          {property.electricityCharge != null && (
            <p className="mt-1 text-xs text-slate-500">
              + NPR{property.electricityCharge.toLocaleString()} electricity/mo
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Bedrooms', value: property.bedrooms === 0 ? 'Studio' : String(property.bedrooms) },
          { label: 'Bathrooms', value: String(property.bathrooms) },
          { label: 'Size', value: `${property.sizeSqft} sqft` },
          { label: 'City', value: property.city },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Description */}
      {property.description && (
        <section aria-labelledby="description-heading" className="mt-8">
          <h2 id="description-heading" className="text-base font-semibold text-slate-900">
            About this property
          </h2>
          <p className="mt-2.5 leading-relaxed text-slate-600 text-sm">{property.description}</p>
        </section>
      )}

      {/* Amenities */}
      {property.amenities.length > 0 && (
        <section aria-labelledby="amenities-heading" className="mt-8">
          <h2 id="amenities-heading" className="text-base font-semibold text-slate-900">
            Amenities
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {property.amenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
              >
                {amenity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CTA */}
      <div className="mt-10 border-t border-slate-200 pt-8">
        {property.available ? (
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/apply/${property.id}`}
              className="btn-primary inline-flex items-center gap-2"
            >
              Apply for this property
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/register"
              className="text-sm text-slate-500 hover:text-brand-700 transition-colors"
            >
              No account yet? Register first
            </Link>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <p className="text-sm text-slate-600">This property is not currently accepting applications.</p>
          </div>
        )}
      </div>
    </div>
  );
}

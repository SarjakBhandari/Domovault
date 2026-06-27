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
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/browse" className="rounded-md hover:text-brand-700">
          Browse properties
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{property.title}</span>
      </nav>

      <div
        role="img"
        aria-label={property.imageAlt}
        className="mt-4 flex h-72 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700"
      />

      <div className="mt-6 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{property.title}</h1>
          <p className="mt-1 text-slate-500">{property.address}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
            property.available
              ? 'bg-brand-100 text-brand-800'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {property.available ? 'Available' : 'Currently leased'}
        </span>
      </div>

      <p className="mt-4 text-2xl font-bold text-brand-800">
        £{property.rentPerMonth.toLocaleString()}
        <span className="text-base font-normal text-slate-500"> /month</span>
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Bedrooms</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">
            {property.bedrooms === 0 ? 'Studio' : property.bedrooms}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Bathrooms</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{property.bathrooms}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Size</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">
            {property.sizeSqft} sqft
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">City</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{property.city}</dd>
        </div>
      </dl>

      <section aria-labelledby="description-heading" className="mt-8">
        <h2 id="description-heading" className="text-lg font-semibold text-slate-900">
          Description
        </h2>
        <p className="mt-2 leading-relaxed text-slate-700">{property.description}</p>
      </section>

      <section aria-labelledby="amenities-heading" className="mt-8">
        <h2 id="amenities-heading" className="text-lg font-semibold text-slate-900">
          Amenities
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {property.amenities.map((amenity) => (
            <li
              key={amenity}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {amenity}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 border-t border-slate-200 pt-6">
        {property.available ? (
          <Link
            href="/register"
            className="inline-block rounded-md bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
          >
            Sign up to apply
          </Link>
        ) : (
          <p className="text-sm text-slate-500">
            This property is not currently accepting applications.
          </p>
        )}
      </div>
    </div>
  );
}

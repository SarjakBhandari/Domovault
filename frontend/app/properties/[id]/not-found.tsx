import Link from 'next/link';

export default function PropertyNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Property not found</h1>
      <p className="mt-3 text-slate-600">
        This listing may have been let or removed. Browse the current catalogue instead.
      </p>
      <Link
        href="/browse"
        className="mt-6 inline-block rounded-md bg-brand-700 px-6 py-3 font-semibold text-white hover:bg-brand-800"
      >
        Browse properties
      </Link>
    </div>
  );
}

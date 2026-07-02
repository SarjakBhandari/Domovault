import PropertyCardSkeleton from '@/components/PropertyCardSkeleton';

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto h-10 w-2/3 max-w-md animate-pulse rounded bg-slate-200" />
      <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <PropertyCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

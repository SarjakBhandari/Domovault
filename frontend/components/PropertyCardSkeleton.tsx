export default function PropertyCardSkeleton() {
  return (
    <li aria-hidden="true" className="card overflow-hidden">
      <div className="h-44 shimmer" />
      <div className="p-5 space-y-3">
        <div className="h-5 w-2/5 shimmer rounded-md" />
        <div className="h-4 w-3/4 shimmer rounded-md" />
        <div className="h-3 w-1/3 shimmer rounded-md" />
        <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3">
          <div className="h-3 w-12 shimmer rounded-md" />
          <div className="h-3 w-12 shimmer rounded-md" />
          <div className="h-3 w-16 shimmer rounded-md" />
        </div>
      </div>
    </li>
  );
}

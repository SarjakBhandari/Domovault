export default function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"
    >
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

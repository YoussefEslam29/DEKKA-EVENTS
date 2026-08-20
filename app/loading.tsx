export default function Loading() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 md:px-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-[4px] bg-line" />
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[4px] bg-line/60" />
        ))}
      </div>
    </div>
  );
}

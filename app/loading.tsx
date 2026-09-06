export default function Loading() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 md:px-8">
      <div className="mb-6 h-8 w-48 rounded-xl bg-border-dark motion-safe:animate-pulse" />
      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-border-dark/60 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}

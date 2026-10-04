export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="animate-pulse space-y-6"
    >
      <div className="h-8 w-56 rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-muted" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

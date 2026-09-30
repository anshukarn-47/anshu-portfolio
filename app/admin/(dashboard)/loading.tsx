/**
 * Shown inside the admin layout while a page loads its data: admin pages are
 * rendered per request and the database round trip takes a few seconds, so
 * this replaces a frozen previous page. Same outline as a list page.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className="h-7 w-48 rounded bg-panel-2" />
      <div className="mt-2 h-4 w-24 rounded bg-panel" />
      <div className="mt-8 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 rounded-md border border-rule bg-panel" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

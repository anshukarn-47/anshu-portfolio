"use client";

import Link from "next/link";

/**
 * The site's own error page for anything a page throws (e.g. the database is
 * unreachable). Only generic wording and the opaque digest are shown; the real
 * error stays in the server log, where the digest finds it.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-wider text-signal-red">Error</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">Something went wrong</h1>
      <p className="mt-4 text-text-dim">This page couldn&apos;t be loaded. Please try again in a moment.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
          Try again
        </button>
        <Link href="/" className="inline-flex h-10 items-center rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel">
          Go to the homepage
        </Link>
      </div>
      {error.digest && <p className="mt-8 font-mono text-xs text-text-faint">Reference: {error.digest}</p>}
    </main>
  );
}

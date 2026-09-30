"use client";

import "./globals.css";

/**
 * Last-resort error page, for failures in the root layout itself (it replaces
 * the layout, so it brings its own <html> and styles). Same generic wording as
 * app/error.tsx: the real error stays in the server log.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
          <h1 className="text-3xl">Something went wrong</h1>
          <p className="mt-4 text-text-dim">The site couldn&apos;t be loaded. Please try again in a moment.</p>
          <button type="button" onClick={reset} className="mt-8 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink">
            Try again
          </button>
          {error.digest && <p className="mt-8 font-mono text-xs text-text-faint">Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}

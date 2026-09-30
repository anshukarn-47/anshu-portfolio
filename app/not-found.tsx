import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/** The site's own 404, for unknown URLs and missing case studies or prototypes. */
export default function NotFound() {
  const links = [
    { href: "/work", label: "Case studies", note: "The problem, the decisions, the outcome" },
    { href: "/prototype-lab", label: "Prototype lab", note: "Interactive product decisions" },
    { href: "/ai-lab", label: "Ask the AI lab", note: "Questions answered from the portfolio" },
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-wider text-signal-blue">404</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">Page not found</h1>
      <p className="mt-4 max-w-prose text-text-dim">
        That page doesn&apos;t exist, or it has moved. Start from the homepage, or pick up one of these:
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex h-full flex-col rounded-lg border border-rule bg-panel p-4 transition-colors hover:bg-panel-2">
              <span className="text-sm font-medium text-text">{l.label} →</span>
              <span className="mt-1 text-xs text-text-dim">{l.note}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/" className="mt-8 inline-flex h-10 items-center rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
        Go to the homepage
      </Link>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ARCADE } from "@/lib/arcade/registry";
import { ArcadeCard } from "@/components/arcade/arcade-card";
import { pageMetadata } from "@/lib/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Arcade",
    description: "Quick games, 60 to 120 seconds each, that put you in one of my product decisions.",
    path: "/arcade",
  });
}

export default function ArcadePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-wider text-text-faint">Arcade</p>
      <h1 className="mt-2 max-w-3xl text-4xl sm:text-5xl">Don&apos;t just read about my decisions. Play them.</h1>
      <p className="mt-4 max-w-prose text-lg text-text-dim">
        Quick games, each built on one decision from my work. Every run ends with the real case behind it.
      </p>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ARCADE.map((g) => (
          <li key={g.slug}>
            <ArcadeCard game={g} />
          </li>
        ))}
      </ul>

      <Link
        href="/prototype-lab"
        className="mt-10 flex flex-col rounded-lg border border-rule bg-panel p-4 transition-colors hover:bg-panel-2 sm:inline-flex"
      >
        <span className="text-sm font-medium text-text">Longer decision simulations →</span>
        <span className="mt-1 text-xs text-text-dim">The Prototype lab</span>
      </Link>
    </main>
  );
}

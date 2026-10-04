import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArcadeEntry, PUBLISHED_GAMES } from "@/lib/arcade/registry";
import { loadArcadeCases } from "@/lib/arcade/case-study";
import { ArcadeGame } from "@/components/arcade/arcade-game";
import { pageMetadata } from "@/lib/site";

// Cached; the real case comes from Supabase. This is a fallback.
export const revalidate = 3600;
// Only published games have pages.
export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLISHED_GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const entry = getArcadeEntry(slug);
  if (!entry || entry.status !== "published") return { title: "Game not found", robots: { index: false } };
  return pageMetadata({ title: `${entry.title} · Arcade`, description: entry.hook, path: `/arcade/${slug}` });
}

export default async function ArcadeGamePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const entry = getArcadeEntry(slug);
  if (!entry || entry.status !== "published") notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Link href="/arcade" className="text-sm text-text-dim hover:text-text">
        ← Arcade
      </Link>
      <header className="mt-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-faint">
          {entry.mechanic} · {entry.duration}
        </p>
        <h1 className="mt-2 text-4xl">{entry.title}</h1>
        <p className="mt-3 max-w-prose text-lg text-text-dim">{entry.hook}</p>
      </header>
      <div className="mt-8">
        <ArcadeGame slug={entry.slug} cases={await loadArcadeCases(entry)} />
      </div>
    </main>
  );
}

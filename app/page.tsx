import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/profile";
import { PREVIEW_IMAGE, SITE_ROLE, siteName } from "@/lib/site";
import { getPublishedWork } from "@/lib/work";
import { getHeroMetrics } from "@/lib/highlights";
import { HeroMetrics } from "@/components/home/hero-metrics";
import { WorkGrid } from "@/components/work/work-grid";

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

/** The home page keeps the layout's full title ("Name | Role") and is the canonical root. */
export async function generateMetadata(): Promise<Metadata> {
  const name = await siteName();
  const title = `${name} | ${SITE_ROLE}`;
  const description = `Case studies, skills and an AI assistant for ${name}'s product work.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: name, url: "/", title, description, images: [PREVIEW_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [PREVIEW_IMAGE.url] },
  };
}

/** First paragraph of the bio (the part before any markdown heading or list). */
function intro(bio: string | null | undefined): string | null {
  const first = bio?.split(/\n{2,}/).find((p) => p.trim() && !/^[#*-]/.test(p.trim()));
  return first?.trim() ?? null;
}

export default async function HomePage() {
  const [profile, work, metrics] = await Promise.all([getProfile(), getPublishedWork(), getHeroMetrics()]);
  const selected = work.filter((w) => w.featured).slice(0, 4);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <section aria-labelledby="hero-title" className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[55fr_45fr] lg:items-center lg:gap-14">
        <div>
          <h1 id="hero-title" className="max-w-[20ch] text-4xl sm:text-5xl">
            {profile?.headline ?? profile?.full_name ?? "Product portfolio"}
          </h1>
          {intro(profile?.bio) && <p className="mt-5 max-w-prose text-lg text-text-dim">{intro(profile?.bio)}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/work" className="rounded-md bg-text px-4 py-2 text-sm font-medium text-ink transition-opacity hover:opacity-90">
              See case studies
            </Link>
            <Link href="/ai-lab" className="rounded-md border border-rule px-4 py-2 text-sm text-text transition-colors hover:bg-panel">
              Ask the AI lab
            </Link>
          </div>
        </div>
        {metrics.length > 0 && <HeroMetrics metrics={metrics} />}
      </section>

      {selected.length > 0 && (
        <section aria-labelledby="selected-title" className="border-t border-rule pt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="selected-title" className="text-2xl">
              Selected work
            </h2>
            <Link href="/work" className="text-sm text-text-dim hover:text-text">
              All case studies →
            </Link>
          </div>
          <WorkGrid work={selected} className="mt-6 grid gap-4 md:grid-cols-2" />
        </section>
      )}
    </main>
  );
}

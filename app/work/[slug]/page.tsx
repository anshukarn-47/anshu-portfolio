import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedWork, getWorkBySlug } from "@/lib/work";
import { WorkDetailView } from "@/components/work/work-detail";
import { pageMetadata } from "@/lib/site";

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export async function generateStaticParams() {
  const work = await getPublishedWork();
  return work.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const work = await getWorkBySlug(slug);
  if (!work) return { title: "Case study not found", robots: { index: false } };
  return pageMetadata({ title: work.title, description: work.summary ?? work.subtitle, path: `/work/${work.slug}` });
}

/**
 * Full-page case study: direct visits, refreshes and shared links. Clicking a
 * card on the homepage or /work expands it in place instead (WorkGrid), with
 * the URL updated to this route.
 */
export default async function WorkDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const [work, all] = await Promise.all([getWorkBySlug(slug), getPublishedWork()]);
  if (!work) notFound();

  const index = all.findIndex((w) => w.slug === work.slug);
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Link href="/work" className="text-sm text-text-dim hover:text-text">
        ← All case studies
      </Link>
      <div className="mt-8">
        <WorkDetailView work={work} prev={index > 0 ? all[index - 1] : null} next={index >= 0 ? all[index + 1] ?? null : null} />
      </div>
    </main>
  );
}

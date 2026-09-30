import type { Metadata } from "next";
import { getSkillsByCategory } from "@/lib/skills";
import { getPublishedWork } from "@/lib/work";
import { EmptyState, PageIntro } from "@/components/ui/page-intro";
import { HashHighlight } from "@/components/ui/hash-highlight";
import { SkillsExplorer } from "@/components/skills/skills-explorer";
import { pageMetadata } from "@/lib/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Skills",
    description: "Skills, and the work and certifications behind each one.",
    path: "/skills",
  });
}

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export default async function SkillsPage() {
  const [categories, work] = await Promise.all([getSkillsByCategory(), getPublishedWork()]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <HashHighlight />
      <PageIntro title="Skills">Each skill links to the work and certifications behind it.</PageIntro>

      {categories.length === 0 ? (
        <EmptyState>Skills are on their way.</EmptyState>
      ) : (
        <SkillsExplorer categories={categories} work={work.map(({ slug, title, category }) => ({ slug, title, category }))} />
      )}
    </main>
  );
}

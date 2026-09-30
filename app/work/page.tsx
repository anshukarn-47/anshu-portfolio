import type { Metadata } from "next";
import { getPublishedWork } from "@/lib/work";
import { WorkGrid } from "@/components/work/work-grid";
import { EmptyState, PageIntro } from "@/components/ui/page-intro";
import { pageMetadata } from "@/lib/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Work",
    description: "Case studies: the problem, the people, the decisions and the outcome.",
    path: "/work",
  });
}

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export default async function WorkIndexPage() {
  const work = await getPublishedWork();

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageIntro title="Case studies">The problem, the people, the decisions and the outcome, for each product.</PageIntro>

      {work.length === 0 ? (
        <EmptyState>Case studies are on their way.</EmptyState>
      ) : (
        <WorkGrid work={work} className="mt-10 grid gap-4 md:grid-cols-2" />
      )}
    </main>
  );
}

import type { Metadata } from "next";
import { getAchievements } from "@/lib/achievements";
import { EmptyState, PageIntro } from "@/components/ui/page-intro";
import { AchievementsBrowser } from "@/components/achievements/achievements-browser";
import { pageMetadata } from "@/lib/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Achievements",
    description: "Measurable impact, awards and milestones.",
    path: "/achievements",
  });
}

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export default async function AchievementsPage() {
  const achievements = await getAchievements();

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageIntro title="Achievements">Measurable impact, with a link to the case study behind each number.</PageIntro>
      {achievements.length === 0 ? <EmptyState>Achievements are on their way.</EmptyState> : <AchievementsBrowser achievements={achievements} />}
    </main>
  );
}

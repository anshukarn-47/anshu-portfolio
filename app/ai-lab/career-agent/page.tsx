import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/profile";
import { aiLabConfigured } from "@/lib/rag/answer";
import { getIndexStatus } from "@/lib/rag/ingest";
import { EmptyState } from "@/components/ui/page-intro";
import { StatusPill } from "@/components/ui/status-pill";
import { CareerAgent } from "@/components/agent/career-agent";
import { ExploreCaseStudies } from "@/components/rag/explore-case-studies";
import { AI_MESSAGES } from "@/lib/ai/messages";
import { pageMetadata } from "@/lib/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Career agent",
    description: "Paste a job description and see how the portfolio's evidence maps to each requirement.",
    path: "/ai-lab/career-agent",
  });
}

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export default async function CareerAgentPage() {
  const configured = aiLabConfigured();
  const [profile, index] = await Promise.all([getProfile(), configured ? getIndexStatus() : null]);
  const name = profile?.full_name.split(" ")[0] ?? "the author";
  const ready = configured && (index?.documents ?? 0) > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm text-text-faint">
        <Link href="/ai-lab" className="rounded-md hover:text-text">
          AI lab
        </Link>{" "}
        / Career agent
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-4xl sm:text-5xl">Career agent</h1>
        {ready ? (
          <StatusPill tone="live">ready</StatusPill>
        ) : configured ? (
          <StatusPill tone="alert">no content indexed</StatusPill>
        ) : (
          <StatusPill tone="idle">offline</StatusPill>
        )}
      </div>
      <p className="mt-4 max-w-prose text-lg text-text-dim">
        Hiring for a role? Paste the job description and the agent maps each requirement to evidence from {name}&apos;s
        case studies, skills and certifications, and says plainly where there isn&apos;t any.
      </p>

      {configured ? (
        <>
          <CareerAgent />
          <p className="mt-3 max-w-prose text-xs text-text-faint">
            AI analysis can be wrong; the linked pages are the source of truth. Job descriptions are stored anonymously to
            improve the agent.
          </p>
        </>
      ) : (
        <EmptyState>
          {AI_MESSAGES.unavailable}
          <ExploreCaseStudies />
        </EmptyState>
      )}

      <section className="mt-14 max-w-3xl" aria-labelledby="how-title">
        <h2 id="how-title" className="text-xl">
          How it works
        </h2>
        <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-5 text-sm text-text-dim">
          <li>The pasted text is cleaned up and checked.</li>
          <li>Claude extracts the role&apos;s distinct requirements, marking each as required or nice to have.</li>
          <li>Each requirement is embedded with Voyage AI and matched against the portfolio in Postgres (pgvector).</li>
          <li>Claude maps the matches to each requirement, citing the pages it used.</li>
        </ol>
        <p className="mt-3 max-w-prose text-sm text-text-dim">The activity checklist ticks off each step as the server finishes it.</p>
      </section>
    </main>
  );
}

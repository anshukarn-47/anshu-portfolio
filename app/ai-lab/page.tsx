import type { Metadata } from "next";
import Link from "next/link";
import { getProfile } from "@/lib/profile";
import { aiLabConfigured } from "@/lib/rag/answer";
import { getIndexStatus } from "@/lib/rag/ingest";
import { EmptyState } from "@/components/ui/page-intro";
import { StatusPill } from "@/components/ui/status-pill";
import { Chat } from "@/components/rag/chat";
import { ExploreCaseStudies } from "@/components/rag/explore-case-studies";
import { AI_MESSAGES } from "@/lib/ai/messages";
import { pageMetadata } from "@/lib/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "AI lab",
    description: "Ask questions about this portfolio. Answers come from the site's own content.",
    path: "/ai-lab",
  });
}

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export default async function AiLabPage() {
  const configured = aiLabConfigured();
  const [profile, index] = await Promise.all([getProfile(), configured ? getIndexStatus() : null]);
  const name = profile?.full_name.split(" ")[0] ?? "the author";
  const ready = configured && (index?.documents ?? 0) > 0;

  const suggestions = [
    `What kind of work has ${name} done?`,
    `Which projects use AI?`,
    `What are ${name}'s strongest skills?`,
    `What certifications does ${name} hold?`,
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl sm:text-5xl">Ask {name}</h1>
          {/* Assistant readiness: live when answering is possible; amber only for a real problem. */}
          {ready ? (
            <StatusPill tone="live">ready</StatusPill>
          ) : configured ? (
            <StatusPill tone="alert">no content indexed</StatusPill>
          ) : (
            <StatusPill tone="idle">offline</StatusPill>
          )}
        </div>
        <p className="mt-4 max-w-prose text-lg text-text-dim">
          Ask anything about this portfolio. Claude answers from the site&apos;s own case studies, skills and projects, and links
          the pages it used.
        </p>
        <p className="mt-2 max-w-prose text-sm text-text-dim">
          Hiring?{" "}
          <Link href="/ai-lab/career-agent" className="text-text underline decoration-rule underline-offset-4 hover:decoration-signal-teal">
            Map a job description to {name}&apos;s portfolio
          </Link>{" "}
          with the career agent.
        </p>

        {configured ? (
          <>
            <Chat suggestions={suggestions} />
            <p className="mt-3 max-w-prose text-xs text-text-faint">
              AI answers can be wrong; the linked pages are the source of truth. Questions are stored anonymously to improve the
              assistant.
            </p>
          </>
        ) : (
          <EmptyState>
            {AI_MESSAGES.unavailable}
            <ExploreCaseStudies />
          </EmptyState>
        )}

        <section className="mt-14" aria-labelledby="how-title">
          <h2 id="how-title" className="text-xl">
            How it works
          </h2>
          <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-5 text-sm text-text-dim">
            <li>Published content on this site is split into passages and embedded with Voyage AI.</li>
            <li>Your question is embedded the same way and matched against those passages in Postgres (pgvector).</li>
            <li>The closest passages go to Claude, which answers from them and cites the pages it used.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}

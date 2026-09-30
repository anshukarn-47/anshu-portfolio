import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrototypeBySlug, getPublishedPrototypes } from "@/lib/prototypes";
import { getPrototypeEntry, PROTOTYPES } from "@/lib/prototypes/registry";
import { getWorkBySlug } from "@/lib/work";
import { formatMetric, isSafeSrc } from "@/lib/format";
import { PrototypeViewer } from "@/components/prototypes/engine/prototype-viewer";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";
import { Markdown } from "@/components/ui/markdown";
import { StageBadge } from "@/components/prototypes/stage-badge";
import { pageMetadata } from "@/lib/site";

// Cached; saving in /admin revalidates immediately. This is a fallback.
export const revalidate = 3600;

export async function generateStaticParams() {
  const prototypes = await getPublishedPrototypes();
  return [...PROTOTYPES.map((p) => ({ slug: p.slug })), ...prototypes.map((p) => ({ slug: p.slug }))];
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const entry = getPrototypeEntry(params.slug);
  const path = `/prototype-lab/${params.slug}`;
  if (entry) return pageMetadata({ title: `${entry.title} · Prototype lab`, description: entry.hook, path });
  const p = await getPrototypeBySlug(params.slug);
  if (!p) return { title: "Prototype not found", robots: { index: false } };
  return pageMetadata({ title: `${p.title} · Prototype lab`, description: p.summary, path });
}

/** Embeds must be external https pages (enforced in admin too); never frame our own origin. */
function embedSrc(url: string | null): string | null {
  return url && /^https:\/\/\S+$/.test(url) ? url : null;
}

/** The related work entry, trimmed to plain data for Case study mode. */
async function loadCaseStudy(slug: string | null): Promise<PrototypeCaseStudy | null> {
  const w = slug ? await getWorkBySlug(slug) : null;
  if (!w) return null;
  const text = (s: string | null | undefined) => s?.trim() || null;
  return {
    slug: w.slug,
    title: w.title,
    problem: text(w.problem),
    role: text(w.role),
    company: text(w.company),
    users: text(w.users),
    approach: text(w.approach),
    constraints: w.decisions.map((d) => text(d.context)).filter((c): c is string => !!c),
    decisions: w.decisions.map((d) => ({ title: text(d.title), choice: text(d.choice), tradeoffs: text(d.tradeoffs) })),
    architecture: {
      summary: text(w.architecture.summary),
      components: (w.architecture.components ?? [])
        .filter((c) => text(c.name))
        .map((c) => ({ name: c.name!.trim(), description: text(c.description) })),
    },
    outcome: text(w.outcome),
    metrics: w.metrics
      .map((m) => ({ label: m.label ?? "", value: formatMetric(m.value, m.unit), context: text(m.context) }))
      .filter((m) => m.label),
  };
}

export default async function PrototypePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // Interactive prototypes from the registry run in the shared viewer.
  const entry = getPrototypeEntry(params.slug);
  if (entry) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <PrototypeViewer prototype={entry} caseStudy={await loadCaseStudy(entry.relatedWorkSlug)} />
      </main>
    );
  }

  const p = await getPrototypeBySlug(params.slug);
  if (!p) notFound();

  const embed = embedSrc(p.embed_url);
  const demo = isSafeSrc(p.demo_url) ? p.demo_url : null;
  const repo = p.repo_url && /^https?:\/\//.test(p.repo_url) ? p.repo_url : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Link href="/prototype-lab" className="text-sm text-text-dim hover:text-text">
        ← Prototype lab
      </Link>

      <header className="mt-8">
        <StageBadge stage={p.stage} />
        <h1 className="mt-3 text-4xl sm:text-5xl">{p.title}</h1>
        {p.summary && <p className="mt-4 max-w-prose text-lg text-text-dim">{p.summary}</p>}

        {(demo || repo) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {demo && (
              <a
                href={demo}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-text px-4 py-2 text-sm font-medium text-ink transition-opacity hover:opacity-90"
              >
                Open demo ↗
              </a>
            )}
            {repo && (
              <a
                href={repo}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-rule px-4 py-2 text-sm text-text transition-colors hover:bg-panel"
              >
                Source code ↗
              </a>
            )}
          </div>
        )}
      </header>

      {embed ? (
        <figure className="mt-10">
          <div className="overflow-hidden rounded-lg border border-rule bg-panel">
            <iframe
              src={embed}
              title={`${p.title} demo`}
              className="aspect-video w-full"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allow="fullscreen; clipboard-write"
            />
          </div>
          <figcaption className="mt-2 text-xs text-text-faint">
            Interactive demo.{" "}
            <a href={embed} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Open it in a new tab
            </a>{" "}
            if it doesn&apos;t load.
          </figcaption>
        </figure>
      ) : (
        isSafeSrc(p.thumbnail_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.thumbnail_url}
            alt={`${p.title} screenshot`}
            className="mt-10 w-full rounded-lg border border-rule"
          />
        )
      )}

      <div className="mt-12 grid gap-12 md:grid-cols-[1fr_14rem]">
        <div>{p.description && <Markdown headingLevel={2}>{p.description}</Markdown>}</div>
        {p.tech_stack.length > 0 && (
          <aside aria-labelledby="stack-title">
            <h2 id="stack-title" className="text-sm font-sans font-normal text-text-faint">
              Built with
            </h2>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {p.tech_stack.map((t) => (
                <li key={t} className="rounded border border-rule px-1.5 py-0.5 text-xs text-text-dim">
                  {t}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";
import type { WorkDetail, WorkSummary } from "@/lib/work";
import { formatMetric } from "@/lib/format";
import { Markdown } from "@/components/ui/markdown";

/**
 * The body of a case study, shared by the full page (/work/[slug]) and the
 * expanded overlay that a card morphs into. `titleAs` lets the overlay use an
 * h2 (the page underneath already has an h1).
 */
export function WorkDetailView({
  work,
  prev,
  next,
  titleAs: Title = "h1",
  titleId,
}: {
  work: WorkDetail;
  prev: WorkSummary | null;
  next: WorkSummary | null;
  titleAs?: "h1" | "h2";
  titleId?: string;
}) {
  const facts = [
    { label: "Role", value: work.role },
    { label: "Company", value: work.company },
    { label: "Year", value: work.year?.toString(), mono: true },
    { label: "Category", value: work.category },
  ].filter((f): f is { label: string; value: string; mono?: boolean } => !!f.value);

  return (
    <>
      <header>
        <Title id={titleId} className="max-w-[24ch] text-4xl sm:text-5xl">
          {work.title}
        </Title>
        {work.subtitle && <p className="mt-3 text-xl text-text-dim">{work.subtitle}</p>}
        {work.summary && <p className="mt-6 max-w-prose text-lg text-text">{work.summary}</p>}
        {facts.length > 0 && (
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-rule py-5 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-sm text-text-faint">{f.label}</dt>
                <dd className={`mt-0.5 text-sm text-text ${f.mono ? "font-mono tabular-nums" : ""}`}>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {work.metrics.length > 0 && (
        <section aria-label="Results" className="mt-10">
          <dl className={`grid gap-3 ${work.metrics.length % 3 === 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {work.metrics.map((m, i) => (
              <div key={i} className="rounded-lg border border-rule bg-panel p-4">
                <dt className="text-sm text-text-faint">{m.label}</dt>
                <dd className="mt-1 font-mono text-3xl font-medium tabular-nums text-text">{formatMetric(m.value, m.unit)}</dd>
                {m.context && <dd className="mt-1 text-sm text-text-dim">{m.context}</dd>}
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mt-14 space-y-12">
        <MarkdownSection title="The problem" body={work.problem} />
        <MarkdownSection title="Who it was for" body={work.users} />
        <MarkdownSection title="Approach" body={work.approach} />
        <Decisions decisions={work.decisions} />
        <ArchitectureSection architecture={work.architecture} />
        <MarkdownSection title="Outcome" body={work.outcome} />

        {work.skills.length > 0 && (
          <section>
            <SectionTitle>Skills</SectionTitle>
            <ul className="mt-4 flex flex-wrap gap-2">
              {work.skills.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/skills#${s.slug}`}
                    className="block rounded-full border border-rule px-3 py-1 text-sm text-text-dim transition-colors hover:border-text-faint hover:text-text"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {(prev || next) && (
        <nav aria-label="More work" className="mt-16 grid gap-4 border-t border-rule pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/work/${prev.slug}`} className="group rounded-md">
              <span className="text-sm text-text-faint">← Previous</span>
              <span className="mt-1 block font-medium text-text group-hover:underline">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/work/${next.slug}`} className="group rounded-md sm:text-right">
              <span className="text-sm text-text-faint">Next →</span>
              <span className="mt-1 block font-medium text-text group-hover:underline">{next.title}</span>
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl">{children}</h2>;
}

function MarkdownSection({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <Markdown className="mt-3">{body}</Markdown>
    </section>
  );
}

function Decisions({ decisions }: { decisions: WorkDetail["decisions"] }) {
  if (!decisions.length) return null;
  return (
    <section>
      <SectionTitle>Key decisions</SectionTitle>
      <ol className="mt-5 space-y-4">
        {decisions.map((d, i) => (
          <li key={i} className="rounded-lg border border-rule bg-panel p-5">
            <h3 className="flex gap-3 text-lg">
              <span className="text-text-faint">{i + 1}.</span>
              {d.title ?? `Decision ${i + 1}`}
            </h3>
            <dl className="mt-3 max-w-prose space-y-3 text-sm">
              {d.context && <DecisionPart label="Context" text={d.context} />}
              {d.choice && <DecisionPart label="What we chose" text={d.choice} />}
              {d.tradeoffs && <DecisionPart label="Trade-offs" text={d.tradeoffs} />}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DecisionPart({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <dt className="text-text-faint">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-text-dim">{text}</dd>
    </div>
  );
}

function ArchitectureSection({ architecture }: { architecture: WorkDetail["architecture"] }) {
  const components = (architecture.components ?? []).filter((c) => c.name || c.description);
  if (!architecture.summary && !architecture.diagram_url && !components.length) return null;

  return (
    <section>
      <SectionTitle>Architecture</SectionTitle>
      {architecture.summary && <p className="mt-3 max-w-prose whitespace-pre-line text-text-dim">{architecture.summary}</p>}
      {architecture.diagram_url && (
        <figure className="mt-5 overflow-hidden rounded-lg border border-rule">
          {/* Admin-provided path or URL of any size; next/image would need remote host config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={architecture.diagram_url} alt="Architecture diagram" className="w-full bg-panel" loading="lazy" />
        </figure>
      )}
      {components.length > 0 && (
        <dl className="mt-5 divide-y divide-rule border-y border-rule">
          {components.map((c, i) => (
            <div key={i} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
              <dt className="font-medium text-text">{c.name}</dt>
              <dd className="whitespace-pre-line text-sm text-text-dim">{c.description}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

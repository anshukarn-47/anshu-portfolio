import Link from "next/link";
import type { PrototypeEntry } from "@/lib/prototypes/registry";
import { MetricsPanel } from "./metrics-panel";
import { TradeoffPanel } from "./tradeoff-panel";

/**
 * The related work entry, trimmed to what Case study mode shows. Built on the
 * server from lib/work (see app/prototype-lab/[slug]/page.tsx) so it's plain,
 * serialisable data.
 */
export type PrototypeCaseStudy = {
  slug: string;
  title: string;
  problem: string | null;
  role: string | null;
  company: string | null;
  users: string | null;
  approach: string | null;
  /** The work table has no constraints column: these are the decisions' context notes. */
  constraints: string[];
  decisions: { title: string | null; choice: string | null; tradeoffs: string | null }[];
  architecture: { summary: string | null; components: { name: string; description: string | null }[] };
  outcome: string | null;
  metrics: { label: string; value: string; context: string | null }[];
};

export function CaseStudyView({ caseStudy, prototype }: { caseStudy: PrototypeCaseStudy | null; prototype: PrototypeEntry }) {
  if (!caseStudy) {
    return (
      <div className="rounded-lg border border-dashed border-rule bg-panel p-8 text-sm text-text-dim">
        The case study behind this prototype isn&apos;t published yet.
      </div>
    );
  }
  const cs = caseStudy;
  const roleLine = [cs.role, cs.company].filter(Boolean).join(", ");

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <article aria-labelledby="case-study-title" className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-wider text-text-faint">Based on</p>
        <h2 id="case-study-title" className="mt-1 text-2xl">
          {cs.title}
        </h2>

        {cs.metrics.length > 0 && (
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            {cs.metrics.map((m) => (
              <div key={m.label} className="rounded-md border border-rule bg-panel px-3 py-2">
                <dt className="text-xs text-text-faint">{m.label}</dt>
                <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <Section title="Problem" text={cs.problem} />
        {roleLine && <Section title="Role" text={cs.users ? `${roleLine}. Users: ${cs.users}` : roleLine} />}
        {cs.constraints.length > 0 && (
          <section className="mt-8">
            <h3 className="text-lg">Constraints</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-text-dim">
              {cs.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}
        {cs.decisions.length > 0 && (
          <section className="mt-8">
            <h3 className="text-lg">Decisions</h3>
            <ul className="mt-2 space-y-3">
              {cs.decisions.map((d, i) => (
                <li key={i} className="text-text-dim">
                  {d.title && <p className="font-medium text-text">{d.title}</p>}
                  {d.choice && <p>{d.choice}</p>}
                  {d.tradeoffs && <p className="mt-0.5 text-sm">Trade-off: {d.tradeoffs}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {(cs.architecture.summary || cs.architecture.components.length > 0) && (
          <section className="mt-8">
            <h3 className="text-lg">Architecture</h3>
            {cs.architecture.summary && <p className="mt-2 max-w-prose text-text-dim">{cs.architecture.summary}</p>}
            {cs.architecture.components.length > 0 && (
              <ul className="mt-2 space-y-1 text-text-dim">
                {cs.architecture.components.map((c) => (
                  <li key={c.name}>
                    <span className="text-text">{c.name}</span>
                    {c.description && `: ${c.description}`}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <Section title="Outcome" text={cs.outcome} />

        <Link
          href={`/work/${cs.slug}`}
          className="mt-8 inline-block text-sm text-text underline decoration-rule underline-offset-4 hover:decoration-signal-teal"
        >
          Read the full case study →
        </Link>
      </article>

      <aside className="space-y-8 lg:border-l lg:border-rule lg:pl-8">
        <MetricsPanel measures={prototype.whatIWouldMeasure} headingLevel={2} />
        <TradeoffPanel tradeoffs={prototype.tradeoffs} headingLevel={2} />
      </aside>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <section className="mt-8">
      <h3 className="text-lg">{title}</h3>
      <p className="mt-2 max-w-prose text-text-dim">{text}</p>
    </section>
  );
}

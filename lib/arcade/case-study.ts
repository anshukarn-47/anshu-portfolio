import { getWorkBySlug } from "@/lib/work";
import { formatMetric } from "@/lib/format";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";
import type { ArcadeEntry } from "./registry";

/**
 * The Real-world case for a game: the related work record from Supabase,
 * trimmed to plain data the same way the Prototype lab's Case study mode does
 * (same loader, same shape), so it only ever shows what the record says.
 */
export async function loadArcadeCase(slug: string | null): Promise<PrototypeCaseStudy | null> {
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

/** Every record behind a game: the main one first, then any others. Unpublished ones are left out. */
export async function loadArcadeCases(entry: ArcadeEntry): Promise<PrototypeCaseStudy[]> {
  const slugs = [entry.relatedWorkSlug, ...(entry.moreWorkSlugs ?? [])];
  const cases = await Promise.all(slugs.map((s) => loadArcadeCase(s)));
  return cases.filter((c): c is PrototypeCaseStudy => !!c);
}

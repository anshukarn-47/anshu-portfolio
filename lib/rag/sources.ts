import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatMetric, formatMonthYear, isPastDate } from "@/lib/format";
import { stageLabel } from "@/lib/admin/entities";
import { PROTOTYPES } from "@/lib/prototypes/registry";
import { ARCADE, PUBLISHED_GAMES } from "@/lib/arcade/registry";

/** A piece of public content to index. `key` identifies it across rebuilds. */
export type SourceDocument = {
  key: string;
  source_type: "profile" | "work" | "skill" | "certification" | "achievement" | "prototype" | "note";
  source_id: string | null;
  title: string;
  content: string;
  url: string;
  /** Generated from code (not a database row): marks notes this job owns, so hand-added notes are left alone. */
  generated?: boolean;
};

/**
 * A stable UUID for content defined in code, which has no database id: the
 * same key always gives the same id, so rebuilds update rather than duplicate.
 */
export function stableId(key: string) {
  const h = createHash("sha1").update(`anshu-portfolio:${key}`).digest("hex");
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

/**
 * Reads as an anonymous visitor, so RLS guarantees only published content is
 * indexed (drafts, hidden certifications and private tables never reach the AI).
 * `no-store` bypasses Next's fetch cache so rebuilds always see the latest data.
 */
function anonClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

const lines = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join("\n");
const field = (label: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? null : `${label}: ${value}`;
const section = (heading: string, body: string | null | undefined) => (body ? `## ${heading}\n${body}` : null);

type Obj = Record<string, unknown>;
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === "object") : []);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function buildPublicDocuments(): Promise<SourceDocument[]> {
  const db = anonClient();
  const [profile, work, skills, certifications, achievements, prototypes] = await Promise.all([
    db.from("profile").select("full_name, headline, location, bio").maybeSingle(),
    db.from("work").select("*, work_skills(skills(name))"),
    db.from("skills").select("id, name, slug, category, description, work_skills(work(title)), certification_skills(certifications(name))"),
    db.from("certifications").select("id, name, issuer, description, issue_date, expiry_date, credential_id, status, certification_skills(skills(name))"),
    db.from("achievements").select("id, title, description, metric_value, metric_unit, metric_context, category, date, work(title)"),
    db.from("prototypes").select("id, slug, title, summary, description, stage, tech_stack"),
  ]);
  for (const r of [profile, work, skills, certifications, achievements, prototypes]) {
    if (r.error) throw new Error(`Failed to read content for indexing: ${r.error.message}`);
  }

  const docs: SourceDocument[] = [];
  const owner = profile.data?.full_name ?? "the portfolio owner";

  if (profile.data) {
    const p = profile.data;
    docs.push({
      key: "profile",
      source_type: "profile",
      source_id: null,
      title: `About ${p.full_name}`,
      content: lines(field("Name", p.full_name), field("Headline", p.headline), field("Location", p.location), section("Bio", p.bio)),
      url: "/about",
    });
  }

  for (const w of work.data ?? []) {
    const skillNames = w.work_skills.map((ws) => ws.skills?.name).filter(Boolean).join(", ");
    const decisions = list(w.decisions)
      .map((d, i) => lines(`### Decision ${i + 1}: ${text(d.title) ?? ""}`, field("Context", text(d.context)), field("Choice", text(d.choice)), field("Trade-offs", text(d.tradeoffs))))
      .join("\n\n");
    const metrics = list(w.metrics)
      .map((m) => `- ${text(m.label) ?? "Metric"}: ${formatMetric(typeof m.value === "number" ? m.value : null, text(m.unit))}${text(m.context) ? ` (${text(m.context)})` : ""}`)
      .join("\n");
    const arch = w.architecture && typeof w.architecture === "object" && !Array.isArray(w.architecture) ? (w.architecture as Obj) : {};
    const components = list(arch.components).map((c) => `- ${text(c.name) ?? ""}: ${text(c.description) ?? ""}`).join("\n");

    docs.push({
      key: `work:${w.id}`,
      source_type: "work",
      source_id: w.id,
      title: `Case study: ${w.title}`,
      content: lines(
        field("Title", w.title),
        field("Subtitle", w.subtitle),
        field("Category", w.category),
        field("Company", w.company),
        field("Year", w.year),
        field("Role", w.role),
        field("Skills", skillNames),
        field("Summary", w.summary),
        "",
        [
          section("Problem", w.problem),
          section("Users", w.users),
          section("Approach", w.approach),
          section("Key decisions", decisions),
          section("Outcome", w.outcome),
          section("Metrics", metrics),
          section("Architecture", lines(text(arch.summary), components)),
        ]
          .filter(Boolean)
          .join("\n\n")
      ),
      url: `/work/${w.slug}`,
    });
  }

  for (const s of skills.data ?? []) {
    const usedIn = s.work_skills.map((ws) => ws.work?.title).filter(Boolean).join(", ");
    const certs = s.certification_skills.map((cs) => cs.certifications?.name).filter(Boolean).join(", ");
    docs.push({
      key: `skill:${s.id}`,
      source_type: "skill",
      source_id: s.id,
      title: `Skill: ${s.name}`,
      content: lines(`${owner} lists ${s.name} as a skill (${s.category}).`, text(s.description), field("Used in", usedIn), field("Certifications covering it", certs)),
      url: `/skills#${s.slug}`,
    });
  }

  for (const c of certifications.data ?? []) {
    const expired = c.status === "expired" || isPastDate(c.expiry_date);
    const skillNames = c.certification_skills.map((cs) => cs.skills?.name).filter(Boolean).join(", ");
    docs.push({
      key: `certification:${c.id}`,
      source_type: "certification",
      source_id: c.id,
      title: `Certification: ${c.name}`,
      content: lines(
        field("Certification", c.name),
        field("Issuer", c.issuer),
        field("Issued", formatMonthYear(c.issue_date)),
        field(expired ? "Expired" : "Valid until", formatMonthYear(c.expiry_date)),
        expired ? "Status: expired" : "Status: current",
        field("Skills", skillNames),
        text(c.description)
      ),
      url: `/certifications#${c.id}`,
    });
  }

  for (const a of achievements.data ?? []) {
    const metric = formatMetric(a.metric_value, a.metric_unit);
    docs.push({
      key: `achievement:${a.id}`,
      source_type: "achievement",
      source_id: a.id,
      title: `Achievement: ${a.title}`,
      content: lines(
        field("Achievement", a.title),
        metric ? `Result: ${metric}${a.metric_context ? ` ${a.metric_context}` : ""}` : null,
        field("Category", a.category),
        field("Date", formatMonthYear(a.date)),
        field("Related case study", a.work?.title),
        text(a.description)
      ),
      url: "/achievements",
    });
  }

  for (const p of prototypes.data ?? []) {
    docs.push({
      key: `prototype:${p.id}`,
      source_type: "prototype",
      source_id: p.id,
      title: `Prototype: ${p.title}`,
      content: lines(field("Prototype", p.title), field("Stage", stageLabel(p.stage)), field("Built with", p.tech_stack.join(", ")), field("Summary", p.summary), "", p.description),
      url: `/prototype-lab/${p.slug}`,
    });
  }

  const workTitle = new Map((work.data ?? []).map((w) => [w.slug, w.title]));
  docs.push(...codeDocuments(owner, workTitle, {
    workCount: work.data?.length ?? 0,
    skillCount: skills.data?.length ?? 0,
    certificationCount: certifications.data?.length ?? 0,
    achievementCount: achievements.data?.length ?? 0,
    experiments: (prototypes.data ?? []).map((p) => p.title),
  }));

  return docs.filter((d) => d.content.trim().length > 0);
}

/**
 * Content that lives in code rather than the database: the Prototype lab's
 * interactive simulations, the Arcade's games, and short overview notes of the
 * site's sections. Everything here is public on the site already.
 */
function codeDocuments(
  owner: string,
  workTitle: Map<string, string>,
  counts: { workCount: number; skillCount: number; certificationCount: number; achievementCount: number; experiments: string[] }
): SourceDocument[] {
  const docs: SourceDocument[] = [];
  const caseStudies = (slugs: (string | null | undefined)[]) =>
    slugs
      .filter((s): s is string => !!s && workTitle.has(s))
      .map((s) => `${workTitle.get(s)} (/work/${s})`)
      .join("; ");

  for (const p of PROTOTYPES) {
    const id = stableId(`prototype-lab:${p.slug}`);
    docs.push({
      key: `prototype:${id}`,
      source_type: "prototype",
      source_id: id,
      title: `Prototype: ${p.title}`,
      content: lines(
        field("Prototype", p.title),
        `An interactive decision simulation in ${owner}'s Prototype lab (${p.category}).`,
        field("In one line", p.hook),
        field("Based on the case study", caseStudies([p.relatedWorkSlug])),
        "",
        section(
          "Product lens",
          lines(field("User", p.pmLens.user), field("Problem", p.pmLens.problem), field("Signal", p.pmLens.signal), field("Decision", p.pmLens.decision))
        ),
        "",
        section(
          "What I'd measure",
          lines(
            field("Primary metric", p.whatIWouldMeasure.primary),
            field("Guardrail", p.whatIWouldMeasure.guardrail),
            field("Leading indicator", p.whatIWouldMeasure.leadingIndicator),
            field("Failure mode", p.whatIWouldMeasure.failureMode)
          )
        ),
        "",
        section("Trade-offs", p.tradeoffs.map((t) => `- ${t.a} vs ${t.b}: chose ${t.choice}. ${t.why}`).join("\n"))
      ),
      url: `/prototype-lab/${p.slug}`,
    });
  }

  for (const g of PUBLISHED_GAMES) {
    const id = stableId(`arcade:${g.slug}`);
    const simulation = g.relatedSimulation ? PROTOTYPES.find((p) => p.slug === g.relatedSimulation) : undefined;
    docs.push({
      key: `prototype:${id}`,
      source_type: "prototype",
      source_id: id,
      title: `Arcade game: ${g.title}`,
      content: lines(
        field("Game", g.title),
        `A short game in ${owner}'s Arcade, built on one decision from the work. Every run ends with the real case behind it.`,
        field("In one line", g.hook),
        field("Mechanic", g.mechanic),
        field("Length", g.duration),
        field("Based on the case study", caseStudies([g.relatedWorkSlug, ...(g.moreWorkSlugs ?? [])])),
        field("Related Prototype lab simulation", simulation ? `${simulation.title} (/prototype-lab/${simulation.slug})` : null),
        "",
        section("How it plays", g.about)
      ),
      url: `/arcade/${g.slug}`,
    });
  }

  const note = (key: string, title: string, url: string, content: string): SourceDocument => {
    const id = stableId(`note:${key}`);
    return { key: `note:${id}`, source_type: "note", source_id: id, title, content, url, generated: true };
  };
  const soon = ARCADE.filter((g) => g.status === "soon");

  docs.push(
    note(
      "arcade",
      "Arcade: quick decision games",
      "/arcade",
      lines(
        `The Arcade (/arcade) is a section of ${owner}'s portfolio: "Don't just read about my decisions. Play them."`,
        `It has ${PUBLISHED_GAMES.length} short games, each ${PUBLISHED_GAMES[0]?.duration ?? "60–120 seconds"} long and built on one decision from the work. Every game runs tutorial, play, debrief and the real case from a work record. Data is fictional and results are simulated; scores reward decision quality, not speed. There is a relaxed mode with no timer.`,
        "",
        section("Games", PUBLISHED_GAMES.map((g) => `- ${g.title} (/arcade/${g.slug}): ${g.hook}`).join("\n")),
        soon.length ? section("Coming soon", soon.map((g) => `- ${g.title}`).join("\n")) : null,
        "",
        "For longer decision simulations, see the Prototype lab (/prototype-lab)."
      )
    ),
    note(
      "prototype-lab",
      "Prototype lab: interactive prototypes",
      "/prototype-lab",
      lines(
        `The Prototype lab (/prototype-lab) holds ${owner}'s interactive prototypes that put you in the product decision, plus experiments and works in progress.`,
        "",
        section("Interactive prototypes", PROTOTYPES.map((p) => `- ${p.title} (/prototype-lab/${p.slug}): ${p.hook}`).join("\n")),
        counts.experiments.length ? section("Experiments", counts.experiments.map((t) => `- ${t}`).join("\n")) : null,
        "",
        "For short games built on the same kind of decisions, see the Arcade (/arcade)."
      )
    ),
    note(
      "site-overview",
      "Site overview: what's on this portfolio",
      "/",
      lines(
        `${owner}'s portfolio has these sections:`,
        `- Work (/work): ${counts.workCount} case studies.`,
        `- Skills (/skills): ${counts.skillCount} skills.`,
        `- Certifications (/certifications): ${counts.certificationCount} certifications.`,
        `- Achievements (/achievements): ${counts.achievementCount} achievements.`,
        `- Prototype lab (/prototype-lab): ${PROTOTYPES.length} interactive prototypes (${PROTOTYPES.map((p) => p.title).join(", ")}).`,
        `- Arcade (/arcade): ${PUBLISHED_GAMES.length} short decision games (${PUBLISHED_GAMES.map((g) => g.title).join(", ")}).`,
        "- AI lab (/ai-lab): Ask Anshu. Ask questions about this portfolio; answers come from the site's own content.",
        "- Career agent (/ai-lab/career-agent): paste a job description and see how the portfolio's evidence maps to each requirement.",
        "- About (/about): background and contact."
      )
    )
  );
  return docs;
}

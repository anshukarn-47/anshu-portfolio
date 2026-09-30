import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatMetric, formatMonthYear, isPastDate } from "@/lib/format";
import { stageLabel } from "@/lib/admin/entities";

/** A piece of public content to index. `key` identifies it across rebuilds. */
export type SourceDocument = {
  key: string;
  source_type: "profile" | "work" | "skill" | "certification" | "achievement" | "prototype";
  source_id: string | null;
  title: string;
  content: string;
  url: string;
};

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

  return docs.filter((d) => d.content.trim().length > 0);
}

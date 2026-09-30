import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

// --- JSONB shapes (see supabase/migrations/..._portfolio_content.sql) ---------
export type Decision = { title?: string; context?: string; choice?: string; tradeoffs?: string };
export type Metric = { label?: string; value?: number; unit?: string; context?: string };
export type Architecture = {
  summary?: string;
  diagram_url?: string;
  components?: { name?: string; description?: string }[];
};

export type SkillTag = { name: string; slug: string; category: string };

export type WorkSummary = Pick<
  Tables<"work">,
  "id" | "slug" | "title" | "subtitle" | "category" | "company" | "year" | "role" | "summary" | "featured"
> & { metrics: Metric[] };

export type WorkDetail = Omit<Tables<"work">, "decisions" | "metrics" | "architecture"> & {
  decisions: Decision[];
  metrics: Metric[];
  architecture: Architecture;
  skills: SkillTag[];
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const asList = <T,>(v: unknown): T[] => (Array.isArray(v) ? v.filter(isObject) : []) as T[];

const SUMMARY_COLUMNS = "id, slug, title, subtitle, category, company, year, role, summary, featured, metrics";

const cleanMetrics = (v: unknown) => asList<Metric>(v).filter((m) => typeof m.value === "number");

/** Published work for /work, in display order. */
export const getPublishedWork = cache(async (): Promise<WorkSummary[]> => {
  const { data, error } = await createPublicClient()
    .from("work")
    .select(SUMMARY_COLUMNS)
    .order("display_order", { ascending: true })
    .order("year", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to load work: ${error.message}`);
  return (data ?? []).map((w) => ({ ...w, metrics: cleanMetrics(w.metrics) }));
});

/** One published case study, with its skills. Null when missing or unpublished. */
export const getWorkBySlug = cache(async (slug: string): Promise<WorkDetail | null> => {
  const { data, error } = await createPublicClient()
    .from("work")
    .select("*, work_skills(skills(name, slug, category, display_order))")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load work "${slug}": ${error.message}`);
  if (!data) return null;

  const { work_skills, decisions, metrics, architecture, ...rest } = data;
  const skills = (work_skills ?? [])
    .map((ws) => ws.skills)
    .filter((s): s is NonNullable<typeof s> => !!s)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
    .map(({ name, slug, category }) => ({ name, slug, category }));

  return {
    ...rest,
    decisions: asList<Decision>(decisions),
    metrics: cleanMetrics(metrics),
    architecture: isObject(architecture) ? (architecture as Architecture) : {},
    skills,
  };
});

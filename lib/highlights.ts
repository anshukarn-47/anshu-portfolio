import "server-only";
import { getPublishedWork, type WorkSummary } from "@/lib/work";

/** From the resume: first role (Mainframe Application Developer) started June 2015. */
const CAREER_START = new Date(Date.UTC(2015, 5, 1));

export type HeroMetric = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  context: string | null;
  href: string | null;
  standout: boolean; // gets the single amber border on the homepage
};

const metricsOf = (work: WorkSummary[]) => work.flatMap((w) => w.metrics.map((m) => ({ ...m, work: w })));

/**
 * The four homepage hero metrics, derived from published content so they stay
 * in sync with the case studies. Any metric that can't be derived is omitted.
 */
export async function getHeroMetrics(): Promise<HeroMetric[]> {
  const work = await getPublishedWork();
  const all = metricsOf(work);
  const out: HeroMetric[] = [];

  const users = all.filter((m) => m.unit === "M+").sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  if (users) {
    out.push({ key: "users", label: "Users on platforms owned", value: users.value!, unit: "M+", context: null, href: `/work/${users.work.slug}`, standout: false });
  }

  const years = Math.floor((Date.now() - CAREER_START.getTime()) / (365.25 * 24 * 3600 * 1000));
  out.push({ key: "years", label: "Years of experience", value: years, unit: null, context: "since 2015", href: "/about", standout: false });

  const genai = work.filter((w) => w.category === "AI").length;
  if (genai) {
    out.push({ key: "genai", label: "GenAI products shipped", value: genai, unit: null, context: null, href: "/work", standout: false });
  }

  const peak = all.filter((m) => m.unit === "req/sec").sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  if (peak) {
    out.push({
      key: "peak",
      label: "Peak load held, zero outage",
      value: peak.value!,
      unit: "req/sec",
      context: peak.context ?? null,
      href: `/work/${peak.work.slug}`,
      standout: true,
    });
  }

  return out;
}

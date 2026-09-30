import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { PROTOTYPES } from "@/lib/prototypes/registry";
import { SITE_URL } from "@/lib/site";

// Refreshed with the content it lists (saving in /admin revalidates too).
export const revalidate = 3600;

/** Every public page: the fixed sections, published case studies and prototypes. Never /admin or /api. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createPublicClient();
  // Anonymous reads: RLS only returns published rows, so drafts can't leak into the sitemap.
  const [work, prototypes] = await Promise.all([
    db.from("work").select("slug, updated_at").eq("published", true),
    db.from("prototypes").select("slug, updated_at").eq("published", true),
  ]);
  if (work.error) console.error("[sitemap] could not load work", work.error);
  if (prototypes.error) console.error("[sitemap] could not load prototypes", prototypes.error);

  const url = (path: string) => `${SITE_URL}${path}`;
  const sections: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/work"), changeFrequency: "weekly", priority: 0.9 },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.8 },
    { url: url("/skills"), changeFrequency: "monthly", priority: 0.7 },
    { url: url("/certifications"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/achievements"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/prototype-lab"), changeFrequency: "monthly", priority: 0.7 },
    { url: url("/ai-lab"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/ai-lab/career-agent"), changeFrequency: "monthly", priority: 0.6 },
  ];

  const registrySlugs = new Set(PROTOTYPES.map((p) => p.slug));
  return [
    ...sections,
    ...(work.data ?? []).map((w) => ({ url: url(`/work/${w.slug}`), lastModified: w.updated_at, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...PROTOTYPES.map((p) => ({ url: url(`/prototype-lab/${p.slug}`), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...(prototypes.data ?? [])
      .filter((p) => !registrySlugs.has(p.slug))
      .map((p) => ({ url: url(`/prototype-lab/${p.slug}`), lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}

import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicSkill = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  featured: boolean;
  work: { slug: string; title: string }[];            // published work only (RLS)
  certifications: { id: string; name: string }[];      // non-hidden certifications only (RLS)
};

export type SkillCategory = { name: string; skills: PublicSkill[] };

/** Skills grouped by category. Categories are ordered by their lowest display_order, then name. */
export const getSkillsByCategory = cache(async (): Promise<SkillCategory[]> => {
  const { data, error } = await createPublicClient()
    .from("skills")
    .select(
      "id, name, slug, category, description, icon, featured, display_order, work_skills(work(slug, title, display_order)), certification_skills(certifications(id, name, display_order))"
    )
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to load skills: ${error.message}`);

  const categories = new Map<string, { order: number; skills: PublicSkill[] }>();
  for (const s of data ?? []) {
    const work = s.work_skills
      .map((ws) => ws.work)
      .filter((w): w is NonNullable<typeof w> => !!w)
      .sort((a, b) => a.display_order - b.display_order)
      .map(({ slug, title }) => ({ slug, title }));
    const certifications = s.certification_skills
      .map((cs) => cs.certifications)
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.display_order - b.display_order)
      .map(({ id, name }) => ({ id, name }));

    const entry = categories.get(s.category) ?? { order: s.display_order, skills: [] };
    entry.order = Math.min(entry.order, s.display_order);
    entry.skills.push({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      icon: s.icon,
      featured: s.featured,
      work,
      certifications,
    });
    categories.set(s.category, entry);
  }

  return Array.from(categories, ([name, { order, skills }]) => ({ name, order, skills }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(({ name, skills }) => ({ name, skills }));
});

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillOption, WorkOption } from "@/components/admin/entity-form";
import type { EntityConfig } from "./entities";

/** Options the entity form needs: skills to tick, work items to link, value suggestions. */
export async function loadFormOptions(db: SupabaseClient, config: EntityConfig) {
  const fields = config.sections.flatMap((s) => s.fields);
  const needsSkills = fields.some((f) => f.type === "skills");
  const needsWorks = fields.some((f) => f.type === "work");
  const suggestFields = fields.filter((f) => f.suggest).map((f) => f.name);

  const [skills, works, suggestionRows] = await Promise.all([
    needsSkills
      ? db.from("skills").select("id, name, category").order("category").order("display_order").order("name")
      : Promise.resolve({ data: [] }),
    needsWorks
      ? db.from("work").select("id, title").order("display_order").order("title")
      : Promise.resolve({ data: [] }),
    suggestFields.length
      ? db.from(config.table).select(suggestFields.join(", "))
      : Promise.resolve({ data: [] }),
  ]);

  const suggestions: Record<string, string[]> = {};
  for (const name of suggestFields) {
    const values = ((suggestionRows.data ?? []) as unknown as Record<string, unknown>[])
      .map((r) => r[name])
      .filter((v): v is string => typeof v === "string" && v !== "");
    suggestions[name] = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }

  return {
    skills: (skills.data ?? []) as SkillOption[],
    works: (works.data ?? []) as WorkOption[],
    suggestions,
  };
}

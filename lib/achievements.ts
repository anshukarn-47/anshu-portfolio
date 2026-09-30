import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicAchievement = {
  id: string;
  title: string;
  description: string | null;
  metric_value: number | null;
  metric_unit: string | null;
  metric_context: string | null;
  category: string | null;
  date: string | null;
  featured: boolean;
  work: { slug: string; title: string } | null; // null when unlinked or the work isn't published (RLS)
};

export const getAchievements = cache(async (): Promise<PublicAchievement[]> => {
  const { data, error } = await createPublicClient()
    .from("achievements")
    .select("id, title, description, metric_value, metric_unit, metric_context, category, date, featured, work(slug, title)")
    .order("display_order", { ascending: true })
    .order("date", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to load achievements: ${error.message}`);
  return data ?? [];
});

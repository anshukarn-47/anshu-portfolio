import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database";

export type PrototypeSummary = Pick<
  Tables<"prototypes">,
  "id" | "slug" | "title" | "summary" | "stage" | "tech_stack" | "thumbnail_url" | "featured"
>;
export type PrototypeDetail = Omit<Tables<"prototypes">, "published" | "created_at">;

/** Published prototypes (RLS), in display order. */
export const getPublishedPrototypes = cache(async (): Promise<PrototypeSummary[]> => {
  const { data, error } = await createPublicClient()
    .from("prototypes")
    .select("id, slug, title, summary, stage, tech_stack, thumbnail_url, featured")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load prototypes: ${error.message}`);
  return data ?? [];
});

/** One published prototype, or null when missing or unpublished. */
export const getPrototypeBySlug = cache(async (slug: string): Promise<PrototypeDetail | null> => {
  const { data, error } = await createPublicClient()
    .from("prototypes")
    .select("id, slug, title, summary, description, stage, tech_stack, demo_url, repo_url, embed_url, thumbnail_url, featured, display_order, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load prototype "${slug}": ${error.message}`);
  return data;
});

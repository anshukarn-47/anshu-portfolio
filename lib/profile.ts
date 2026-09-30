import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { SOCIAL_LINKS } from "@/lib/admin/entities";
import type { Tables } from "@/types/database";

export type PublicProfile = Omit<Tables<"profile">, "social_links" | "id" | "created_at" | "updated_at"> & {
  socialLinks: { key: string; label: string; href: string }[];
};

const HTTP_URL_RE = /^https?:\/\/\S+$/;

/** The single profile row, or null if it hasn't been set up yet. */
export const getProfile = cache(async (): Promise<PublicProfile | null> => {
  const { data, error } = await createPublicClient()
    .from("profile")
    .select("full_name, headline, bio, location, email, avatar_url, resume_url, social_links")
    .maybeSingle();
  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  if (!data) return null;

  const { social_links, ...rest } = data;
  const links = social_links && typeof social_links === "object" && !Array.isArray(social_links) ? social_links : {};
  // Only http(s) links are rendered, whatever is stored.
  const socialLinks = SOCIAL_LINKS.flatMap(({ key, label }) => {
    const href = (links as Record<string, unknown>)[key];
    return typeof href === "string" && HTTP_URL_RE.test(href) ? [{ key, label, href }] : [];
  });

  return { ...rest, socialLinks };
});

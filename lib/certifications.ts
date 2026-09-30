import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isPastDate } from "@/lib/format";

export type PublicCertification = {
  id: string;
  name: string;
  issuer: string;
  description: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  credential_url: string | null;
  certificate_image_url: string | null;
  featured: boolean;
  expired: boolean; // status 'expired', or the expiry date has passed
  skills: { name: string; slug: string }[];
};

/** Visible certifications (RLS excludes status 'hidden'), in display order, newest first. */
export const getCertifications = cache(async (): Promise<PublicCertification[]> => {
  const { data, error } = await createPublicClient()
    .from("certifications")
    .select(
      "id, name, issuer, description, issue_date, expiry_date, credential_id, credential_url, certificate_image_url, featured, status, certification_skills(skills(name, slug, display_order))"
    )
    .order("display_order", { ascending: true })
    .order("issue_date", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to load certifications: ${error.message}`);

  return (data ?? []).map(({ status, certification_skills, ...c }) => ({
    ...c,
    expired: status === "expired" || isPastDate(c.expiry_date),
    skills: certification_skills
      .map((cs) => cs.skills)
      .filter((s): s is NonNullable<typeof s> => !!s)
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
      .map(({ name, slug }) => ({ name, slug })),
  }));
});

import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Only allow redirects back into the admin area, so `?next=` can't be used
 * to bounce users to another site.
 */
export function safeAdminPath(next: unknown): string {
  if (typeof next !== "string") return "/admin";
  if (!next.startsWith("/admin") || next.startsWith("/admin/login")) return "/admin";
  if (next.startsWith("//") || next.includes("\\")) return "/admin";
  return next;
}

/**
 * Returns the signed-in admin user, or redirects to the login page.
 * Use at the top of every admin layout/page/server action.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/admin/login?error=not_admin");

  return { user, supabase };
}

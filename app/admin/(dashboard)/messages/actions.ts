"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

/** Deletes one contact message. Runs as the signed-in admin; RLS allows admins only. */
export async function deleteMessage(id: number): Promise<void> {
  if (!Number.isSafeInteger(id) || id < 1) redirect("/admin/messages");

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("contact_messages").delete().eq("id", id);
  if (error) redirect("/admin/messages?error=delete");

  revalidatePath("/admin/messages");
  redirect("/admin/messages?deleted=1");
}

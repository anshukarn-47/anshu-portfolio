"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { SINGLETON_ID, UUID_RE, getEntity, type EntityConfig } from "@/lib/admin/entities";
import { parseEntityForm } from "@/lib/admin/parse";
import { adminError } from "@/lib/admin/errors";

/** savedAt: set when a singleton (e.g. the profile) saves; it stays on its page, so it can't signal success with a redirect. */
export type SaveState = { message: string | null; errors: Record<string, string>; savedAt?: number };

// Tables are chosen at runtime from the entity config, so use an untyped client here.
// All writes still run as the signed-in admin and are enforced by RLS.
function untyped(client: unknown) {
  return client as SupabaseClient;
}

function dbError(error: PostgrestError, config: EntityConfig): SaveState {
  if (error.code === "23505") {
    // unique_violation. The column comes from details ('Key (slug)=(x) already exists.')
    // when present, otherwise from the constraint name ('skills_slug_key' -> 'slug').
    const constraint = error.message.match(/unique constraint "([^"]+)"/)?.[1];
    const prefix = `${config.table}_`;
    const column =
      error.details?.match(/Key \((\w+)\)/)?.[1] ??
      (constraint?.startsWith(prefix) && constraint.endsWith("_key")
        ? constraint.slice(prefix.length, -"_key".length)
        : undefined);
    if (column) {
      return {
        message: "Fix the highlighted fields.",
        errors: { [column]: `Another ${config.singular.toLowerCase()} already uses this ${column}.` },
      };
    }
  }
  if (error.code === "23514" && error.message.includes("dates_check")) {
    return { message: "Fix the highlighted fields.", errors: { expiry_date: "Expiry date must be on or after the issue date." } };
  }
  return { message: adminError(`save ${config.table}`, error, "Couldn't save. Please try again."), errors: {} };
}

export async function saveEntity(
  entityKey: string,
  id: string | null,
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const config = getEntity(entityKey);
  if (!config || (id !== null && !UUID_RE.test(id))) return { message: "Unknown item.", errors: {} };

  const { supabase } = await requireAdmin();
  const db = untyped(supabase);

  const { values, skillIds, errors } = parseEntityForm(config, formData);
  if (Object.keys(errors).length) return { message: "Fix the highlighted fields.", errors };

  if (config.singleton) {
    const { error } = await db.from(config.table).upsert({ id: SINGLETON_ID, ...values });
    if (error) return dbError(error, config);
    revalidatePath("/", "layout");
    // No redirect: the form already lives at /admin/<key>, and a form action that
    // redirects to the current URL resolves with undefined state.
    return { message: null, errors: {}, savedAt: Date.now() };
  }

  let rowId = id;
  if (id) {
    const { data, error } = await db.from(config.table).update(values).eq("id", id).select("id");
    if (error) return dbError(error, config);
    if (!data?.length) return { message: "This item no longer exists, or you don't have access to it.", errors: {} };
  } else {
    const { data, error } = await db.from(config.table).insert(values).select("id").single();
    if (error) return dbError(error, config);
    rowId = data.id as string;
  }

  if (config.skillsJoin && skillIds && rowId) {
    const { table, fk } = config.skillsJoin;
    const del = await db.from(table).delete().eq(fk, rowId);
    const skillsFailed = "Saved, but the linked skills couldn't be updated. Please try again.";
    if (del.error) return { message: adminError(`clear ${table}`, del.error, skillsFailed), errors: {} };
    if (skillIds.length) {
      const ins = await db.from(table).insert(skillIds.map((skill_id) => ({ [fk]: rowId, skill_id })));
      if (ins.error) return { message: adminError(`save ${table}`, ins.error, skillsFailed), errors: {} };
    }
  }

  revalidatePath("/", "layout");
  redirect(`/admin/${config.key}?saved=1`);
}

export async function deleteEntity(entityKey: string, id: string): Promise<void> {
  const config = getEntity(entityKey);
  if (!config || config.singleton || !UUID_RE.test(id)) redirect("/admin");

  const { supabase } = await requireAdmin();
  const { error } = await untyped(supabase).from(config.table).delete().eq("id", id);
  if (error) redirect(`/admin/${config.key}/${id}?error=delete`);

  revalidatePath("/", "layout");
  redirect(`/admin/${config.key}?deleted=1`);
}

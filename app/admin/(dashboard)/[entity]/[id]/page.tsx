import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { UUID_RE, getEntity, type Row } from "@/lib/admin/entities";
import { loadFormOptions } from "@/lib/admin/load";
import { EntityForm } from "@/components/admin/entity-form";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function EditEntityPage(props: {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const config = getEntity(params.entity);
  if (!config || config.singleton || !UUID_RE.test(params.id)) notFound();

  const { supabase } = await requireAdmin();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: row }, options, linked] = await Promise.all([
    db.from(config.table).select("*").eq("id", params.id).maybeSingle(),
    loadFormOptions(db, config),
    config.skillsJoin
      ? db.from(config.skillsJoin.table).select("skill_id").eq(config.skillsJoin.fk, params.id)
      : Promise.resolve({ data: [] }),
  ]);
  if (!row) notFound();

  const title = String((row as Row)[config.titleField] ?? "Untitled");
  const selectedSkillIds = ((linked.data ?? []) as { skill_id: string }[]).map((l) => l.skill_id);

  return (
    <>
      <Link href={`/admin/${config.key}`} className="text-sm text-text-dim hover:underline">
        ← {config.label}
      </Link>
      <div className="mb-8 mt-2 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <DeleteButton entityKey={config.key} id={params.id} label={title} />
      </div>

      {searchParams.error === "delete" && (
        <p role="alert" className="mb-6 rounded-md border border-signal-red px-3 py-2 text-sm text-text">
          Couldn&apos;t delete this item. Try again.
        </p>
      )}

      <EntityForm
        entityKey={config.key}
        id={params.id}
        initial={row as Row}
        selectedSkillIds={selectedSkillIds}
        {...options}
      />
    </>
  );
}

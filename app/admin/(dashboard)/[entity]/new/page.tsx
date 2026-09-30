import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { getEntity } from "@/lib/admin/entities";
import { loadFormOptions } from "@/lib/admin/load";
import { EntityForm } from "@/components/admin/entity-form";

export default async function NewEntityPage(props: { params: Promise<{ entity: string }> }) {
  const params = await props.params;
  const config = getEntity(params.entity);
  if (!config) notFound();
  if (config.singleton) redirect(`/admin/${config.key}`);

  const { supabase } = await requireAdmin();
  const options = await loadFormOptions(supabase as unknown as SupabaseClient, config);

  return (
    <>
      <Link href={`/admin/${config.key}`} className="text-sm text-text-dim hover:underline">
        ← {config.label}
      </Link>
      <h1 className="mb-8 mt-2 text-2xl font-semibold tracking-tight">New {config.singular.toLowerCase()}</h1>
      <EntityForm entityKey={config.key} id={null} initial={{}} selectedSkillIds={[]} {...options} />
    </>
  );
}

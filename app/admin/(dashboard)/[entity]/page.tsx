import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { SINGLETON_ID, getEntity, type Row } from "@/lib/admin/entities";
import { loadFormOptions } from "@/lib/admin/load";
import { primaryButtonClass } from "@/components/admin/styles";
import { EntityForm } from "@/components/admin/entity-form";
import { StatusPill } from "@/components/ui/status-pill";
import { adminError } from "@/lib/admin/errors";

/** Status values shown with the site's status pill: teal for live/active states, neutral otherwise. */
const OPERATIONAL = new Set(["Published", "active", "Live"]);

export default async function EntityListPage(props: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const config = getEntity(params.entity);
  if (!config) notFound();

  const { supabase } = await requireAdmin();

  if (config.singleton) {
    const db = supabase as unknown as SupabaseClient;
    const [{ data: row }, options] = await Promise.all([
      db.from(config.table).select("*").eq("id", SINGLETON_ID).maybeSingle(),
      loadFormOptions(db, config),
    ]);
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">{config.label}</h1>
        {/* The save confirmation shows inside the form (the action returns savedAt). */}
        <div className="mt-8">
          <EntityForm entityKey={config.key} id={null} initial={(row ?? {}) as Row} selectedSkillIds={[]} {...options} />
        </div>
      </>
    );
  }

  let query = (supabase as unknown as SupabaseClient).from(config.table).select("*");
  for (const { column, ascending } of config.orderBy) query = query.order(column, { ascending, nullsFirst: false });
  const { data, error } = await query;
  const rows = (data ?? []) as Row[];

  const flash = searchParams.saved ? "Saved." : searchParams.deleted ? "Deleted." : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.label}</h1>
          <p className="mt-1 text-sm text-text-dim">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </p>
        </div>
        <Link href={`/admin/${config.key}/new`} className={primaryButtonClass}>
          New {config.singular.toLowerCase()}
        </Link>
      </div>

      {flash && (
        <p role="status" className="mt-6 rounded-md border border-signal-teal px-3 py-2 text-sm text-text">
          {flash}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-md border border-signal-red px-3 py-2 text-sm text-text">
          {adminError(`load ${config.table}`, error, `Couldn't load ${config.label.toLowerCase()}. Please reload the page.`)}
        </p>
      )}

      {rows.length === 0 && !error ? (
        <div className="mt-8 rounded-lg border border-dashed border-rule p-10 text-center">
          <p className="text-sm text-text-dim">No {config.label.toLowerCase()} yet.</p>
          <Link href={`/admin/${config.key}/new`} className="mt-3 inline-block text-sm font-medium underline">
            Add the first one
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-rule">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-panel text-text-dim">
              <tr>
                {config.columns.map((c) => (
                  <th key={c.label} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-panel-2">
                  {config.columns.map((c, i) => {
                    const value = c.get(row);
                    return (
                      <td key={c.label} className="whitespace-nowrap px-4 py-3">
                        {i === 0 ? (
                          <Link href={`/admin/${config.key}/${row.id}`} className="font-medium hover:underline">
                            {value ?? "Untitled"}
                          </Link>
                        ) : c.badge && value ? (
                          <StatusPill tone={OPERATIONAL.has(value) ? "ok" : "idle"}>{value.toLowerCase()}</StatusPill>
                        ) : (
                          <span className={value ? "" : "text-text-faint"}>{value ?? "—"}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

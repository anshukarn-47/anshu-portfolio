import type { PrototypeEntry } from "@/lib/prototypes/registry";
import { StatusPill } from "@/components/ui/status-pill";
import { PrototypeCard } from "./prototype-card";

/** A prototype that's announced but not built yet: shown as a placeholder card, not a link. */
export type UpcomingPrototype = { title: string; note?: string };

export function PrototypeGrid({ prototypes, upcoming = [] }: { prototypes: PrototypeEntry[]; upcoming?: UpcomingPrototype[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {prototypes.map((p) => (
        <li key={p.slug}>
          <PrototypeCard prototype={p} />
        </li>
      ))}
      {upcoming.map((u) => (
        <li key={u.title}>
          <article className="flex h-full flex-col rounded-lg border border-dashed border-rule p-5">
            {/* Wrapped so the pill keeps its natural width instead of stretching across the column. */}
            <div>
              <StatusPill tone="idle">Coming soon</StatusPill>
            </div>
            <h2 className="mt-3 text-lg text-text">{u.title}</h2>
            {u.note && <p className="mt-2 text-sm text-text-dim">{u.note}</p>}
          </article>
        </li>
      ))}
    </ul>
  );
}

import type { PrototypeEntry } from "@/lib/prototypes/registry";
import { PrototypeCard } from "./prototype-card";

export function PrototypeGrid({ prototypes }: { prototypes: PrototypeEntry[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {prototypes.map((p) => (
        <li key={p.slug}>
          <PrototypeCard prototype={p} />
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import type { PrototypeEntry } from "@/lib/prototypes/registry";
import { CategoryBadge } from "./category-badge";

export function PrototypeCard({ prototype: p }: { prototype: PrototypeEntry }) {
  return (
    <article className="h-full rounded-lg border border-rule bg-panel">
      <Link href={`/prototype-lab/${p.slug}`} className="flex h-full flex-col rounded-lg p-5 transition-colors hover:bg-panel-2">
        <CategoryBadge category={p.category} />
        <h2 className="mt-3 text-lg text-text">{p.title}</h2>
        <p className="mt-2 text-sm text-text-dim">{p.hook}</p>
        <span className="mt-auto pt-5 text-sm text-text">Open prototype →</span>
      </Link>
    </article>
  );
}

import Link from "next/link";
import type { PrototypeSummary } from "@/lib/prototypes";
import { isSafeSrc } from "@/lib/format";
import { StageBadge } from "./stage-badge";

export function ShowcaseCard({ prototype: p }: { prototype: PrototypeSummary }) {
  return (
    <article className="h-full rounded-lg border border-rule bg-panel">
      <Link href={`/prototype-lab/${p.slug}`} className="flex h-full flex-col rounded-lg transition-colors hover:bg-panel-2">
        {isSafeSrc(p.thumbnail_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumbnail_url} alt="" className="aspect-video w-full rounded-t-lg border-b border-rule bg-panel-2 object-cover" loading="lazy" />
        ) : (
          <div aria-hidden className="aspect-video w-full rounded-t-lg border-b border-rule bg-panel-2" />
        )}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg text-text">{p.title}</h2>
            <StageBadge stage={p.stage} />
          </div>
          {p.featured && <p className="mt-1 text-xs text-text-faint">Featured</p>}
          {p.summary && <p className="mt-2 text-sm text-text-dim">{p.summary}</p>}
          {p.tech_stack.length > 0 && (
            <ul className="mt-auto flex flex-wrap gap-1.5 pt-4" aria-label="Tech stack">
              {p.tech_stack.map((t) => (
                <li key={t} className="rounded border border-rule px-1.5 py-0.5 text-xs text-text-dim">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </article>
  );
}

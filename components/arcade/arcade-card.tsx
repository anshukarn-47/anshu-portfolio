import Link from "next/link";
import type { ArcadeEntry } from "@/lib/arcade/registry";
import { StatusPill } from "@/components/ui/status-pill";

/** A game card on the hub: title, hook, mechanic, duration and status. Only published games link. */
export function ArcadeCard({ game: g }: { game: ArcadeEntry }) {
  const playable = g.status === "published";
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <StatusPill tone={playable ? "ok" : "idle"}>{playable ? "Playable" : "Soon"}</StatusPill>
        <span className="font-mono text-xs text-text-faint">{g.duration}</span>
      </div>
      <h2 className={`mt-4 text-lg ${playable ? "text-text" : "text-text-dim"}`}>{g.title}</h2>
      <p className="mt-2 text-sm text-text-dim">{g.hook}</p>
      <dl className="mt-auto pt-5">
        <dt className="font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">Mechanic</dt>
        <dd className="mt-0.5 text-sm text-text-dim">{g.mechanic}</dd>
      </dl>
      {playable && <span className="mt-4 text-sm text-text">Play →</span>}
    </>
  );

  return (
    <article className={`h-full rounded-lg border bg-panel ${playable ? "border-rule" : "border-dashed border-rule"}`}>
      {playable ? (
        <Link href={`/arcade/${g.slug}`} className="flex h-full flex-col rounded-lg p-5 transition-colors hover:bg-panel-2">
          {body}
        </Link>
      ) : (
        <div className="flex h-full flex-col p-5">{body}</div>
      )}
    </article>
  );
}

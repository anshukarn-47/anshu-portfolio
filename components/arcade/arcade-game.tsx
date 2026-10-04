"use client";

import { useEffect, useState } from "react";
import { getArcadeEntry } from "@/lib/arcade/registry";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";
import { ARCADE_GAME_LOADERS } from "./games";
import { GameShell } from "./game-shell";
import type { GameDefinition } from "./types";

/**
 * Loads the game for this slug on the client (game definitions hold components,
 * so they can't come from the server) as its own chunk, then runs it in the shell.
 */
export function ArcadeGame({ slug, cases }: { slug: string; cases: PrototypeCaseStudy[] }) {
  const entry = getArcadeEntry(slug);
  const load = ARCADE_GAME_LOADERS[slug];
  const [game, setGame] = useState<GameDefinition | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!load) return;
    let live = true;
    load()
      .then((g) => live && setGame(g))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [load]);

  if (!entry || !load) return <Notice>This game is on its way.</Notice>;
  if (failed) return <Notice>The game didn&apos;t load. Refresh the page to try again.</Notice>;
  if (!game)
    return (
      <div role="status" className="rounded-lg border border-rule bg-panel p-8 text-sm text-text-dim">
        Loading the game…
      </div>
    );
  return <GameShell entry={entry} game={game} cases={cases} />;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-rule bg-panel p-8 text-sm text-text-dim">{children}</p>;
}

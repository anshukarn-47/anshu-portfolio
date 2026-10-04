import type { GameDefinition } from "./types";

/**
 * Playable games by registry slug (lib/arcade/registry.ts). Each loads on
 * demand, so a game's page only downloads that game's code.
 */
export const ARCADE_GAME_LOADERS: Record<string, () => Promise<GameDefinition>> = {
  "capacity-fit": () => import("./games/capacity-fit").then((m) => m.capacityFit),
  "automation-bundles": () => import("./games/automation-bundles").then((m) => m.automationBundles),
  "sprint-slice": () => import("./games/sprint-slice").then((m) => m.sprintSlice),
  "knowledge-maze": () => import("./games/knowledge-maze").then((m) => m.knowledgeMaze),
  "stack-link": () => import("./games/stack-link").then((m) => m.stackLink),
  "release-run": () => import("./games/release-run").then((m) => m.releaseRun),
};

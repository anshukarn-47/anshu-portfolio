import type { GameDefinition } from "./types";

/**
 * Playable games by registry slug (lib/arcade/registry.ts). Each loads on
 * demand, so a game's page only downloads that game's code.
 */
export const ARCADE_GAME_LOADERS: Record<string, () => Promise<GameDefinition>> = {
  "capacity-fit": () => import("./games/capacity-fit").then((m) => m.capacityFit),
  "automation-bundles": () => import("./games/automation-bundles").then((m) => m.automationBundles),
  "sprint-slice": () => import("./games/sprint-slice").then((m) => m.sprintSlice),
  "neural-maze": () => import("./games/neural-maze").then((m) => m.neuralMaze),
  "stack-link": () => import("./games/stack-link").then((m) => m.stackLink),
  "release-run": () => import("./games/release-run").then((m) => m.releaseRun),
};

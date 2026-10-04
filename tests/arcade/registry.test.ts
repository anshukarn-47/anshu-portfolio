import { describe, expect, it } from "vitest";
import { ARCADE, ARCADE_DURATION, PUBLISHED_GAMES, getArcadeEntry } from "@/lib/arcade/registry";
import { ARCADE_GAME_LOADERS } from "@/components/arcade/games";
import { PROTOTYPES } from "@/lib/prototypes/registry";

describe("arcade registry", () => {
  it("lists the six games in order", () => {
    expect(ARCADE.map((g) => g.slug)).toEqual(["capacity-fit", "automation-bundles", "sprint-slice", "neural-maze", "stack-link", "release-run"]);
  });

  it("has unique slugs, the shared duration and a work record for every game", () => {
    expect(new Set(ARCADE.map((g) => g.slug)).size).toBe(ARCADE.length);
    for (const g of ARCADE) {
      expect(g.duration).toBe(ARCADE_DURATION);
      expect(g.relatedWorkSlug).toBeTruthy();
    }
  });

  it("has a loader for every published game, and none for unknown slugs", () => {
    for (const g of PUBLISHED_GAMES) expect(ARCADE_GAME_LOADERS[g.slug], g.slug).toBeTypeOf("function");
    for (const slug of Object.keys(ARCADE_GAME_LOADERS)) expect(getArcadeEntry(slug), slug).toBeDefined();
  });

  it("only links related simulations that exist in the Prototype lab", () => {
    for (const g of ARCADE) if (g.relatedSimulation) expect(PROTOTYPES.some((p) => p.slug === g.relatedSimulation)).toBe(true);
  });

  it("no longer has Knowledge maze (replaced by Neural Maze)", () => {
    expect(getArcadeEntry("knowledge-maze")).toBeUndefined();
  });
});

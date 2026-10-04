import { describe, expect, it } from "vitest";
import { BACKLOG, BEST_SCORE, CAPACITY, SCORING, healthAfter, reasonFor, scoreSlice } from "@/lib/arcade/games/sprint-slice";

const set = (...ids: string[]) => new Set(ids);

describe("sprint slice", () => {
  it("offers more work than one sprint can hold", () => {
    expect(BACKLOG.reduce((n, i) => n + i.effort, 0)).toBeGreaterThan(CAPACITY * 2);
  });

  it("scores including everything badly, through scope creep", () => {
    const r = scoreSlice(set(...BACKLOG.map((i) => i.id)));
    expect(r.over).toBe(27);
    expect(r.scopePenalty).toBe(27 * SCORING.scopeCreepPerPoint);
    expect(r.score).toBe(-54);
  });

  it("scores including nothing badly too", () => {
    expect(scoreSlice(set()).score).toBe(1);
  });

  it("rewards a balanced sprint over features alone", () => {
    const featuresOnly = scoreSlice(set("S-01", "S-08", "S-12", "S-05")).score;
    const balanced = scoreSlice(set("S-01", "S-03", "S-08", "S-09", "S-11", "S-12")).score;
    expect(featuresOnly).toBe(25);
    expect(balanced).toBe(38);
    expect(balanced).toBe(BEST_SCORE);
  });

  it("drops health faster each time debt is skipped in a row", () => {
    expect(healthAfter(set())).toBe(SCORING.healthStart - 8 - 16 - 24);
    // Including the second debt item resets the run.
    expect(healthAfter(set("S-09"))).toBe(SCORING.healthStart - 8 + 12 - 8);
  });

  it("gives every item a one-line reason either way", () => {
    for (const i of BACKLOG) {
      expect(reasonFor(i, true).length).toBeGreaterThan(10);
      expect(reasonFor(i, false).length).toBeGreaterThan(10);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  CRITICAL_DEFECT,
  ITEMS,
  ROW_UNITS,
  SPRINTS,
  capacityReducer,
  fitsAt,
  initialState,
  itemPoints,
  summarise,
  validStarts,
  type CapacityAction,
  type CapacityState,
  type Placed,
} from "@/lib/arcade/games/capacity-fit";

type Decide = (s: CapacityState) => CapacityAction;
type Bump = (row: Placed[]) => Placed;

/** Plays a whole run with a fixed strategy and returns the final state. */
function play(decide: Decide, bump: Bump = (row) => row[0]) {
  let s = initialState();
  for (let guard = 0; guard < 500 && s.mode !== "done"; guard++) {
    if (s.mode === "make-room") {
      const row = s.rows[s.sprint].filter((p) => p.item.type !== "defect");
      s = capacityReducer(s, { type: "bump", id: bump(row).item.id });
    } else s = capacityReducer(s, decide(s));
  }
  return s;
}

const dropIfFits: Decide = (s) => (validStarts(s.rows[s.sprint], s.active!.units).length ? { type: "drop" } : { type: "defer" });
const lowValue = (s: CapacityState) => s.active!.type === "feature" && (s.active!.value ?? 0) <= 1;
const lowestFirst: Bump = (row) => [...row].sort((a, b) => itemPoints(a.item) - itemPoints(b.item))[0];

describe("capacity fit", () => {
  it("starts on sprint 1 with the first backlog item", () => {
    const s = initialState();
    expect(s.sprint).toBe(0);
    expect(s.active?.id).toBe(ITEMS[0].id);
    expect(s.health).toBe(60);
  });

  it("only places items where they fit", () => {
    expect(fitsAt([], 4, 3)).toBe(false); // 3 + 4 > 6 units
    expect(fitsAt([{ item: ITEMS[0], start: 0 }], 3, 2)).toBe(false); // overlaps
    expect(validStarts([], 6)).toEqual([0]);
    expect(validStarts([], 1)).toHaveLength(ROW_UNITS);
  });

  it("is deterministic: the same play gives the same result", () => {
    const decide: Decide = (s) => (!lowValue(s) || s.active!.type === "defect" ? dropIfFits(s) : { type: "defer" });
    expect(summarise(play(decide, lowestFirst))).toEqual(summarise(play(decide, lowestFirst)));
  });

  it("always brings the critical defect into sprint 3 and pushes planned work into carryover", () => {
    const s = play(dropIfFits);
    const sprint3 = s.shipped.find((x) => x.sprint === 2)!;
    expect(sprint3.items.some((i) => i.id === CRITICAL_DEFECT.id)).toBe(true);
    expect(s.planned[2]).toBeGreaterThan(ROW_UNITS); // planned more than it delivered: something was moved out
  });

  it("ships all four sprints", () => {
    expect(play(dropIfFits).shipped).toHaveLength(SPRINTS);
  });

  it("rewards balanced decisions over filling rows", () => {
    const takeEverything = summarise(play(dropIfFits)).score;
    const skipDebt = summarise(play((s) => (s.active!.type === "debt" ? { type: "defer" } : dropIfFits(s)))).score;
    const balanced = summarise(
      play((s) => (s.active!.type !== "defect" && lowValue(s) ? { type: "defer" } : dropIfFits(s)), lowestFirst)
    ).score;
    const shipAtOnce = summarise(play((s) => (s.active!.type === "defect" ? { type: "drop" } : { type: "ship-now" }))).score;

    expect(balanced).toBe(69);
    expect(skipDebt).toBe(64);
    expect(takeEverything).toBe(58);
    expect(shipAtOnce).toBe(10);
    expect(balanced).toBeGreaterThan(skipDebt);
    expect(skipDebt).toBeGreaterThan(takeEverything);
  });

  it("drops an item where it is when the timer runs out", () => {
    let s = initialState();
    s = capacityReducer(s, { type: "timeout" });
    expect(s.rows[0].map((p) => p.item.id)).toEqual([ITEMS[0].id]);
  });
});

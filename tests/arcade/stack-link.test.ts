import { describe, expect, it } from "vitest";
import { FIELDS, LANES, blockedReason, initialStack, stackReducer, summariseStack, type LaneIndex, type StackState } from "@/lib/arcade/games/stack-link";

type Lane = (s: StackState) => LaneIndex;
type Choice = (s: StackState) => 0 | 1;

function play(pickLane: Lane, choose: Choice) {
  let s = initialStack();
  for (let g = 0; g < 200 && !s.done; g++) {
    s = s.pending ? stackReducer(s, { type: "choose", option: choose(s) }) : stackReducer(s, { type: "place", lane: pickLane(s) });
  }
  return s;
}

const matching: Choice = (s) => FIELDS.find((f) => f.id === s.pending!.card.field)!.options[s.pending!.lane].findIndex((o) => o.ok) as 0 | 1;
const lowestOpenLane: Lane = (s) => {
  const c = s.active!;
  if (c.kind === "connector") return c.lane;
  if (c.kind === "validation") return 0;
  return ([0, 1, 2, 3] as LaneIndex[]).find((l) => !blockedReason(s, c, l)) ?? 0;
};

describe("stack link", () => {
  it("every stage has exactly one matching option per field", () => {
    for (const f of FIELDS) {
      expect(f.options).toHaveLength(LANES.length);
      for (const pair of f.options) expect(pair.filter((o) => o.ok)).toHaveLength(1);
    }
  });

  it("reaches the maximum with sensible lanes and matching choices", () => {
    const r = summariseStack(play(lowestOpenLane, matching));
    expect(r.score).toBe(r.maxScore);
    expect(r.maxScore).toBe(75);
    expect(r.chains).toBe(3);
    expect(r.exceptions).toBe(0);
  });

  it("scores dumping everything in one lane, or mismatching, low", () => {
    expect(summariseStack(play(() => 0, matching)).score).toBe(9);
    expect(summariseStack(play(lowestOpenLane, () => 0)).score).toBe(-37);
  });

  it("won't connect a stage before its upstream stage is mapped", () => {
    const s = initialStack();
    expect(blockedReason(s, s.active!, 2)).toMatch(/isn't mapped/);
    expect(blockedReason(s, s.active!, 0)).toBeNull();
  });

  it("parks a blocked card once, then sets it aside", () => {
    let s = initialStack();
    const first = s.active!.key;
    s = stackReducer(s, { type: "place", lane: 2 });
    expect(s.queue.at(-1)?.key).toBe(first);
    expect(s.retried).toContain(first);
  });
});

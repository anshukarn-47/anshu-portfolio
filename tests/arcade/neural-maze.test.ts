import { describe, expect, it } from "vitest";
import { COLS, DRIFTS, LEVEL, ROWS, isWall, sourceById, type Cell } from "@/lib/arcade/neural-maze/level";
import {
  GROUNDING,
  WINDOW_SLOTS,
  composeAnswer,
  driftStep,
  initialMaze,
  mazeReducer,
  scoreMaze,
  stepToward,
  type MazeAction,
  type MazeOptions,
  type MazeState,
} from "@/lib/arcade/neural-maze/engine";

const NO_DRIFTS: MazeOptions = { relaxed: true, drifts: false };
const key = (c: Cell) => `${c.x},${c.y}`;

/** Shortest path through open cells, optionally steering round other sources. */
function path(from: Cell, to: Cell, avoidSources = true): Cell[] {
  const blocked = new Set(LEVEL.sources.filter((s) => !(s.x === to.x && s.y === to.y)).map(key));
  const prev = new Map<string, Cell | null>([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (c.x === to.x && c.y === to.y) break;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const n = { x: c.x + dx, y: c.y + dy };
      const isCore = n.x === LEVEL.core.x && n.y === LEVEL.core.y && !(to.x === n.x && to.y === n.y);
      if (isWall(n.x, n.y) || prev.has(key(n)) || isCore || (avoidSources && blocked.has(key(n)))) continue;
      prev.set(key(n), c);
      queue.push(n);
    }
  }
  if (!prev.has(key(to))) return [];
  const out: Cell[] = [];
  for (let c: Cell | null = to; c && key(c) !== key(from); c = prev.get(key(c)) ?? null) out.unshift(c);
  return out;
}

/** Walks to each target in turn (sources it isn't heading for are avoided). */
function walk(targets: (Cell | MazeAction)[], opts: MazeOptions = NO_DRIFTS, start: MazeState = initialMaze()) {
  let s = start;
  for (const t of targets) {
    if ("type" in t) {
      s = mazeReducer(s, t, opts);
      continue;
    }
    for (const step of path(s.pos, t)) {
      if (s.phase !== "explore") break;
      s = mazeReducer(s, { type: "move", dx: step.x - s.pos.x, dy: step.y - s.pos.y }, opts);
    }
  }
  return s;
}
const at = (id: string) => {
  const s = sourceById(id);
  return { x: s.x, y: s.y };
};

describe("neural maze: the level", () => {
  it("is an 11 by 9 grid with twelve sources of the right mix", () => {
    expect([COLS, ROWS]).toEqual([11, 9]);
    const counts = LEVEL.sources.reduce<Record<string, number>>((m, s) => ({ ...m, [s.kind]: (m[s.kind] ?? 0) + 1 }), {});
    expect(counts).toEqual({ current: 5, outdated: 3, irrelevant: 2, conflicting: 2 });
  });

  it("can reach every source and the core from the start", () => {
    for (const s of LEVEL.sources) expect(path(LEVEL.start, s, false).length, s.id).toBeGreaterThan(0);
    expect(path(LEVEL.start, LEVEL.core).length).toBeGreaterThan(0);
  });

  it("has a route to the core that passes no source, so collecting is always a choice", () => {
    const route = path(LEVEL.start, LEVEL.core, true);
    expect(route.length).toBeGreaterThan(0);
    expect(route.slice(0, -1).some((c) => LEVEL.sources.some((s) => s.x === c.x && s.y === c.y))).toBe(false);
  });

  it("keeps every patrol on open, adjacent cells", () => {
    for (const d of DRIFTS)
      d.patrol.forEach((c, i) => {
        const n = d.patrol[(i + 1) % d.patrol.length];
        expect(isWall(c.x, c.y)).toBe(false);
        expect(Math.abs(c.x - n.x) + Math.abs(c.y - n.y)).toBe(1);
      });
  });

  it("gives conflicting sources a current source they contradict", () => {
    for (const s of LEVEL.sources.filter((x) => x.kind === "conflicting")) expect(sourceById(s.contradicts!).kind).toBe("current");
  });
});

describe("neural maze: collecting and grounding", () => {
  it("collects on visit and moves the grounding meter by type", () => {
    const s = walk([at("S6"), at("S1")]);
    expect(s.window.map((c) => c.id)).toEqual(["S6", "S1"]);
    expect(s.grounding).toBe(GROUNDING.start + GROUNDING.delta.outdated + GROUNDING.delta.current);
  });

  it("caps the context window, and discard frees a slot", () => {
    let s = walk([at("S6"), at("S9"), at("S1"), at("S11"), at("S2")]);
    expect(s.window).toHaveLength(WINDOW_SLOTS);
    s = walk([at("S3")], NO_DRIFTS, s);
    expect(s.window.some((c) => c.id === "S3")).toBe(false); // full: revealed but not taken
    s = mazeReducer(s, { type: "select", slot: 1 }, NO_DRIFTS);
    s = mazeReducer(s, { type: "discard" }, NO_DRIFTS);
    expect(s.window).toHaveLength(WINDOW_SLOTS - 1);
    expect(s.discarded).toEqual(["S9"]);
  });

  it("moves to the answer step when grounding reaches zero", () => {
    const s = mazeReducer({ ...walk([at("S6")]), grounding: 10 }, { type: "move", dx: 0, dy: 0 }, NO_DRIFTS);
    expect(s.phase).toBe("explore"); // a non-move changes nothing
    const low = walk([at("S9")], NO_DRIFTS, { ...initialMaze(), grounding: 5 });
    expect(low.phase).toBe("answer");
    expect(low.end).toBe("grounding");
  });
});

describe("neural maze: unsupported claims and powers", () => {
  it("steps along a shortest path, breaking ties up, right, down, left", () => {
    expect(stepToward({ x: 2, y: 4 }, { x: 4, y: 4 })).toEqual({ next: { x: 3, y: 4 }, dist: 2 });
  });

  it("swaps a relevant chunk for a stale copy on contact, then rests the claim at its patrol start", () => {
    const s0 = walk([at("S1")]);
    const d1 = DRIFTS[0];
    const placed: MazeState = { ...s0, drifts: [{ id: d1.id, at: s0.pos, patrolIndex: 0, chasing: true, rest: 0 }] };
    const s = driftStep({ ...placed, drifts: [{ ...placed.drifts[0], at: { x: s0.pos.x, y: s0.pos.y + 1 } }] });
    expect(s.contacts).toBe(1);
    expect(s.window.find((c) => c.id === "S1")?.stale).toBe(true);
    expect(s.drifts[0].at).toEqual(d1.patrol[0]);
    expect(s.drifts[0].rest).toBeGreaterThan(0);
  });

  it("costs grounding on contact when no relevant chunk is held", () => {
    const s0 = initialMaze();
    const s = driftStep({ ...s0, drifts: [{ id: "D1", at: { x: 1, y: 0 }, patrolIndex: 0, chasing: true, rest: 0 }] });
    expect(s.grounding).toBe(GROUNDING.start - GROUNDING.contactEmpty);
  });

  it("verify restores a stale chunk, holds claims and adds grounding", () => {
    const stale = { ...walk([at("S1")]), window: [{ id: "S1", stale: true }] };
    const s = mazeReducer(stale, { type: "verify" }, NO_DRIFTS);
    expect(s.window[0].stale).toBe(false);
    expect(s.freezeMoves).toBe(4);
    expect(s.grounding).toBe(stale.grounding + GROUNDING.verify);
    expect(s.verifiesLeft).toBe(1);
  });

  it("semantic search only highlights current sources nearby", () => {
    const s = mazeReducer(walk([{ x: 5, y: 2 }]), { type: "search" }, NO_DRIFTS);
    expect(s.searchLit.length).toBeGreaterThan(0);
    for (const id of s.searchLit) expect(sourceById(id).kind).toBe("current");
  });

  it("brings in the third claim after three weak sources", () => {
    const s = walk([at("S6"), at("S9"), at("S11")], { relaxed: true, drifts: true });
    expect(s.weakCollected).toBeGreaterThanOrEqual(3);
    expect(s.drifts.map((d) => d.id)).toContain("D3");
  });

  it("in relaxed mode, claims move only every second cursor move", () => {
    const opts: MazeOptions = { relaxed: true, drifts: true };
    const s0 = initialMaze();
    const one = mazeReducer(s0, { type: "move", dx: 1, dy: 0 }, opts);
    expect(one.drifts).toEqual(s0.drifts);
    const two = mazeReducer(one, { type: "move", dx: 1, dy: 0 }, opts);
    expect(two.drifts).not.toEqual(s0.drifts);
    expect(mazeReducer(two, { type: "tick" }, opts)).toBe(two); // no timer in relaxed mode
  });
});

describe("neural maze: the answer and the score", () => {
  it("answers Unsupported with no evidence, and scores it zero", () => {
    const s = walk([LEVEL.core]);
    expect(s.phase).toBe("answer");
    expect(composeAnswer(s).status).toBe("Unsupported");
    expect(composeAnswer(s).missing).toHaveLength(3);
    expect(scoreMaze(s).score).toBe(0);
  });

  it("answers Grounded from three current sources", () => {
    const s = walk([at("S1"), at("S3"), at("S2"), LEVEL.core]);
    const r = scoreMaze(s);
    expect(r.answerDetail.status).toBe("Grounded");
    expect(r.score).toBe(92);
  });

  it("flags a stale or conflicting claim and answers Partly supported", () => {
    const s = walk([at("S1"), at("S3"), at("S11"), at("S2"), LEVEL.core]);
    const a = composeAnswer(s);
    expect(a.status).toBe("Partly supported");
    expect(a.lines.find((l) => l.flag?.startsWith("Conflicts with"))).toBeDefined();
  });

  it("never raises the score just by collecting more", () => {
    const base = walk([at("S1"), at("S3"), at("S2")]);
    const more = walk([at("S9")], NO_DRIFTS, base); // add an irrelevant chunk
    expect(scoreMaze(more).score).toBeLessThan(scoreMaze(base).score);
  });

  it("gates the fifth current source behind a weak one", () => {
    // Every route to S5 passes S12 (conflicting) or S8 (outdated): reaching it means collecting junk, then discarding it.
    expect(path(LEVEL.start, at("S5"), true)).toEqual([]);
    expect(path(LEVEL.start, at("S5"), false).length).toBeGreaterThan(0);
  });

  it("reaches 100 with all five current sources once the junk picked up on the way is discarded", () => {
    let s = walk([at("S1"), at("S3"), at("S4"), at("S2"), at("S12")]);
    s = walk([at("S5")], NO_DRIFTS, mazeReducer(s, { type: "discard" }, NO_DRIFTS)); // discard S12, the last slot
    expect(s.window.map((c) => c.id).sort()).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    expect(scoreMaze(s).score).toBe(100);
  });
});

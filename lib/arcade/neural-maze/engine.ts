/**
 * Neural Maze: the rules, as a pure reducer over the fixed level. No
 * randomness: the same inputs always give the same result.
 */

import { COLS, DRIFTS, KEY_SOURCES, LEVEL, ROWS, isWall, sourceById, type Cell, type Kind, type PlacedSource } from "./level";

export const WINDOW_SLOTS = 5;
export const GROUNDING = {
  start: 70,
  delta: { current: 8, outdated: -15, irrelevant: -10, conflicting: -8 } as Record<Kind, number>,
  verify: 10,
  contactEmpty: 5,
} as const;
export const POWERS = { uses: 2, searchRadius: 3, searchMoves: 4, freezeMoves: 4 } as const;
/** An unsupported claim chases once the cursor is this close (in steps along open cells). */
export const CHASE_RANGE = 3;
/** After reaching the cursor, a claim waits at its patrol start for this many of its steps. */
export const REST_STEPS = 6;
/** The third claim appears once this many weak sources have been collected. */
export const THIRD_DRIFT_AFTER = 3;
/** Standard mode: claims step on this fixed tick. */
export const TICK_MS = 450;
/** Relaxed mode: claims step once for every this many cursor moves (slower than the cursor). */
export const RELAXED_MOVES_PER_STEP = 2;

const DIRS: Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
const key = (c: Cell) => `${c.x},${c.y}`;
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export const isWeak = (k: Kind) => k !== "current";

export type Chunk = { id: string; stale: boolean };
export type Drift = { id: string; at: Cell; patrolIndex: number; chasing: boolean; rest: number };

export type MazeState = {
  pos: Cell;
  /** Cells revealed from the fog. */
  explored: string[];
  /** Sources whose type has been revealed by a visit. */
  revealed: string[];
  /** Sources taken off the board (collected, whether or not still in the window). */
  taken: string[];
  window: Chunk[];
  /** The slot Discard applies to. */
  selected: number | null;
  grounding: number;
  weakCollected: number;
  drifts: Drift[];
  thirdSpawned: boolean;
  freezeMoves: number;
  searchMoves: number;
  searchLit: string[];
  searchesLeft: number;
  verifiesLeft: number;
  moves: number;
  contacts: number;
  discarded: string[];
  phase: "explore" | "answer";
  end: "core" | "grounding" | null;
  note: string;
};

function exploreAround(explored: string[], c: Cell) {
  const set = new Set(explored);
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
      const x = c.x + dx;
      const y = c.y + dy;
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS) set.add(`${x},${y}`);
    }
  return [...set];
}

export function initialMaze(): MazeState {
  return {
    pos: LEVEL.start,
    explored: exploreAround([], LEVEL.start),
    revealed: [],
    taken: [],
    window: [],
    selected: null,
    grounding: GROUNDING.start,
    weakCollected: 0,
    drifts: DRIFTS.slice(0, 2).map((d) => ({ id: d.id, at: d.patrol[0], patrolIndex: 0, chasing: false, rest: 0 })),
    thirdSpawned: false,
    freezeMoves: 0,
    searchMoves: 0,
    searchLit: [],
    searchesLeft: POWERS.uses,
    verifiesLeft: POWERS.uses,
    moves: 0,
    contacts: 0,
    discarded: [],
    phase: "explore",
    end: null,
    note: "",
  };
}

export const sourceAt = (c: Cell): PlacedSource | undefined => LEVEL.sources.find((s) => s.x === c.x && s.y === c.y);
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** The first step of a shortest path along open cells from `from` to `to` (ties broken up, right, down, left), and its length. */
export function stepToward(from: Cell, to: Cell): { next: Cell; dist: number } | null {
  if (same(from, to)) return { next: from, dist: 0 };
  const firstStep = new Map<string, Cell>();
  const dist = new Map<string, number>([[key(from), 0]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    for (const d of DIRS) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      if (isWall(n.x, n.y) || dist.has(key(n))) continue;
      dist.set(key(n), dist.get(key(c))! + 1);
      firstStep.set(key(n), same(c, from) ? n : firstStep.get(key(c))!);
      if (same(n, to)) return { next: firstStep.get(key(n))!, dist: dist.get(key(n))! };
      queue.push(n);
    }
  }
  return null;
}

/** A claim reaching the cursor swaps one relevant chunk for a stale copy (or costs grounding if there's none), then returns to its patrol start. */
function contact(s: MazeState): MazeState {
  const hit = s.drifts.filter((d) => same(d.at, s.pos));
  if (!hit.length) return s;
  let st = s;
  for (const d of hit) {
    const i = st.window.findIndex((c) => !c.stale && sourceById(c.id).kind === "current");
    if (i >= 0) {
      const src = sourceById(st.window[i].id);
      st = {
        ...st,
        window: st.window.map((c, j) => (j === i ? { ...c, stale: true } : c)),
        note: `An unsupported claim reached you: "${src.title}" was swapped for a stale copy. Verify can restore it.`,
      };
    } else {
      st = { ...st, grounding: clamp(st.grounding - GROUNDING.contactEmpty), note: `An unsupported claim reached you. Grounding −${GROUNDING.contactEmpty}.` };
    }
    st = {
      ...st,
      contacts: st.contacts + 1,
      drifts: st.drifts.map((x) => (x.id === d.id ? { ...x, at: DRIFTS.find((p) => p.id === d.id)!.patrol[0], patrolIndex: 0, chasing: false, rest: REST_STEPS } : x)),
    };
  }
  return lowGrounding(st);
}

function lowGrounding(s: MazeState): MazeState {
  if (s.grounding > 0 || s.phase !== "explore") return s;
  return { ...s, phase: "answer", end: "grounding", note: "Grounding is low. The answer may not be reliable." };
}

/** One step for every active claim: chase within range, otherwise walk back to and along the patrol loop. */
export function driftStep(s: MazeState): MazeState {
  if (s.phase !== "explore" || s.freezeMoves > 0) return s;
  const drifts = s.drifts.map((d) => {
    if (d.rest > 0) return { ...d, rest: d.rest - 1 };
    const patrol = DRIFTS.find((p) => p.id === d.id)!.patrol;
    const toPlayer = stepToward(d.at, s.pos);
    if (toPlayer && toPlayer.dist <= CHASE_RANGE) return { ...d, at: toPlayer.next, chasing: true };
    const target = patrol[d.patrolIndex];
    if (!same(d.at, target)) {
      const back = stepToward(d.at, target);
      return { ...d, at: back ? back.next : target, chasing: false };
    }
    const nextIndex = (d.patrolIndex + 1) % patrol.length;
    return { ...d, at: patrol[nextIndex], patrolIndex: nextIndex, chasing: false };
  });
  return contact({ ...s, drifts });
}

export type MazeAction =
  | { type: "move"; dx: number; dy: number }
  | { type: "select"; slot: number }
  | { type: "discard" }
  | { type: "search" }
  | { type: "verify" }
  /** Standard mode: the fixed claim tick. */
  | { type: "tick" };

/** Options: relaxed (turn-based claims) and whether unsupported claims are in play. */
export type MazeOptions = { relaxed: boolean; drifts: boolean };

export function mazeReducer(s: MazeState, a: MazeAction, { relaxed, drifts: driftsOn }: MazeOptions): MazeState {
  if (s.phase !== "explore") return s;
  switch (a.type) {
    case "tick":
      return relaxed || !driftsOn ? s : driftStep(s);
    case "select":
      return a.slot < s.window.length ? { ...s, selected: s.selected === a.slot ? null : a.slot } : s;
    case "discard": {
      if (!s.window.length) return s;
      const i = s.selected ?? s.window.length - 1;
      const gone = s.window[i];
      const src = sourceById(gone.id);
      return {
        ...s,
        window: s.window.filter((_, j) => j !== i),
        selected: null,
        discarded: [...s.discarded, gone.id],
        note: `Discarded "${src.title}". ${WINDOW_SLOTS - s.window.length + 1} of ${WINDOW_SLOTS} slots free.`,
      };
    }
    case "search": {
      if (!s.searchesLeft) return s;
      const lit = LEVEL.sources
        .filter((src) => src.kind === "current" && !s.taken.includes(src.id) && Math.abs(src.x - s.pos.x) + Math.abs(src.y - s.pos.y) <= POWERS.searchRadius)
        .map((src) => src.id);
      return {
        ...s,
        searchesLeft: s.searchesLeft - 1,
        searchMoves: POWERS.searchMoves,
        searchLit: lit,
        note: lit.length
          ? `Semantic search highlighted ${lit.length} current, relevant ${lit.length === 1 ? "source" : "sources"} within ${POWERS.searchRadius} steps, for ${POWERS.searchMoves} moves.`
          : `Semantic search found no current, relevant sources within ${POWERS.searchRadius} steps.`,
      };
    }
    case "verify": {
      if (!s.verifiesLeft) return s;
      const i = s.window.findIndex((c) => c.stale);
      const restored = i >= 0 ? sourceById(s.window[i].id).title : null;
      const bonus = s.window.length ? GROUNDING.verify : 0;
      return {
        ...s,
        verifiesLeft: s.verifiesLeft - 1,
        freezeMoves: POWERS.freezeMoves,
        window: i >= 0 ? s.window.map((c, j) => (j === i ? { ...c, stale: false } : c)) : s.window,
        grounding: clamp(s.grounding + bonus),
        note: `Verify: unsupported claims hold still for ${POWERS.freezeMoves} moves.${restored ? ` "${restored}" restored from its source.` : ""}${bonus ? ` Grounding +${bonus}.` : ""}`,
      };
    }
    case "move": {
      const to = { x: s.pos.x + a.dx, y: s.pos.y + a.dy };
      if (Math.abs(a.dx) + Math.abs(a.dy) !== 1 || isWall(to.x, to.y)) return s;
      let st: MazeState = {
        ...s,
        pos: to,
        moves: s.moves + 1,
        explored: exploreAround(s.explored, to),
        freezeMoves: Math.max(0, s.freezeMoves - 1),
        searchMoves: Math.max(0, s.searchMoves - 1),
        searchLit: s.searchMoves > 1 ? s.searchLit : [],
        note: "",
      };
      // A source: its type is revealed, and it's collected if the window has room.
      const src = sourceAt(to);
      if (src && !st.taken.includes(src.id)) {
        st = { ...st, revealed: st.revealed.includes(src.id) ? st.revealed : [...st.revealed, src.id] };
        if (st.window.length < WINDOW_SLOTS) {
          const d = GROUNDING.delta[src.kind];
          const weak = isWeak(src.kind) ? st.weakCollected + 1 : st.weakCollected;
          st = {
            ...st,
            window: [...st.window, { id: src.id, stale: false }],
            taken: [...st.taken, src.id],
            grounding: clamp(st.grounding + d),
            weakCollected: weak,
            note: `${kindSentence(src)} Added to the context window (${st.window.length + 1} of ${WINDOW_SLOTS}). Grounding ${d > 0 ? "+" : "−"}${Math.abs(d)}.`,
          };
          if (driftsOn && !st.thirdSpawned && weak >= THIRD_DRIFT_AFTER) {
            const third = DRIFTS[2];
            st = {
              ...st,
              thirdSpawned: true,
              drifts: [...st.drifts, { id: third.id, at: third.patrol[0], patrolIndex: 0, chasing: false, rest: 0 }],
              note: `${st.note} A third unsupported claim has appeared.`,
            };
          }
        } else {
          st = { ...st, note: `${kindSentence(src)} The context window is full: discard a chunk to take it.` };
        }
      }
      if (same(to, LEVEL.core)) return { ...st, phase: "answer", end: "core", note: "You reached the answer core." };
      if (driftsOn) {
        st = contact(st);
        // Relaxed mode is turn-based: claims move only when you do, and more slowly.
        if (relaxed && st.phase === "explore" && st.moves % RELAXED_MOVES_PER_STEP === 0) st = driftStep(st);
      }
      return lowGrounding(st);
    }
  }
}

function kindSentence(src: PlacedSource) {
  const base = `${src.title} (${src.source}, ${src.date}): ${KIND_SENTENCE[src.kind]}`;
  return src.kind === "conflicting" && src.contradicts ? `${base} It contradicts "${sourceById(src.contradicts).title}".` : base;
}
const KIND_SENTENCE: Record<Kind, string> = {
  current: "current and relevant.",
  outdated: "outdated.",
  irrelevant: "not relevant to the question.",
  conflicting: "conflicting.",
};

// --- The answer and the score -----------------------------------------------------------------------

export type AnswerStatus = "Grounded" | "Partly supported" | "Unsupported";
export type AnswerLine = { text: string; tag: string; flag: string | null; good: boolean };

export function composeAnswer(s: MazeState) {
  const lines: AnswerLine[] = s.window.map((c) => {
    const src = sourceById(c.id);
    if (c.stale) return { text: src.staleClaim ?? src.claim, tag: `${src.source}, stale copy`, flag: `Stale: an old copy of "${src.title}" (${src.source})`, good: false };
    if (src.kind === "outdated") return { text: src.claim, tag: `${src.source}, ${src.date}`, flag: `Stale: "${src.title}" (${src.source}, ${src.date}) is outdated`, good: false };
    if (src.kind === "conflicting")
      return { text: src.claim, tag: `${src.source}, ${src.date}`, flag: `Conflicts with "${sourceById(src.contradicts!).title}" (${sourceById(src.contradicts!).source})`, good: false };
    if (src.kind === "irrelevant") return { text: src.claim, tag: `${src.source}, ${src.date}`, flag: "Off-topic for this question", good: false };
    return { text: src.claim, tag: `${src.source}, ${src.date}`, flag: null, good: true };
  });
  const relevant = s.window.filter((c) => !c.stale && sourceById(c.id).kind === "current");
  const staleIncluded = s.window.some((c) => c.stale || sourceById(c.id).kind === "outdated");
  const conflictIncluded = s.window.some((c) => sourceById(c.id).kind === "conflicting");
  const status: AnswerStatus =
    relevant.length < 2 ? "Unsupported" : relevant.length >= 3 && !staleIncluded && !conflictIncluded ? "Grounded" : "Partly supported";
  const missing = KEY_SOURCES.filter((id) => !relevant.some((c) => c.id === id)).map((id) => sourceById(id).topic!);
  return { lines, status, relevant: relevant.length, staleIncluded, conflictIncluded, missing };
}

export const SCORE_WEIGHTS = { answer: 50, relevance: 30, window: 20 } as const;

/** Answer quality 50%, evidence relevance 30%, context-window use 20%. Collecting more, or moving faster, never raises it by itself. */
export function scoreMaze(s: MazeState) {
  const a = composeAnswer(s);
  const n = s.window.length;
  const answer = a.status === "Grounded" ? SCORE_WEIGHTS.answer : a.status === "Partly supported" ? SCORE_WEIGHTS.answer / 2 : 0;
  // Precision (share of the window that's current and relevant) times coverage (up to three).
  const relevance = n ? SCORE_WEIGHTS.relevance * (a.relevant / n) * Math.min(1, a.relevant / 3) : 0;
  // Slots holding current, relevant evidence, less a little for each slot holding something else.
  const junk = n - a.relevant;
  const windowUse = Math.max(0, (SCORE_WEIGHTS.window * a.relevant) / WINDOW_SLOTS - 4 * junk);
  return {
    answer: Math.round(answer),
    relevance: Math.round(relevance),
    windowUse: Math.round(windowUse),
    score: Math.round(answer + relevance + windowUse),
    maxScore: SCORE_WEIGHTS.answer + SCORE_WEIGHTS.relevance + SCORE_WEIGHTS.window,
    answerDetail: a,
  };
}

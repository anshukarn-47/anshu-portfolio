/**
 * Release run: steer a release down three lanes to a production gate. A fixed
 * course and a pure step function, so the same inputs always give the same
 * result. See docs/arcade-game-rules.md.
 */

export const LANES = 3;
export const COURSE_LENGTH = 900;
/** Units of course visible ahead of the release marker. */
export const VIEW_AHEAD = 120;

export type ItemKind = "test" | "alignment" | "debt" | "scope" | "regression";
export type CourseItem = { id: number; kind: ItemKind; lane: number; at: number; /** Scope creep blocks a stretch of its lane. */ until?: number };

export const ITEM_LABEL: Record<ItemKind, string> = {
  test: "Tests",
  alignment: "Stakeholder alignment",
  debt: "Technical debt",
  scope: "Scope creep",
  regression: "Regression",
};

const raw: Omit<CourseItem, "id">[] = [
  // Before the first fork.
  { kind: "test", lane: 1, at: 40 },
  { kind: "alignment", lane: 0, at: 80 },
  { kind: "debt", lane: 1, at: 110 },
  { kind: "regression", lane: 2, at: 140 },
  { kind: "test", lane: 2, at: 170 },
  { kind: "scope", lane: 0, at: 200, until: 260 },
  // A squeeze: every lane has something here, so pick the least costly.
  { kind: "regression", lane: 1, at: 230 },
  { kind: "debt", lane: 2, at: 230 },
  { kind: "debt", lane: 2, at: 270 },
  // Between the forks: busier.
  { kind: "regression", lane: 0, at: 340 },
  { kind: "regression", lane: 2, at: 360 },
  { kind: "debt", lane: 1, at: 380 },
  { kind: "test", lane: 1, at: 400 },
  { kind: "scope", lane: 1, at: 430, until: 500 },
  // Squeeze.
  { kind: "regression", lane: 0, at: 460 },
  { kind: "debt", lane: 2, at: 460 },
  { kind: "alignment", lane: 2, at: 480 },
  { kind: "debt", lane: 2, at: 520 },
  { kind: "regression", lane: 1, at: 560 },
  { kind: "test", lane: 0, at: 590 },
  // After the second fork.
  { kind: "regression", lane: 2, at: 650 },
  { kind: "debt", lane: 0, at: 680 },
  { kind: "scope", lane: 2, at: 700, until: 760 },
  // Squeeze.
  { kind: "regression", lane: 1, at: 720 },
  { kind: "debt", lane: 0, at: 720 },
  { kind: "test", lane: 0, at: 740 },
  { kind: "regression", lane: 0, at: 790 },
  { kind: "debt", lane: 1, at: 820 },
  { kind: "alignment", lane: 1, at: 850 },
  { kind: "regression", lane: 2, at: 870 },
];
export const COURSE: CourseItem[] = raw.map((c, id) => ({ ...c, id }));

export const FORKS = [300, 620] as const;

export const TUNING = {
  baseSpeed: 16,
  relaxedFactor: 0.55,
  rollout: { fast: { speed: 1.25, risk: 1.5 }, controlled: { speed: 0.8, risk: 0.6 } },
  boost: { factor: 1.4, ms: 4000 },
  debtSlow: { factor: 0.6, ms: 3000 },
  scopeStop: { factor: 0.2, ms: 1500 },
  brake: { factor: 0.5, ms: 3000, health: 15, risk: 1, uses: 2 },
  regressionHealth: 25,
  risk: { debt: 1, scope: 2, regression: 3 },
  maxShields: 2,
  /** Normal mode only: seconds to choose at a fork. */
  forkSeconds: 8,
} as const;

export type Rollout = "fast" | "controlled";
/** At a fork, a controlled rollout matches when risk has built up or health is low; otherwise a fast release does. */
export const FORK_RULE = [
  { riskAtLeast: 3, healthBelow: 70 },
  { riskAtLeast: 4, healthBelow: 60 },
] as const;
export const matchingRollout = (fork: number, risk: number, health: number): Rollout =>
  risk >= FORK_RULE[fork].riskAtLeast || health < FORK_RULE[fork].healthBelow ? "controlled" : "fast";

export type Outcome = "smooth" | "minor" | "rolled-back";
export const OUTCOME_LABEL: Record<Outcome, string> = {
  smooth: "Smooth release",
  minor: "Released with a minor incident",
  "rolled-back": "Rolled back",
};
export const outcomeFor = (risk: number): Outcome => (risk < 5 ? "smooth" : risk < 10 ? "minor" : "rolled-back");

export const POINTS = { forkMatch: 15, outcome: { smooth: 20, minor: 10, "rolled-back": 0 } as Record<Outcome, number>, healthDivisor: 10 } as const;
export const MAX_SCORE = FORKS.length * POINTS.forkMatch + POINTS.outcome.smooth + 100 / POINTS.healthDivisor;

// --- State and step -----------------------------------------------------------------------------------

type Timed = { factor: number; msLeft: number };

export type RunState = {
  traveled: number;
  lane: number;
  health: number;
  shields: number;
  risk: number;
  /** Risk multiplier from the latest fork (1 before any). */
  riskFactor: number;
  speedFactor: number;
  effects: Timed[];
  brakesLeft: number;
  resolved: number[];
  forks: { choice: Rollout; matched: boolean; riskAt: number; healthAt: number; timedOut: boolean }[];
  phase: "run" | "fork" | "done";
  /** Counters for the debrief. */
  tally: { tests: number; absorbed: number; regressions: number; debt: number; scope: number; boosts: number; brakes: number };
  note: string;
};

export const initialRun = (): RunState => ({
  traveled: 0,
  lane: 1,
  health: 100,
  shields: 0,
  risk: 0,
  riskFactor: 1,
  speedFactor: 1,
  effects: [],
  brakesLeft: TUNING.brake.uses,
  resolved: [],
  forks: [],
  phase: "run",
  tally: { tests: 0, absorbed: 0, regressions: 0, debt: 0, scope: 0, boosts: 0, brakes: 0 },
  note: "",
});

export const currentSpeed = (s: RunState, relaxed: boolean) =>
  TUNING.baseSpeed * s.speedFactor * s.effects.reduce((f, e) => f * e.factor, 1) * (relaxed ? TUNING.relaxedFactor : 1);

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Advance the run by `dtMs`. Pure: returns the next state. */
export function stepRun(s: RunState, dtMs: number, relaxed: boolean): RunState {
  if (s.phase !== "run") return s;
  const distance = (currentSpeed(s, relaxed) * dtMs) / 1000;
  let st: RunState = {
    ...s,
    traveled: Math.min(COURSE_LENGTH, s.traveled + distance),
    effects: s.effects.map((e) => ({ ...e, msLeft: e.msLeft - dtMs })).filter((e) => e.msLeft > 0),
  };
  // Items reached on this step, in the marker's lane.
  for (const item of COURSE) {
    if (st.resolved.includes(item.id) || item.at > st.traveled) continue;
    const blockedStretch = item.kind === "scope" && item.until !== undefined && st.traveled <= item.until;
    if (item.lane !== st.lane) {
      // A scope block stays live while its stretch lasts; anything else is passed by.
      if (!blockedStretch) st = { ...st, resolved: [...st.resolved, item.id] };
      continue;
    }
    st = { ...applyItem(st, item), resolved: [...st.resolved, item.id] };
  }
  // A fork.
  const forkIndex = st.forks.length;
  if (forkIndex < FORKS.length && st.traveled >= FORKS[forkIndex]) {
    return { ...st, traveled: FORKS[forkIndex], phase: "fork", note: `Fork ${forkIndex + 1}: choose how to release from here.` };
  }
  if (st.traveled >= COURSE_LENGTH) return { ...st, phase: "done", note: gateNote(st) };
  return st;
}

function applyItem(s: RunState, item: CourseItem): RunState {
  const t = s.tally;
  switch (item.kind) {
    case "test":
      return { ...s, shields: Math.min(TUNING.maxShields, s.shields + 1), tally: { ...t, tests: t.tests + 1 }, note: "Tests picked up: the next regression is caught." };
    case "alignment":
      return {
        ...s,
        effects: [...s.effects, { factor: TUNING.boost.factor, msLeft: TUNING.boost.ms }],
        tally: { ...t, boosts: t.boosts + 1 },
        note: "Stakeholders aligned: a short burst of speed.",
      };
    case "debt": {
      const add = TUNING.risk.debt * s.riskFactor;
      return {
        ...s,
        risk: round1(s.risk + add),
        effects: [...s.effects, { factor: TUNING.debtSlow.factor, msLeft: TUNING.debtSlow.ms }],
        tally: { ...t, debt: t.debt + 1 },
        note: `Technical debt slows the release. Risk +${round1(add)}.`,
      };
    }
    case "scope": {
      const add = TUNING.risk.scope * s.riskFactor;
      return {
        ...s,
        risk: round1(s.risk + add),
        effects: [...s.effects, { factor: TUNING.scopeStop.factor, msLeft: TUNING.scopeStop.ms }],
        tally: { ...t, scope: t.scope + 1 },
        note: `Scope creep blocks this lane and holds the release up. Risk +${round1(add)}.`,
      };
    }
    case "regression": {
      if (s.shields > 0) return { ...s, shields: s.shields - 1, tally: { ...t, absorbed: t.absorbed + 1 }, note: "A regression was caught by the tests. No harm done." };
      const add = TUNING.risk.regression * s.riskFactor;
      return {
        ...s,
        health: Math.max(0, s.health - TUNING.regressionHealth),
        risk: round1(s.risk + add),
        tally: { ...t, regressions: t.regressions + 1 },
        note: `A regression got through: health −${TUNING.regressionHealth}, risk +${round1(add)}.`,
      };
    }
  }
}

export function chooseRollout(s: RunState, choice: Rollout, timedOut = false): RunState {
  if (s.phase !== "fork") return s;
  const fork = s.forks.length;
  const match = matchingRollout(fork, s.risk, s.health);
  const r = TUNING.rollout[choice];
  return {
    ...s,
    phase: "run",
    speedFactor: r.speed,
    riskFactor: r.risk,
    forks: [...s.forks, { choice, matched: choice === match, riskAt: s.risk, healthAt: s.health, timedOut }],
    note: `${timedOut ? "No choice in time, so: " : ""}${choice === "fast" ? "Fast release: full speed, and new risk counts for more." : "Controlled rollout: staged and slower, and new risk counts for less."}`,
  };
}

export function brake(s: RunState): RunState {
  if (s.phase !== "run" || s.brakesLeft <= 0) return s;
  return {
    ...s,
    brakesLeft: s.brakesLeft - 1,
    health: Math.min(100, s.health + TUNING.brake.health),
    risk: round1(Math.max(0, s.risk - TUNING.brake.risk)),
    effects: [...s.effects, { factor: TUNING.brake.factor, msLeft: TUNING.brake.ms }],
    tally: { ...s.tally, brakes: s.tally.brakes + 1 },
    note: `Rollback brake: slower for a moment, health +${TUNING.brake.health}, risk −${TUNING.brake.risk}.`,
  };
}

export const changeLane = (s: RunState, lane: number): RunState => (s.phase !== "run" ? s : { ...s, lane: Math.max(0, Math.min(LANES - 1, lane)) });

function gateNote(s: RunState) {
  const o = outcomeFor(s.risk);
  return `At the gate: ${OUTCOME_LABEL[o].toLowerCase()}. Accumulated risk ${s.risk}.`;
}

export function scoreRun(s: RunState) {
  const outcome = outcomeFor(s.risk);
  const matches = s.forks.filter((f) => f.matched).length;
  const healthPoints = Math.round(s.health / POINTS.healthDivisor);
  return {
    outcome,
    matches,
    healthPoints,
    score: matches * POINTS.forkMatch + POINTS.outcome[outcome] + healthPoints,
    maxScore: MAX_SCORE,
  };
}

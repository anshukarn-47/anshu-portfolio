import { describe, expect, it } from "vitest";
import {
  DATA_REQUEST_SECONDS,
  DECISIONS,
  FIRST_DECISION_AT,
  INITIAL_STATE,
  MOBILE_SURGE,
  QUESTIONS,
  QUESTION_SLOTS,
  RECOVERY_WAIT_MAX,
  ROUND_TIME_SECONDS,
  comparePaths,
  formatClock,
  healthStatus,
  reducer,
  timeLeft,
  type Action,
  type CrisisState,
} from "@/components/prototypes/crisis-simulator/model";

const run = (s: CrisisState, ...actions: Action[]) => actions.reduce(reducer, s);
const tick = (s: CrisisState, n = 1) => Array.from({ length: n }).reduce<CrisisState>((x) => reducer(x, { type: "tick" }), s);
/** Ticks until a round is waiting for a decision. */
const toRound = (s: CrisisState) => {
  let x = s;
  for (let i = 0; i < 200 && x.pendingSince === null && x.phase === "war-room"; i++) x = tick(x);
  return x;
};
const enter = () => reducer(INITIAL_STATE, { type: "enter" });

/** The real side, as the work record words it (protect core booking and emergency; deprioritise non-critical features). */
const REAL = { protectText: "Protect core booking and emergency functions", deprioritiseText: "Deprioritised non-critical features in real time." };

describe("crisis simulator: rounds and timing", () => {
  it("enters the war room and keeps the No rush preference across restarts", () => {
    const s = reducer({ ...INITIAL_STATE, noRush: true }, { type: "enter" });
    expect(s.phase).toBe("war-room");
    expect(s.run).toBe(1);
    expect(s.noRush).toBe(true);
  });

  it("brings round 1 after the opening seconds, and ignores choices before then", () => {
    const s = enter();
    expect(reducer(s, { type: "choose", optionId: "deprioritise" })).toBe(s);
    const r1 = toRound(s);
    expect(r1.seconds).toBe(FIRST_DECISION_AT);
    expect(r1.decisionIndex).toBe(0);
    expect(timeLeft(r1)).toBe(ROUND_TIME_SECONDS);
  });

  it("deprioritising stabilises core booking and emergency and pauses the rest", () => {
    const s = run(toRound(enter()), { type: "choose", optionId: "deprioritise" });
    expect(s.functions).toMatchObject({ booking: "stable", emergency: "stable", loyalty: "shed", analytics: "shed" });
    expect(s.paused).toEqual(["loyalty", "analytics"]);
    expect(s.health.api).toBe(INITIAL_STATE.health.api - 7);
    expect(s.decisionLog).toHaveLength(1);
    expect(s.choices[0]).toEqual({ decisionId: "api-utilization", label: "Deprioritise non-critical features" });
  });

  it("lands the mobile surge as an event round, which takes a deck action rather than a choice", () => {
    const afterR1 = run(toRound(enter()), { type: "choose", optionId: "deprioritise" });
    const r2 = toRound(afterR1);
    expect(DECISIONS[r2.decisionIndex].kind).toBe("event");
    expect(r2.signal).toEqual({ from: INITIAL_STATE.traffic.mobile, to: Math.round(INITIAL_STATE.traffic.mobile * (1 + MOBILE_SURGE)) });
    expect(reducer(r2, { type: "choose", optionId: "restore-loyalty" })).toBe(r2);
    const acted = reducer(r2, { type: "act", action: "throttle", target: "mobile" });
    expect(acted.decisionIndex).toBe(2);
    // Loyalty was paused, so Leadership asks about it once, after the event round.
    expect(acted.commsTriggered).toBe(true);
    expect(acted.interruptions.at(-1)?.kind).toBe("comms");
  });

  it("applies no decision when time runs out with nothing selected, and the load keeps building", () => {
    const r1 = toRound(enter());
    const s = tick(r1, ROUND_TIME_SECONDS);
    expect(s.choices[0].label).toBe("No decision: time ran out");
    expect(s.health.api).toBeGreaterThan(r1.health.api);
  });

  it("applies the drafted option when time runs out", () => {
    const r1 = run(toRound(enter()), { type: "draft", draft: { optionId: "deprioritise" } });
    const s = tick(r1, ROUND_TIME_SECONDS);
    expect(s.choices[0].label).toBe("Deprioritise non-critical features");
  });

  it("stops the countdown in No rush", () => {
    const r1 = toRound(run(enter(), { type: "setNoRush", noRush: true }));
    const s = tick(r1, ROUND_TIME_SECONDS * 2);
    expect(s.decisionIndex).toBe(0);
    expect(s.pendingSince).not.toBeNull();
    expect(timeLeft(s)).toBe(ROUND_TIME_SECONDS);
  });
});

describe("crisis simulator: information", () => {
  it("charges data requests to the open round, once per signal", () => {
    const r1 = toRound(enter());
    const s = run(r1, { type: "requestData", signal: "dbSaturation" });
    expect(s.roundElapsed).toBe(r1.roundElapsed + DATA_REQUEST_SECONDS);
    expect(run(s, { type: "requestData", signal: "dbSaturation" })).toBe(s);
  });

  it("charges a data request between rounds to the next round", () => {
    const s = run(enter(), { type: "requestData", signal: "errorDistribution" });
    expect(s.carryPenalty).toBe(DATA_REQUEST_SECONDS);
    expect(toRound(s).roundElapsed).toBe(DATA_REQUEST_SECONDS);
  });

  it("allows a limited number of questions to Engineering, each revealing its signal", () => {
    let s = enter();
    for (const q of QUESTIONS) s = reducer(s, { type: "ask", question: q.id });
    expect(s.asked).toHaveLength(QUESTION_SLOTS);
    for (const id of s.asked) expect(s.revealed).toContain(QUESTIONS.find((q) => q.id === id)!.reveals);
    expect(s.stakeholders.engineering).toBe("engaged");
  });
});

describe("crisis simulator: saturation and recovery", () => {
  it("fails emergency past 98% API load and takes booking down at 100%", () => {
    const base: CrisisState = { ...enter(), functions: { ...INITIAL_STATE.functions, emergency: "stable", booking: "stable" } };
    const at98 = tick({ ...base, health: { ...base.health, api: 98 } });
    expect(at98.functions.emergency).toBe("degraded");
    const at100 = tick({ ...base, health: { ...base.health, api: 100 } });
    expect(at100.functions.booking).toBe("down");
    expect(at100.meters.availability).toBeLessThan(base.meters.availability);
  });

  it("never locks the player out: an unstable platform closes the incident without a recovery round", () => {
    const s: CrisisState = {
      ...enter(),
      decisionIndex: 2,
      pendingSince: null,
      nextAt: 0,
      functions: { ...INITIAL_STATE.functions, booking: "down" },
      health: { ...INITIAL_STATE.health, api: 99 },
    };
    const end = tick(s, RECOVERY_WAIT_MAX + 1);
    expect(end.phase).toBe("debrief");
    expect(end.log.at(-1)?.text).toMatch(/never stabilised/);
  });
});

describe("crisis simulator: the comparison and labels", () => {
  it("overlaps with the documented approach when core is protected and non-critical work paused", () => {
    const s = run(toRound(enter()), { type: "choose", optionId: "deprioritise" });
    expect(comparePaths(s, REAL).overlap).toBe("overlaps");
  });

  it("describes pausing everything as a different route, without grading it", () => {
    const s = run(toRound(enter()), { type: "choose", optionId: "pause-all" });
    const c = comparePaths(s, REAL);
    expect(c.overlap).toBe("different");
    expect(c.line).not.toMatch(/wrong|bad|fail/i);
  });

  it("uses the stated health thresholds and clock format", () => {
    expect([74, 75, 90, 91].map(healthStatus)).toEqual(["stable", "warning", "warning", "critical"]);
    expect(formatClock(75)).toBe("01:15");
  });
});

import { describe, expect, it } from "vitest";
import {
  COURSE,
  TUNING,
  brake,
  changeLane,
  chooseRollout,
  initialRun,
  matchingRollout,
  outcomeFor,
  scoreRun,
  stepRun,
  type Rollout,
  type RunState,
} from "@/lib/arcade/games/release-run";

/** Drives a whole run at 60 steps a second with a steering rule and a fork rule. */
function drive(steer: (s: RunState) => number, fork: (s: RunState) => Rollout) {
  let s = initialRun();
  for (let t = 0; s.phase !== "done" && t < 400_000; t += 1000 / 60) {
    if (s.phase === "fork") {
      s = chooseRollout(s, fork(s));
      continue;
    }
    const lane = steer(s);
    if (lane !== s.lane) s = changeLane(s, lane);
    s = stepRun(s, 1000 / 60, false);
  }
  return s;
}

/** Looks a little way ahead: avoid hazards, prefer pickups. */
const dodge = (s: RunState) => {
  const near = COURSE.filter((c) => !s.resolved.includes(c.id) && c.at - s.traveled < 25 && (c.until ?? c.at) >= s.traveled);
  const bad = (l: number) => near.some((c) => c.lane === l && ["debt", "scope", "regression"].includes(c.kind));
  const good = (l: number) => near.some((c) => c.lane === l && ["test", "alignment"].includes(c.kind));
  const order = [s.lane, 0, 1, 2];
  return order.find((l) => !bad(l) && good(l)) ?? order.find((l) => !bad(l)) ?? s.lane;
};
const matched = (s: RunState) => matchingRollout(s.forks.length, s.risk, s.health);

describe("release run", () => {
  it("reads the gate from accumulated risk", () => {
    expect(outcomeFor(0)).toBe("smooth");
    expect(outcomeFor(4.9)).toBe("smooth");
    expect(outcomeFor(5)).toBe("minor");
    expect(outcomeFor(10)).toBe("rolled-back");
  });

  it("scores matching the rollout to the risk, not speed", () => {
    const skilled = scoreRun(drive(dodge, matched));
    const skilledCautious = scoreRun(drive(dodge, () => "controlled"));
    const middleFast = scoreRun(drive(() => 1, () => "fast"));
    const middleMatched = scoreRun(drive(() => 1, matched));
    expect(skilled.score).toBe(60);
    expect(skilledCautious.score).toBe(30); // same smooth outcome, but more caution than the risk called for
    expect(middleFast.score).toBe(23);
    expect(middleFast.outcome).toBe("rolled-back");
    expect(middleMatched.score).toBe(48);
    expect(middleMatched.score).toBeGreaterThan(middleFast.score);
  });

  it("stops at each fork until a rollout is chosen", () => {
    let s = initialRun();
    for (let i = 0; i < 10_000 && s.phase === "run"; i++) s = stepRun(s, 1000 / 60, false);
    expect(s.phase).toBe("fork");
    const after = chooseRollout(s, "controlled");
    expect(after.phase).toBe("run");
    expect(after.riskFactor).toBe(TUNING.rollout.controlled.risk);
  });

  it("lets a shield absorb a regression", () => {
    const s = { ...initialRun(), shields: 1, traveled: 139, lane: 2 };
    const next = stepRun(s, 1000, false); // reaches the regression at 140 in lane 2
    expect(next.shields).toBe(0);
    expect(next.health).toBe(100);
    expect(next.tally.absorbed).toBe(1);
  });

  it("applies the brake: health back, risk down, limited uses", () => {
    let s = { ...initialRun(), health: 50, risk: 3 };
    s = brake(s);
    expect(s.health).toBe(50 + TUNING.brake.health);
    expect(s.risk).toBe(2);
    s = brake(brake(s));
    expect(s.brakesLeft).toBe(0);
    expect(s.tally.brakes).toBe(TUNING.brake.uses);
  });
});

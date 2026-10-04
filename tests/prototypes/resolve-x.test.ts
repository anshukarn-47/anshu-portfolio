import { describe, expect, it } from "vitest";
import {
  ACTION_MINUTES,
  CHIPS,
  INCIDENTS,
  PATTERN_START,
  PRIORITY_MATRIX,
  REASSIGNMENT,
  RULE_START,
  SLA_TARGET_MINUTES,
  WORKAROUND,
  applyAction,
  computeMetrics,
  csatChange,
  improvementsFromLog,
  knowledgeAcceptEntries,
  metricState,
  minutesLeft,
  patternOpenCount,
  problemCard,
  repeatCount,
  repeatFromLog,
  routeIncident,
  simulateRule,
  slaStateOf,
  type DecisionLogEntry,
  type RoutedIncident,
  type Rule,
  type Triage,
} from "@/components/prototypes/resolve-x/model";

const T0 = 8 * 60;
const incident = (id: string) => INCIDENTS.find((i) => i.id === id)!;
const triage = (team: Triage["team"], impact: Triage["impact"] = "multiple", urgency: Triage["urgency"] = "high"): Triage => ({
  category: "Application",
  impact,
  urgency,
  team,
});
/** Applies actions in order and returns the incident with its work, plus the log entries. */
function work(r: RoutedIncident, actions: Parameters<typeof applyAction>[1][], now = T0 + 1) {
  let cur = r;
  const entries: DecisionLogEntry[] = [];
  for (const a of actions) {
    const out = applyAction(cur, a, now);
    cur = { ...cur, work: out.work };
    entries.push(...out.entries);
  }
  return { r: cur, entries };
}

describe("RESOLVE//X: triage and the SLA clock", () => {
  it("derives priority from impact and urgency, and the SLA target from priority", () => {
    expect(PRIORITY_MATRIX["business-unit"].high).toBe("P1");
    expect(PRIORITY_MATRIX.single.low).toBe("P4");
    expect(SLA_TARGET_MINUTES.P1).toBe(15);
  });

  it("routes to the chosen team, or reassigns to the best fit at a cost", () => {
    const right = routeIncident(incident("INC-1041"), triage("identity"), T0);
    expect(right).toMatchObject({ team: "identity", hops: 0, penaltyMinutes: 0, priority: "P2", target: 30 });
    const wrong = routeIncident(incident("INC-1041"), triage("service-desk"), T0);
    expect(wrong).toMatchObject({ chosenTeam: "service-desk", team: "identity", hops: REASSIGNMENT.hops, penaltyMinutes: REASSIGNMENT.minutes });
    // The brief fixes a reassignment at one hop and 6 simulated minutes off a 30-minute P2 target.
    expect(minutesLeft(wrong, T0)).toBe(24);
  });

  it("moves from healthy to at risk to breached as time passes", () => {
    const r = routeIncident(incident("INC-1044"), triage("app-support"), T0);
    expect(slaStateOf(r, T0)).toBe("healthy");
    expect(slaStateOf(r, T0 + 20)).toBe("at-risk");
    expect(slaStateOf(r, T0 + 30)).toBe("breached");
  });
});

describe("RESOLVE//X: resolution", () => {
  it("resolves at first contact with an existing knowledge article", () => {
    const { r } = work(routeIncident(incident("INC-1041"), triage("identity"), T0), ["knowledge"]);
    expect(r.work.resolution).toMatchObject({ by: "knowledge", firstContact: true, withinTarget: true, csat: 5 });
    // The clock freezes once resolved.
    expect(minutesLeft(r, T0 + 500)).toBe(minutesLeft(r, T0 + 1));
  });

  it("charges a missed article, and asking the user can unlock one (but it's no longer first contact)", () => {
    const base = routeIncident(incident("INC-1044"), triage("app-support"), T0);
    const miss = work(base, ["knowledge"]).r;
    expect(miss.work.articleMisses).toBe(1);
    expect(miss.work.spent).toBe(ACTION_MINUTES.knowledgeMiss);
    const { r } = work(base, ["request-info", "knowledge"]);
    expect(r.work.article?.id).toBe("KB-0342");
    expect(r.work.resolution).toMatchObject({ firstContact: false, csat: 4.75 });
  });

  it("escalates faster after an investigation", () => {
    const base = routeIncident(incident("INC-1048"), triage("app-support"), T0);
    const cold = work(base, ["escalate"]).r.work.resolution!;
    const warm = work(base, ["investigate", "escalate"]).r.work.resolution!;
    expect(cold.minutes).toBe(1 + ACTION_MINUTES.escalate);
    expect(warm.minutes).toBe(1 + ACTION_MINUTES.investigate + ACTION_MINUTES.escalateWithContext);
    expect(cold.csat).toBe(4.5);
  });

  it("counts a breach against CSAT", () => {
    const { r } = work(routeIncident(incident("INC-1048"), triage("app-support"), T0), ["escalate"], T0 + 40);
    expect(r.work.resolution).toMatchObject({ withinTarget: false, csat: 3.5 });
  });

  it("computes the shift metrics from resolved entries in the log", () => {
    const a = work(routeIncident(incident("INC-1041"), triage("identity"), T0), ["knowledge"]).entries;
    const b = work(routeIncident(incident("INC-1048"), triage("app-support"), T0), ["escalate"]).entries;
    expect(computeMetrics([])).toBeNull();
    expect(computeMetrics([...a, ...b])).toEqual({ sla: 100, fcr: 50, time: Math.round((7 + 21) / 2), csat: 4.8 });
    expect(metricState("sla", 90)).toBe("on-target");
    expect(metricState("time", 61)).toBe("below-target");
  });
});

describe("RESOLVE//X: the pattern, knowledge and automation", () => {
  it("counts repeat and open incidents, and a workaround gives short relief", () => {
    expect(repeatCount(PATTERN_START)).toBe(7);
    expect(patternOpenCount(PATTERN_START)).toBe(6);
    expect(patternOpenCount({ ...PATTERN_START, relief: WORKAROUND.relief })).toBe(6 - WORKAROUND.relief);
  });

  it("names the knowledge article on the problem record once it's accepted", () => {
    const lines = problemCard({ ...PATTERN_START, problemOpen: true, knowledge: "accepted" }).lines;
    expect(lines.at(-1)).toMatch(/KB-204/);
    const entries = knowledgeAcceptEntries(T0);
    expect(entries.filter((e) => e.kind === "resolved").every((e) => e.resolution?.firstContact)).toBe(true);
  });

  it("rewards a narrow automation rule and describes a broad one as noisy", () => {
    const good: Rule = { ...RULE_START, n: 5, if: "pattern", then: ["problem", "notify", "article"] };
    const g = simulateRule(good, 7);
    expect(g.verdict).toBe("absorbed");
    expect(g.extraProblems).toHaveLength(0);
    expect(g.repeatAfter).toBe(7);
    expect(g.minutesWith).toBeLessThan(g.minutesWithout);

    expect(simulateRule({ ...good, n: 3 }, 7).verdict).toBe("noisy");
    const unit = simulateRule({ ...good, if: "unit" }, 7);
    expect(unit.verdict).toBe("noisy");
    expect(unit.paymentLinked).toBe(0);
    expect(simulateRule({ ...good, when: "p1" }, 7).verdict).toBe("none");
  });

  it("is deterministic", () => {
    const rule: Rule = { ...RULE_START, n: 4, if: "pattern", then: ["problem", "notify"] };
    expect(simulateRule(rule, 7)).toEqual(simulateRule(rule, 7));
  });
});

describe("RESOLVE//X: the customer update and the shift summary", () => {
  it("adds the fixed chip weights: clear chips raise the simulated CSAT change, jargon and promises lower it", () => {
    const clear = CHIPS.filter((c) => c.weight > 0).map((c) => c.id);
    expect(csatChange(clear)).toBe(1.6);
    expect(csatChange([...clear, "jargon"])).toBe(1.2);
    expect(csatChange(["promise"])).toBeLessThan(0);
  });

  it("lists only the improvements actually made, from the log", () => {
    const routed = routeIncident(incident("INC-1041"), triage("identity"), T0);
    const log: DecisionLogEntry[] = [
      { time: "08:00", incidentId: "INC-1041", kind: "triage", decision: "Routed to Identity and access", consequence: "" },
      ...work(routed, ["knowledge"]).entries,
    ];
    const items = improvementsFromLog(log);
    expect(items.some((i) => /Routed 1 incident/.test(i))).toBe(true);
    expect(items.some((i) => /knowledge-assisted/.test(i))).toBe(true);
    expect(items.some((i) => /problem record/.test(i))).toBe(false);
    expect(repeatFromLog(log)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  BALANCE_START,
  ORDERS,
  balanceChanges,
  balanceFrom,
  dispatchImpact,
  fits,
  leftBehindRisk,
  orderById,
  truckById,
  truckUnavailableReason,
  type DecisionLogEntry,
} from "@/components/prototypes/control-tower/model";
import {
  consolidation,
  currentQueue,
  parseDispatcherState,
  ruleEffect,
  type DispatcherState,
  type Rule,
} from "@/components/prototypes/control-tower/strategy";
import { DAY_PLAN_TRUCKS, FLEET_TOTAL, operatingStyle, principleOf, shiftSummary } from "@/components/prototypes/control-tower/ending";

const STATE: DispatcherState = { m1Loaded: null, m2: null, rules: [], consolidated: [], rejected: [] };

describe("control tower: trucks and orders", () => {
  it("only offers available fuel trucks for today's orders", () => {
    expect(truckUnavailableReason(truckById("TK-07"))).toBeNull();
    expect(truckUnavailableReason(truckById("TK-21"))).toBe("In transit");
    expect(truckUnavailableReason(truckById("TK-18"))).toBe("Petrochemical only");
  });

  it("checks capacity before loading", () => {
    expect(fits(truckById("TK-12"), ["4822"], "4825")).toBe(true); // 12 + 9 of 24 KL
    expect(fits(truckById("TK-12"), ["4822"], "4827")).toBe(false); // 12 + 15
  });

  it("rates left-behind orders by their slack for the next truck", () => {
    expect(leftBehindRisk(orderById("4821"))).toBe("critical"); // 4 h SLA
    expect(leftBehindRisk(orderById("4827"))).toBe("at-risk"); // 5 h
    expect(leftBehindRisk(orderById("4822"))).toBe("normal"); // 6 h
  });

  it("computes dispatch impact from the truck and the orders on it", () => {
    const i = dispatchImpact("TK-44", ["4821", "4827"]);
    expect(i.load).toBe(53);
    expect(i.utilisation).toBe(88);
    expect(i.consolidatedCost).toBe(48_000 + 3_000);
    expect(i.avoidedCost).toBe(40_000 + 21_000 - 51_000);
    expect(i.newExceptions).toBe(0);
  });

  it("counts SLA risk for what's left behind", () => {
    const i = dispatchImpact("TK-12", ["4822"]);
    expect(i.newCritical).toBe(1); // 4821
    expect(i.slaDelta).toBe(-(4 + 1.5)); // one critical, one at risk
  });
});

describe("control tower: the balance", () => {
  it("adds a fixed change per decision", () => {
    const changes = balanceChanges(dispatchImpact("TK-44", ["4821", "4827"]), "reroute");
    expect(balanceFrom(changes)).toEqual({
      service: BALANCE_START.service - 3 + 8,
      cost: BALANCE_START.cost - 8 + 10,
      capacity: BALANCE_START.capacity,
      risk: BALANCE_START.risk,
    });
  });

  it("keeps every axis between 0 and 100", () => {
    const b = balanceFrom(Array.from({ length: 20 }, () => ({ source: "x", reason: "x", deltas: { service: 50, risk: -50 } })));
    expect(b.service).toBe(100);
    expect(b.risk).toBe(0);
  });
});

describe("control tower: queue, policy and consolidation", () => {
  it("builds the queue from the afternoon list plus Mission 01's left-behind orders", () => {
    expect(currentQueue(STATE)).toHaveLength(7);
    const withM1 = currentQueue({ ...STATE, m1Loaded: ["4821", "4827"] });
    expect(withM1).toHaveLength(7 + ORDERS.length - 2);
    expect(currentQueue({ ...STATE, consolidated: ["5136"] }).some((q) => q.id === "5136")).toBe(false);
  });

  it("caps a broad rule's effect at three shipments", () => {
    const broad: Rule = { when: { kind: "utilisation", below: 60 }, and: null, then: "expedite" };
    const e = ruleEffect(broad, currentQueue(STATE), null);
    expect(e.matched.length).toBeGreaterThan(3);
    expect(e.cost).toBe(6_000 * 3);
  });

  it("leaves a rule armed when nothing matches", () => {
    const none: Rule = { when: { kind: "priority", value: "Critical" }, and: { kind: "utilisation", below: 40 }, then: "notify" };
    const e = ruleEffect(none, currentQueue(STATE), null);
    expect(e.matched).toEqual([]);
    expect(e.balance).toBeNull();
  });

  it("proposes only feasible pairs, with exact savings, and says why others are ruled out", () => {
    const { candidates, ruledOut } = consolidation(STATE);
    expect(candidates.find((c) => c.id === "5136+5137")?.saving).toBe(13_000 - 3_000); // same customer: no detour
    expect(candidates.find((c) => c.id === "5132+5134")?.saving).toBe(14_500 - 3_000 - 4_000); // two customers
    expect(ruledOut.find((r) => r.pair === "5131+5135")?.reason).toMatch(/SLA can't wait/);
    for (const c of candidates) {
      expect(c.load).toBeLessThanOrEqual(24);
      expect([c.a.priority, c.b.priority]).not.toContain("Critical");
    }
  });

  it("doesn't propose a pair the dispatcher already rejected", () => {
    const { candidates, ruledOut } = consolidation({ ...STATE, rejected: ["5136+5137"] });
    expect(candidates.some((c) => c.id === "5136+5137")).toBe(false);
    expect(ruledOut.find((r) => r.pair === "5136+5137")?.reason).toMatch(/already rejected/);
  });
});

describe("control tower: validating state sent to /api/chat", () => {
  const valid = {
    m1Loaded: ["4821", "4827"],
    m2: "reroute",
    rules: [{ when: { kind: "priority", value: "Critical" }, and: null, then: "expedite" }],
    consolidated: ["5136"],
    rejected: ["5132+5134"],
  };

  it("accepts a well-formed state", () => {
    expect(parseDispatcherState(valid)).toEqual(valid);
    expect(parseDispatcherState({ ...valid, m1Loaded: null, m2: null })).not.toBeNull();
  });

  it.each([
    ["not an object", "hello"],
    ["unknown order id", { ...valid, m1Loaded: ["9999"] }],
    ["unknown exception choice", { ...valid, m2: "teleport" }],
    ["too many rules", { ...valid, rules: [valid.rules[0], valid.rules[0], valid.rules[0]] }],
    ["unknown rule action", { ...valid, rules: [{ ...valid.rules[0], then: "delete-everything" }] }],
    ["unknown threshold", { ...valid, rules: [{ when: { kind: "utilisation", below: 55 }, and: null, then: "notify" }] }],
    ["malformed rejected pair", { ...valid, rejected: ["5132; DROP TABLE"] }],
    ["unknown consolidated id", { ...valid, consolidated: ["1234"] }],
  ])("rejects %s", (_label, input) => {
    expect(parseDispatcherState(input)).toBeNull();
  });
});

describe("control tower: end of shift", () => {
  const log: DecisionLogEntry[] = [
    { time: "T+01:00", description: "", kind: "dispatch", impact: "", tally: { shipments: 3, trucks: 1, consolidated: 2 }, run: { load: 53, capacity: 60 } },
    { time: "T+02:00", description: "", kind: "investigate", choice: "fleet-ops", impact: "", tally: { investigateMinutes: 4 } },
    { time: "T+03:00", description: "", kind: "investigate", choice: "route", impact: "", tally: { investigateMinutes: 3 } },
    { time: "T+04:00", description: "", kind: "exception", choice: "reroute", impact: "", tally: { resolved: 1, criticalProtected: 1 } },
  ];

  it("totals the shift from the log", () => {
    const s = shiftSummary(log, { sla: 96, cost: 120_000 });
    expect(s.shipments).toBe(3);
    expect(s.loadUtilisation).toBe(Math.round((53 / 60) * 100));
    expect(s.fleetUtilisation).toBe(Math.round(((DAY_PLAN_TRUCKS + 1) / FLEET_TOTAL) * 100));
    expect(shiftSummary([], { sla: 0, cost: 0 }).loadUtilisation).toBeNull();
  });

  it("describes up to three patterns, never as a score", () => {
    const style = operatingStyle(log);
    expect(style.length).toBeGreaterThan(0);
    expect(style.length).toBeLessThanOrEqual(3);
    expect(style.join(" ")).toMatch(/critical customers/);
    expect(style.join(" ")).not.toMatch(/score|rank|grade/i);
  });

  it("gives every logged decision a product principle", () => {
    for (const e of log) expect(principleOf(e).length).toBeGreaterThan(10);
  });
});

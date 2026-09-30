/**
 * TOWER // 24's decision log entries and the end of the shift: the summary,
 * the operating-style observations and the Decision Replay principles, all
 * derived from the logged decisions. Pure data and logic.
 */
import {
  CUSTOMER_TYPES,
  INITIAL,
  INTEGRITY_CHECKS,
  INTEGRITY_CONCLUSIONS,
  INVESTIGATIONS,
  M2_CHOICES,
  M3_CHOICES,
  NODE_CUSTOMERS,
  breachesSla,
  customerImpactSentence,
  describeDispatch,
  inr,
  m2Text,
  type DecisionKind,
  type DecisionLogEntry,
  type IntegrityCheck,
  type IntegrityConclusion,
  type InvestigationId,
  type M2Choice,
  type M3Choice,
  type Tally,
  dispatchImpact,
} from "./model";
import { LOCAL_TRUCK_KL, describeRule, type Candidate, type QueuedShipment, type RuleEffect } from "./strategy";

type Entry = Omit<DecisionLogEntry, "time">;
const money = (n: number) => inr.format(n);

// --- Log entries, one builder per kind of decision ----------------------------------------------

export function dispatchEntry(impact: ReturnType<typeof dispatchImpact>, loaded: string[]): Entry {
  const critical = impact.leftBehind.filter((l) => l.risk === "critical");
  const atRisk = impact.leftBehind.filter((l) => l.risk !== "normal");
  return {
    kind: "dispatch",
    choice: critical.length ? "stranded" : loaded.length > 1 ? "consolidated" : "single",
    description: describeDispatch(impact, loaded),
    impact: `${impact.truck.id} left ${impact.utilisation}% full with ${loaded.length} ${loaded.length > 1 ? "orders" : "order"}; ${
      impact.avoidedCost >= 0 ? `${money(impact.avoidedCost)} avoided against separate trucks` : `${money(-impact.avoidedCost)} more than separate trucks`
    }.`,
    secondary: atRisk.length
      ? `${atRisk.map((l) => `#${l.order.id}`).join(", ")} ${atRisk.length > 1 ? "wait" : "waits"} for the next truck, at SLA risk.`
      : undefined,
    tally: { shipments: loaded.length, consolidated: loaded.length > 1 ? 1 : 0, trucks: 1, breaches: critical.length },
    run: { load: impact.load, capacity: impact.truck.capacity },
  };
}

export function investigateEntry(id: InvestigationId, m1Truck: string | null): Entry {
  const i = INVESTIGATIONS.find((x) => x.id === id)!;
  return {
    kind: "investigate",
    choice: id,
    description: `Mission 02: investigated (${i.label}, +${i.minutes} min).`,
    impact: m2Text(i.finding, m1Truck),
    secondary: `Decision time +${i.minutes} min while TR-104's orders waited.`,
    tally: { investigateMinutes: i.minutes },
  };
}

export function exceptionEntry(choice: M2Choice, m1Truck: string | null): Entry {
  const c = M2_CHOICES[choice];
  const critical = c.customers.filter((e) => e.outcome === "protected" && NODE_CUSTOMERS[e.customer].type === "critical").length;
  const breaches = c.customers.filter((e) => e.outcome === "delayed" && breachesSla(e.customer, e.minutes)).length;
  const delayed = c.customers.filter((e) => e.outcome === "delayed");
  return {
    kind: "exception",
    choice,
    description: m2Text(c.log, m1Truck),
    impact: customerImpactSentence(choice),
    secondary:
      [c.cost ? `${money(c.cost)} extra spend` : null, c.slaDelta ? `SLA ${c.slaDelta} pts` : null, delayed.length ? `${delayed.map((d) => NODE_CUSTOMERS[d.customer].name).join(" and ")} delayed` : null]
        .filter(Boolean)
        .join("; ") + ".",
    tally: { shipments: 2, resolved: choice === "hold" ? 0 : 1, criticalProtected: critical, breaches, trucks: choice === "reassign" ? 1 : 0 },
  };
}

export function qualityEntry(choice: M3Choice): Entry {
  const c = M3_CHOICES[choice];
  return {
    kind: "quality",
    choice,
    description: c.log,
    impact: c.consequence.split(": ")[0].split(". ")[0] + ".",
    secondary: [
      c.qualityDelta ? `Quality score ${c.qualityDelta > 0 ? "+" : "−"}${Math.abs(c.qualityDelta)}` : "Quality score unchanged",
      c.minutes ? `${c.minutes} min lost` : null,
      c.cost ? `${money(c.cost)} spent` : null,
      choice === "accept" ? "complaint risk later" : null,
    ]
      .filter(Boolean)
      .join("; ") + ".",
    tally: { shipments: 1, resolved: 1 },
  };
}

export function integrityCheckEntry(id: IntegrityCheck): Entry {
  const c = INTEGRITY_CHECKS.find((x) => x.id === id)!;
  return { kind: "integrity-check", choice: id, description: `Mission 03: integrity check (${c.label}).`, impact: c.finding };
}

export function integrityConclusionEntry(conclusion: IntegrityConclusion): Entry {
  const c = INTEGRITY_CONCLUSIONS[conclusion];
  return { kind: "integrity-conclusion", choice: conclusion, description: c.log, impact: c.result };
}

/** Critical deliveries: Critical priority, or a critical-facility customer. */
const isCritical = (q: QueuedShipment) => q.priority === "Critical" || NODE_CUSTOMERS[q.zone]?.type === "critical";

function policyTally(e: RuleEffect, queue: QueuedShipment[]): Tally {
  const matched = queue.filter((q) => e.matched.includes(q.id));
  const expedited = e.rule.then === "expedite" ? matched : []; // only Expedite moves shipments; the other actions flag or alert
  return {
    shipments: expedited.length,
    criticalProtected: expedited.filter(isCritical).length,
    trucks: -e.fleetReserved, // a reserved truck is held back, not working
  };
}

export function policyEntry(e: RuleEffect, queue: QueuedShipment[]): Entry {
  return {
    kind: "policy",
    choice: e.rule.then,
    description: `Strategy: activated ${describeRule(e.rule)}. ${e.summary}`,
    impact: e.summary,
    secondary: e.matched.length ? "Keeps applying to new shipments that match, without a decision each time." : undefined,
    tally: policyTally(e, queue),
  };
}

/** Switching the policy off reverses the logged tallies of its rules, so the log still sums to the session's totals. */
export function policyOffEntry(active: DecisionLogEntry[]): Entry {
  const reversed: Tally = {};
  for (const e of active) for (const [k, v] of Object.entries(e.tally ?? {})) reversed[k as keyof Tally] = (reversed[k as keyof Tally] ?? 0) - v;
  return {
    kind: "policy-off",
    description: "Strategy: control policy switched off for revision.",
    impact: "The policy's cost, SLA and fleet effects are undone.",
    tally: reversed,
  };
}

export function approvedEntry(c: Candidate): Entry {
  return {
    kind: "consolidation-approved",
    choice: c.id,
    description: `AI Dispatcher: approved consolidating #${c.a.id} + #${c.b.id} on one ${c.depot} run; saves ${money(c.saving)}.`,
    impact: `One ${c.depot} run instead of two: ${money(c.saving)} saved, ${c.load}/${LOCAL_TRUCK_KL} KL on the truck.`,
    secondary: "A truck freed for the afternoon; the second drop lands later but inside its SLA window.",
    tally: { shipments: 2, consolidated: 1, trucks: -1 },
    run: { load: c.load, capacity: LOCAL_TRUCK_KL },
  };
}

export function rejectedEntry(c: Candidate): Entry {
  return {
    kind: "consolidation-rejected",
    choice: c.id,
    description: `AI Dispatcher: rejected consolidating #${c.a.id} + #${c.b.id}; no change.`,
    impact: `#${c.a.id} and #${c.b.id} keep their own runs; the ${money(c.saving)} saving is left on the table.`,
  };
}

// --- End of shift: summary ------------------------------------------------------------------------

export const FLEET_TOTAL = INITIAL.fleet.available + INITIAL.fleet.inTransit;
/** Trucks the day's plan already had working before any of the player's decisions. */
export const DAY_PLAN_TRUCKS = 31;

export type ShiftSummary = {
  serviceLevel: number;
  fleetUtilisation: number;
  slaBreaches: number;
  loadUtilisation: number | null;
  cost: number;
  shipments: number;
  consolidated: number;
  resolved: number;
  criticalProtected: number;
};

export function shiftSummary(log: DecisionLogEntry[], stats: { sla: number; cost: number }): ShiftSummary {
  const total = (k: keyof Tally) => log.reduce((s, e) => s + (e.tally?.[k] ?? 0), 0);
  const runs = log.flatMap((e) => (e.run ? [e.run] : []));
  const capacity = runs.reduce((s, r) => s + r.capacity, 0);
  return {
    serviceLevel: stats.sla,
    fleetUtilisation: Math.round(((DAY_PLAN_TRUCKS + total("trucks")) / FLEET_TOTAL) * 100),
    slaBreaches: total("breaches"),
    loadUtilisation: capacity ? Math.round((runs.reduce((s, r) => s + r.load, 0) / capacity) * 100) : null,
    cost: stats.cost,
    shipments: total("shipments"),
    consolidated: total("consolidated"),
    resolved: total("resolved"),
    criticalProtected: total("criticalProtected"),
  };
}

// --- End of shift: operating style ---------------------------------------------------------------

/**
 * Two or three descriptive observations from patterns in the log. Rule-based:
 * each rule looks for evidence and says what it saw; the strongest three are
 * kept. Never a score or a ranking.
 */
export function operatingStyle(log: DecisionLogEntry[]): string[] {
  const of = (k: DecisionKind) => log.filter((e) => e.kind === k);
  const found: { weight: number; text: string }[] = [];

  const exception = of("exception").at(-1);
  const expedite = of("policy").filter((e) => e.choice === "expedite" && (e.tally?.criticalProtected ?? 0) > 0);
  if (exception?.choice === "reroute")
    found.push({ weight: 3, text: `You prioritised critical customers over cost optimisation: you paid ${money(M2_CHOICES.reroute.cost)} to keep Central Medical Campus on time rather than wait.` });
  else if (exception?.choice === "reassign")
    found.push({ weight: 3, text: "You protected critical customers by moving work rather than spending: TR-104's orders went to a spare truck, and a standard customer absorbed the delay." });
  else if (exception?.choice === "hold")
    found.push({ weight: 3, text: `You protected cost over a critical delivery: holding TR-104 spent nothing extra, but Central Medical Campus waited past its ${CUSTOMER_TYPES.critical.toleranceMinutes}-minute tolerance.` });
  if (expedite.length) found.push({ weight: 2, text: "You wrote critical service into policy: your control policy expedites critical shipments automatically." });

  const checks = of("investigate");
  const minutes = checks.reduce((s, e) => s + (e.tally?.investigateMinutes ?? 0), 0);
  const integrity = of("integrity-check").length;
  if (checks.length >= 2) found.push({ weight: 2.5, text: `You frequently investigated exceptions before acting: ${checks.length} checks (${minutes} min) before deciding on TR-104${integrity === INTEGRITY_CHECKS.length ? ", and every integrity check around D6" : ""}.` });
  else if (exception && checks.length === 0) found.push({ weight: 2.5, text: `You acted on exceptions quickly, deciding on TR-104 without investigating first${integrity ? `, though you did dig into the integrity signals at D6` : ""}.` });
  else if (checks.length === 1) found.push({ weight: 1, text: `You checked one source (${INVESTIGATIONS.find((i) => i.id === checks[0].choice)?.label}) before deciding on TR-104.` });

  const dispatch = of("dispatch")[0];
  const approved = of("consolidation-approved").length;
  const rejected = of("consolidation-rejected").length;
  if (dispatch) {
    const loadedOrders = dispatch.tally?.shipments ?? 0;
    const strandedCritical = (dispatch.tally?.breaches ?? 0) > 0;
    const copilot = approved === 1 ? ", and approved the AI Dispatcher's consolidation" : approved ? `, and approved ${approved} of the AI Dispatcher's consolidations` : "";
    if (loadedOrders >= 3 && !strandedCritical) found.push({ weight: 2 + (approved ? 1 : 0), text: `You favoured consolidation when SLA risk was low: ${loadedOrders} orders on one truck in the morning${copilot}.` });
    else if (strandedCritical) found.push({ weight: 2.5, text: `You pushed truck utilisation even when it left an order at critical SLA risk in the morning${copilot}.` });
    else if (loadedOrders < 3 && approved) found.push({ weight: 2, text: `You kept the morning load light, then consolidated later with the AI Dispatcher (${approved} approved).` });
  }
  if (rejected && !approved) found.push({ weight: 1.5, text: `You kept the AI Dispatcher at arm's length: you rejected ${rejected === 1 ? "its suggestion" : `all ${rejected} suggestions`}.` });

  const quality = of("quality")[0];
  if (quality?.choice === "accept") found.push({ weight: 2.5, text: "You kept shipments moving over quality checks: an off-spec load went through to protect the schedule." });
  else if (quality) found.push({ weight: 1.5, text: `You stopped for quality even when it cost time: shipment #5120 was ${quality.choice === "hold" ? "held for a retest" : "escalated to quality operations"}.` });

  const policies = of("policy").length;
  if (policies && !expedite.length) found.push({ weight: 2, text: `You set standing rules rather than deciding case by case: ${policies} rule${policies > 1 ? "s" : ""} in your control policy.` });

  return found
    .map((f, i) => ({ ...f, i }))
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
    .slice(0, 3)
    .map((f) => f.text);
}

// --- Decision Replay: one product principle per type of decision -----------------------------------

const PRINCIPLES: Record<DecisionKind, string | Record<string, string>> = {
  dispatch: {
    consolidated: "Optimise total network outcome rather than individual shipment efficiency.",
    stranded: "Utilisation is a means, not the goal: fill the truck without stranding the order that can't wait.",
    single: "Speed for one order has a network price: every half-empty truck is capacity someone else needed.",
  },
  investigate: "Buy information when a decision is expensive to reverse, and stop when it no longer changes the answer.",
  exception: {
    reroute: "Protect the customers who can't absorb failure, and pay for it knowingly.",
    reassign: "Use slack in the system before spending money, and make the cost visible to whoever absorbs it.",
    hold: "Waiting is a decision too: its cost lands on the customer instead of the budget.",
  },
  quality: {
    accept: "Speed that ships a defect is borrowed time; the complaint arrives later.",
    hold: "Stop the line when the signal is strong: quality problems compound downstream.",
    escalate: "Route problems to the owners who can fix the cause, not just this instance.",
  },
  "integrity-check": "Look for patterns across signals; a single anomaly rarely tells the story.",
  "integrity-conclusion": {
    audit: "Treat leakage as a system problem to instrument, not a one-off to explain away.",
    close: "Closing a case without evidence of absence leaves the leak running.",
  },
  policy: "Encode repeatable judgement as policy, so people spend their attention on the exceptions.",
  "policy-off": "Policies need review: revisit the rules when the network changes.",
  "consolidation-approved": "Optimise total network outcome rather than individual shipment efficiency.",
  "consolidation-rejected": "AI proposes, people decide: a rejected suggestion is still a signal worth logging.",
};

export function principleOf(e: DecisionLogEntry): string {
  const p = PRINCIPLES[e.kind];
  return typeof p === "string" ? p : p[e.choice ?? ""] ?? Object.values(p)[0];
}

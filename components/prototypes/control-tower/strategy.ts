/**
 * Strategy Mode and the AI Dispatcher: the afternoon queue, control-policy
 * rules and consolidation candidates. Pure data and logic, shared by the
 * canvas and /api/chat (which rebuilds the queue from the player's decisions
 * rather than trusting a snapshot sent by the browser).
 */
import {
  CUSTOMER_TYPES,
  M2_CHOICES,
  NODE_CUSTOMERS,
  ORDERS,
  RISK_LABEL,
  ROUTES,
  STOP_COST,
  inr,
  riskLevel,
  type BalanceChange,
  type M2Choice,
  type RouteRisk,
} from "./model";

// --- The queue ------------------------------------------------------------------------------

export type ShipmentPriority = "Critical" | "High" | "Medium" | "Low";
export const PRIORITIES: ShipmentPriority[] = ["Critical", "High", "Medium", "Low"];

export type QueuedShipment = {
  id: string;
  customer: string;
  zone: string; // customer zone node (C1–C7)
  depot: string;
  demand: number; // KL
  priority: ShipmentPriority;
  slaHours: number;
  /** Cost of a local run carrying only this shipment (₹). */
  soloCost: number;
};

/** Local delivery trucks at the depots carry up to 24 KL. */
export const LOCAL_TRUCK_KL = 24;
/** A second drop at a different customer adds a detour (₹), on top of STOP_COST. */
export const DETOUR_COST = 4_000;
/** A consolidated run delivers its second drop about 3.5 h after loading. */
export const SECOND_DROP_HOURS = 3.5;

/** Afternoon shipments waiting for local runs, across the depots. */
const AFTERNOON: Omit<QueuedShipment, "customer">[] = [
  { id: "5130", zone: "C5", depot: "D5", demand: 10, priority: "Critical", slaHours: 3, soloCost: 17_000 },
  { id: "5131", zone: "C6", depot: "D6", demand: 14, priority: "Low", slaHours: 12, soloCost: 19_500 },
  { id: "5132", zone: "C4", depot: "D4", demand: 8, priority: "Medium", slaHours: 6, soloCost: 14_500 },
  { id: "5134", zone: "C3", depot: "D4", demand: 12, priority: "High", slaHours: 4, soloCost: 18_000 },
  { id: "5135", zone: "C5", depot: "D6", demand: 9, priority: "High", slaHours: 3, soloCost: 16_000 },
  { id: "5136", zone: "C7", depot: "D8", demand: 7, priority: "Low", slaHours: 10, soloCost: 13_000 },
  { id: "5137", zone: "C7", depot: "D8", demand: 11, priority: "Medium", slaHours: 8, soloCost: 17_500 },
];

/** What the player has decided so far: everything the queue and candidates depend on. */
export type DispatcherState = {
  /** Mission 01's loaded orders; the rest join the queue from D1. Null before dispatch. */
  m1Loaded: string[] | null;
  m2: M2Choice | null;
  rules: Rule[];
  /** Orders already consolidated through the copilot (off the queue). */
  consolidated: string[];
  /** Candidate ids the player rejected (not proposed again). */
  rejected: string[];
};

/** The shipments waiting now: the afternoon queue plus Mission 01's left-behind orders, minus consolidated ones. */
export function currentQueue(s: Pick<DispatcherState, "m1Loaded" | "consolidated">): QueuedShipment[] {
  const afternoon = AFTERNOON.map((a) => ({ ...a, customer: NODE_CUSTOMERS[a.zone].name }));
  const leftBehind: QueuedShipment[] = s.m1Loaded
    ? ORDERS.filter((o) => !s.m1Loaded!.includes(o.id)).map((o) => ({
        id: o.id,
        customer: o.customer,
        zone: "C1",
        depot: "D1",
        demand: o.demand,
        priority: o.priority,
        slaHours: o.slaHours,
        soloCost: o.soloCost,
      }))
    : [];
  return [...leftBehind, ...afternoon].filter((q) => !s.consolidated.includes(q.id));
}

/** A shipment's utilisation if it runs alone on a local truck (%). */
export const soloUtilisation = (q: QueuedShipment) => Math.round((q.demand / LOCAL_TRUCK_KL) * 100);

/** Route risk from the shipment's depot to its customer zone, with Mission 02's overrides. */
export function shipmentRisk(q: QueuedShipment, m2: M2Choice | null): RouteRisk {
  const key = `${q.depot}-${q.zone}`;
  const override = m2 ? M2_CHOICES[m2].routeRisk[key] : undefined;
  const route = ROUTES.find((r) => `${r.from}-${r.to}` === key);
  return riskLevel(override ?? route?.riskValue ?? 0);
}

// --- Control policy rules -------------------------------------------------------------------

export type ConditionKind = "priority" | "utilisation" | "route-risk";
export type Condition =
  | { kind: "priority"; value: ShipmentPriority }
  | { kind: "utilisation"; below: number }
  | { kind: "route-risk"; atLeast: Exclude<RouteRisk, "normal"> };
export type PolicyAction = "expedite" | "notify" | "reserve" | "consolidate";
export type Rule = { when: Condition; and: Condition | null; then: PolicyAction };

export const CONDITION_KINDS: { kind: ConditionKind; label: string }[] = [
  { kind: "priority", label: "Shipment priority" },
  { kind: "utilisation", label: "Truck utilisation" },
  { kind: "route-risk", label: "Route risk" },
];
export const UTILISATION_THRESHOLDS = [40, 50, 60];
export const DEFAULT_CONDITION: Record<ConditionKind, Condition> = {
  priority: { kind: "priority", value: "Critical" },
  utilisation: { kind: "utilisation", below: 50 },
  "route-risk": { kind: "route-risk", atLeast: "at-risk" },
};

export const ACTIONS: Record<PolicyAction, { label: string; note: string }> = {
  expedite: { label: "Expedite", note: "Priority dispatch: faster, costs more" },
  notify: { label: "Notify Operations", note: "Alert the ops desk: no cost, lower risk" },
  reserve: { label: "Reserve Fleet", note: "Hold a truck back as a buffer" },
  consolidate: { label: "Recommend Consolidation", note: "Flag for combining runs" },
};

export function describeCondition(c: Condition): string {
  if (c.kind === "priority") return `Shipment priority = ${c.value}`;
  if (c.kind === "utilisation") return `Truck utilisation < ${c.below}%`;
  return `Route risk ≥ ${RISK_LABEL[c.atLeast]}`;
}
export const describeRule = (r: Rule) =>
  `WHEN ${describeCondition(r.when)}${r.and ? ` AND ${describeCondition(r.and)}` : ""} THEN ${ACTIONS[r.then].label}`;

function meets(c: Condition, q: QueuedShipment, m2: M2Choice | null): boolean {
  if (c.kind === "priority") return q.priority === c.value;
  if (c.kind === "utilisation") return soloUtilisation(q) < c.below;
  const risk = shipmentRisk(q, m2);
  return c.atLeast === "critical" ? risk === "critical" : risk !== "normal";
}

export function ruleMatches(r: Rule, queue: QueuedShipment[], m2: M2Choice | null): QueuedShipment[] {
  return queue.filter((q) => meets(r.when, q, m2) && (!r.and || meets(r.and, q, m2)));
}

/** At most three matches count towards a rule's effect, so one broad rule can't swing the day. */
const MAX_COUNTED = 3;

export type RuleEffect = {
  rule: Rule;
  matched: string[];
  cost: number; // ₹ on the header
  slaDelta: number;
  fleetReserved: number;
  balance: BalanceChange | null;
  summary: string;
};

/** What a rule does to the tower when the policy is activated, from the shipments it matches now. */
export function ruleEffect(rule: Rule, queue: QueuedShipment[], m2: M2Choice | null): RuleEffect {
  const matched = ruleMatches(rule, queue, m2).map((q) => q.id);
  const n = Math.min(matched.length, MAX_COUNTED);
  const ids = matched.map((id) => `#${id}`).join(", ");
  const base = { rule, matched, cost: 0, slaDelta: 0, fleetReserved: 0, balance: null };
  if (!n) return { ...base, summary: "No shipment matches right now; the rule stays armed." };
  const reason = (what: string) => `${what} ${n} ${n > 1 ? "shipments" : "shipment"} by policy`;
  switch (rule.then) {
    case "expedite":
      return {
        ...base,
        cost: 6_000 * n,
        slaDelta: 0.5 * n,
        balance: { source: "Strategy", reason: reason("Expedited"), deltas: { service: 2 * n, cost: 2 * n } },
        summary: `Expedites ${ids}: +${inr.format(6_000 * n)}, SLA +${0.5 * n} pts.`,
      };
    case "notify":
      return {
        ...base,
        balance: { source: "Strategy", reason: reason("Ops alerted on"), deltas: { risk: -2 * n } },
        summary: `Operations is alerted on ${ids}. No cost; risk comes down.`,
      };
    case "reserve":
      return {
        ...base,
        fleetReserved: 1,
        balance: { source: "Strategy", reason: "Reserved a truck as a buffer", deltas: { risk: -3, capacity: -3 } },
        summary: `One truck is held back for ${ids}: one fewer available, less risk.`,
      };
    case "consolidate":
      return {
        ...base,
        balance: { source: "Strategy", reason: reason("Flagged for consolidation"), deltas: { capacity: 2 * n } },
        summary: `${ids} ${n > 1 ? "are" : "is"} flagged for consolidation; the AI Dispatcher looks at them first.`,
      };
  }
}

// --- Consolidation candidates ---------------------------------------------------------------

export type Candidate = {
  id: string; // "5132+5134"
  a: QueuedShipment;
  b: QueuedShipment;
  depot: string;
  load: number;
  utilisation: number;
  saving: number;
  flagged: boolean; // matched a Recommend Consolidation rule
};
export type RuledOut = { pair: string; reason: string };

/**
 * Pairs that could share one local run: same depot, no Critical-priority
 * shipment (those keep a dedicated truck), within one truck's 24 KL, and
 * both SLA windows long enough for the second drop. Saving: the cheaper
 * solo run disappears, minus the extra stop (and a detour for a second customer).
 */
export function consolidation(s: DispatcherState): { candidates: Candidate[]; ruledOut: RuledOut[] } {
  const queue = currentQueue(s);
  const flaggedIds = new Set(s.rules.filter((r) => r.then === "consolidate").flatMap((r) => ruleMatches(r, queue, s.m2).map((q) => q.id)));
  const candidates: Candidate[] = [];
  const ruledOut: RuledOut[] = [];
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const [a, b] = [queue[i], queue[j]].sort((x, y) => x.id.localeCompare(y.id));
      if (a.depot !== b.depot) continue;
      const id = `${a.id}+${b.id}`;
      const load = a.demand + b.demand;
      const critical = [a, b].find((q) => q.priority === "Critical");
      const tight = [a, b].find((q) => q.slaHours < SECOND_DROP_HOURS);
      if (critical) ruledOut.push({ pair: id, reason: `#${critical.id} is Critical priority and keeps a dedicated truck` });
      else if (load > LOCAL_TRUCK_KL) ruledOut.push({ pair: id, reason: `${load} KL is over one local truck's ${LOCAL_TRUCK_KL} KL` });
      else if (tight) ruledOut.push({ pair: id, reason: `#${tight.id}'s ${tight.slaHours} h SLA can't wait for a second drop` });
      else if (s.rejected.includes(id)) ruledOut.push({ pair: id, reason: "the dispatcher already rejected it" });
      else {
        const saving = Math.min(a.soloCost, b.soloCost) - STOP_COST - (a.customer === b.customer ? 0 : DETOUR_COST);
        if (saving <= 0) ruledOut.push({ pair: id, reason: "the extra stop costs more than it saves" });
        else
          candidates.push({
            id,
            a,
            b,
            depot: a.depot,
            load,
            utilisation: Math.round((load / LOCAL_TRUCK_KL) * 100),
            saving,
            flagged: flaggedIds.has(a.id) || flaggedIds.has(b.id),
          });
      }
    }
  }
  return { candidates, ruledOut };
}

/** An approved consolidation's effect on the balance: one run fewer, a fuller truck, one more stop. */
export const approvalBalance = (c: Candidate): BalanceChange => ({
  source: "AI Dispatcher",
  reason: `Consolidated #${c.a.id} + #${c.b.id} on one ${c.depot} run`,
  deltas: { cost: -3, capacity: 4, service: -1 },
});

/** The tower's state as plain text for the AI Dispatcher prompt. */
export function dispatcherSnapshot(s: DispatcherState): string {
  const queue = currentQueue(s);
  const { candidates, ruledOut } = consolidation(s);
  const line = (q: QueuedShipment) =>
    `- #${q.id} · ${q.customer}${NODE_CUSTOMERS[q.zone] && q.zone !== "C1" ? ` (${CUSTOMER_TYPES[NODE_CUSTOMERS[q.zone].type].short} SLA customer)` : ""} · from ${q.depot} · ${q.demand} KL · ${q.priority} priority · SLA ${q.slaHours} h · solo run ${inr.format(q.soloCost)} (${soloUtilisation(q)}% of a truck) · route risk ${RISK_LABEL[shipmentRisk(q, s.m2)].toLowerCase()}`;
  return [
    `Local trucks carry up to ${LOCAL_TRUCK_KL} KL. A consolidated run adds ${inr.format(STOP_COST)} per extra stop, plus ${inr.format(DETOUR_COST)} if the second drop is a different customer; its second drop lands about ${SECOND_DROP_HOURS} h after loading.`,
    "",
    `Queue (${queue.length} shipments waiting):`,
    ...queue.map(line),
    "",
    s.rules.length ? `Active control policy:\n${s.rules.map((r) => `- ${describeRule(r)}`).join("\n")}` : "Active control policy: none.",
    "",
    "Feasible consolidation candidates (computed by the tower; the savings are exact):",
    ...candidates.map(
      (c) =>
        `- ${c.id}: ${c.depot}, ${c.load}/${LOCAL_TRUCK_KL} KL (${c.utilisation}% full), both inside their SLA windows, saving ${inr.format(c.saving)}${c.flagged ? ", flagged by the control policy" : ""}`
    ),
    "",
    "Ruled out:",
    ...(ruledOut.length ? ruledOut.map((r) => `- ${r.pair}: ${r.reason}`) : ["- none"]),
  ].join("\n");
}

// --- Validating state sent to /api/chat ------------------------------------------------------

const M2_KEYS = ["reroute", "reassign", "hold"];
const ORDER_IDS = new Set([...ORDERS.map((o) => o.id), ...AFTERNOON.map((a) => a.id)]);
const isIdList = (x: unknown, max: number, valid: (s: string) => boolean): x is string[] =>
  Array.isArray(x) && x.length <= max && x.every((v) => typeof v === "string" && valid(v));

function parseCondition(x: unknown): Condition | null {
  if (!x || typeof x !== "object") return null;
  const c = x as Record<string, unknown>;
  if (c.kind === "priority" && PRIORITIES.includes(c.value as ShipmentPriority)) return { kind: "priority", value: c.value as ShipmentPriority };
  if (c.kind === "utilisation" && UTILISATION_THRESHOLDS.includes(c.below as number)) return { kind: "utilisation", below: c.below as number };
  if (c.kind === "route-risk" && (c.atLeast === "at-risk" || c.atLeast === "critical")) return { kind: "route-risk", atLeast: c.atLeast };
  return null;
}

/** Rebuilds DispatcherState from untrusted JSON, or null if anything is off. Only known ids and values pass. */
export function parseDispatcherState(x: unknown): DispatcherState | null {
  if (!x || typeof x !== "object") return null;
  const s = x as Record<string, unknown>;
  const m1Loaded = s.m1Loaded === null ? null : isIdList(s.m1Loaded, ORDERS.length, (id) => ORDERS.some((o) => o.id === id)) ? s.m1Loaded : undefined;
  if (m1Loaded === undefined) return null;
  if (s.m2 !== null && !M2_KEYS.includes(s.m2 as string)) return null;
  if (!Array.isArray(s.rules) || s.rules.length > 2) return null;
  const rules: Rule[] = [];
  for (const r of s.rules as Record<string, unknown>[]) {
    const when = parseCondition(r?.when);
    const and = r?.and === null ? null : parseCondition(r?.and);
    if (!when || (r?.and !== null && !and) || !(typeof r.then === "string" && r.then in ACTIONS)) return null;
    rules.push({ when, and, then: r.then as PolicyAction });
  }
  if (!isIdList(s.consolidated, ORDER_IDS.size, (id) => ORDER_IDS.has(id))) return null;
  if (!isIdList(s.rejected, 30, (id) => /^\d{4}\+\d{4}$/.test(id))) return null;
  return { m1Loaded, m2: s.m2 as M2Choice | null, rules, consolidated: s.consolidated, rejected: s.rejected };
}

import type { Status } from "@/components/prototypes/engine/status";

/**
 * Control tower: a day of dispatch in a distribution network. The network layout,
 * starting values and each mission's rules and outcomes, as pure data and logic.
 */

/** Route risk: three levels on the Flight Deck signals (no fourth colour). */
export type RouteRisk = "normal" | "at-risk" | "critical";
export const RISK_STATUS: Record<RouteRisk, Status> = { normal: "stable", "at-risk": "warning", critical: "critical" };
export const RISK_LABEL: Record<RouteRisk, string> = { normal: "Normal", "at-risk": "At risk", critical: "Critical" };

export type NodeKind = "supplier" | "depot" | "customer";
export type MapNode = { id: string; kind: NodeKind; label: string; x: number; y: number };
/** riskValue: mock 0–100 route risk; its level comes from riskLevel(). */
export type Route = { from: string; to: string; riskValue: number };

/** Route risk level from its value: under 40 normal, 40–69 at risk, 70+ critical. */
export function riskLevel(value: number): RouteRisk {
  return value >= 70 ? "critical" : value >= 40 ? "at-risk" : "normal";
}

export const MISSION = {
  number: "01",
  name: "Morning dispatch",
  startClock: "06:00 AM",
  hours: 18,
  objective: "Keep customers supplied while controlling logistics cost and minimizing operational risk",
  resources: [
    { label: "Trucks", value: 43 },
    { label: "Depots", value: 8 },
    { label: "Active shipments", value: 126 },
    { label: "High-priority deliveries", value: 17 },
  ],
};

/** Map coordinates are in a 1000 × 420 viewBox: suppliers left, depots middle, customer zones right. */
export const NODES: MapNode[] = [
  { id: "S1", kind: "supplier", label: "Refinery", x: 90, y: 90 },
  { id: "S2", kind: "supplier", label: "Bottling plant", x: 90, y: 210 },
  { id: "S3", kind: "supplier", label: "Supplier hub", x: 90, y: 330 },
  { id: "D1", kind: "depot", label: "D1", x: 430, y: 50 },
  { id: "D2", kind: "depot", label: "D2", x: 540, y: 95 },
  { id: "D3", kind: "depot", label: "D3", x: 430, y: 145 },
  { id: "D4", kind: "depot", label: "D4", x: 540, y: 190 },
  { id: "D5", kind: "depot", label: "D5", x: 430, y: 240 },
  { id: "D6", kind: "depot", label: "D6", x: 540, y: 285 },
  { id: "D7", kind: "depot", label: "D7", x: 430, y: 335 },
  { id: "D8", kind: "depot", label: "D8", x: 540, y: 375 },
  { id: "C1", kind: "customer", label: "North", x: 900, y: 40 },
  { id: "C2", kind: "customer", label: "North-east", x: 900, y: 95 },
  { id: "C3", kind: "customer", label: "Central", x: 900, y: 150 },
  { id: "C4", kind: "customer", label: "East", x: 900, y: 205 },
  { id: "C5", kind: "customer", label: "South-east", x: 900, y: 260 },
  { id: "C6", kind: "customer", label: "South", x: 900, y: 315 },
  { id: "C7", kind: "customer", label: "West", x: 900, y: 370 },
];

/**
 * Starting route risk (mock values): mostly normal, two at risk (Bottling plant → D6,
 * D5 → South-east), one critical (D7 → South). The flagged routes are the day's first exceptions.
 */
export const ROUTES: Route[] = [
  { from: "S1", to: "D1", riskValue: 12 },
  { from: "S1", to: "D2", riskValue: 18 },
  { from: "S1", to: "D3", riskValue: 22 },
  { from: "S2", to: "D4", riskValue: 15 },
  { from: "S2", to: "D5", riskValue: 30 },
  { from: "S2", to: "D6", riskValue: 58 },
  { from: "S3", to: "D7", riskValue: 34 },
  { from: "S3", to: "D8", riskValue: 10 },
  { from: "D1", to: "C1", riskValue: 25 },
  { from: "D2", to: "C2", riskValue: 14 },
  { from: "D3", to: "C3", riskValue: 20 },
  { from: "D4", to: "C3", riskValue: 16 },
  { from: "D4", to: "C4", riskValue: 8 },
  { from: "D5", to: "C5", riskValue: 63 },
  { from: "D6", to: "C5", riskValue: 27 },
  { from: "D6", to: "C6", riskValue: 31 },
  { from: "D7", to: "C6", riskValue: 84 },
  { from: "D8", to: "C7", riskValue: 11 },
];

/** The control tower's starting numbers; the dashboard adds each decision's effects. Exceptions match the at-risk and critical routes above. */
export const INITIAL = {
  networkHealth: 96,
  cost: 248_000, // ₹ committed so far today
  sla: 98,
  shipments: { active: 126, urgent: 17 },
  exceptions: {
    unresolved: ROUTES.filter((r) => riskLevel(r.riskValue) !== "normal").length,
    critical: ROUTES.filter((r) => riskLevel(r.riskValue) === "critical").length,
  },
  fleet: { available: 38, inTransit: 5 },
};

// --- Map layers (mock data) -------------------------------------------------------------

export type MapLayer = "network" | "inventory" | "fleet" | "demand" | "risk";
export const MAP_LAYERS: { key: MapLayer; label: string }[] = [
  { key: "network", label: "Network" },
  { key: "inventory", label: "Inventory" },
  { key: "fleet", label: "Fleet" },
  { key: "demand", label: "Demand" },
  { key: "risk", label: "Risk" },
];

/** Stock on hand per depot (% of capacity). D7 and D5 run low, next to the routes already at risk. */
export const DEPOT_INVENTORY: Record<string, number> = { D1: 82, D2: 64, D3: 45, D4: 71, D5: 28, D6: 38, D7: 18, D8: 90 };
/** Inventory level: under 25% critical, under 50% at risk (same three signals as route risk). */
export function inventoryLevel(pct: number): RouteRisk {
  return pct < 25 ? "critical" : pct < 50 ? "at-risk" : "normal";
}

export type DemandLevel = "High" | "Medium" | "Low";
/** Demand per customer zone. North is where today's big Delhi order goes. */
export const CUSTOMER_DEMAND: Record<string, DemandLevel> = {
  C1: "High",
  C2: "Medium",
  C3: "Medium",
  C4: "Low",
  C5: "High",
  C6: "High",
  C7: "Low",
};

/** Trucks parked and available at each depot (sums to INITIAL.fleet.available). */
export const DEPOT_FLEET: Record<string, number> = { D1: 6, D2: 5, D3: 4, D4: 6, D5: 4, D6: 5, D7: 3, D8: 5 };

/**
 * Trucks animated on the map, shuttling along their path (node ids) and back.
 * phase: which stop of the round trip each starts from, so they don't move in lockstep.
 */
export const MOVING_TRUCKS: { id: string; path: string[]; phase: number }[] = [
  { id: "TK-31", path: ["S1", "D2", "C2"], phase: 0 },
  { id: "TK-21", path: ["S2", "D4", "C4"], phase: 1 },
  { id: "TK-09", path: ["S3", "D8", "C7"], phase: 2 },
];
/** Where Mission 01's dispatched truck runs: from D1 to the North zone (Delhi). */
export const DISPATCH_PATH = ["D1", "C1"];
/** Seconds per leg of a truck's journey: slow enough to stay in the background. */
export const LEG_SECONDS = 5;

// --- Customers ------------------------------------------------------------------------------

export type CustomerType = "critical" | "standard" | "flexible";

/** Three customer types with different service expectations. */
export const CUSTOMER_TYPES: Record<
  CustomerType,
  { label: string; short: string; sla: string; impact: "High" | "Medium"; toleranceMinutes: number; description: string }
> = {
  critical: {
    label: "Hospital / critical facility",
    short: "Critical",
    sla: "Critical",
    impact: "High",
    toleranceMinutes: 15,
    description: "Can't absorb delays: backup generators and medical supplies depend on it.",
  },
  standard: {
    label: "Retail distributor",
    short: "Standard",
    sla: "Standard",
    impact: "Medium",
    toleranceMinutes: 30,
    description: "Plans around delivery windows; a short delay is a complaint, a long one a stock-out.",
  },
  flexible: {
    label: "Industrial customer",
    short: "Flexible",
    sla: "Flexible",
    impact: "High",
    toleranceMinutes: 240,
    description: "Large volumes and high value, but runs on buffer stock and tolerates a few hours.",
  },
};

/** Which customer each zone node is (C1 North is the Delhi Distribution Hub from Mission 01). */
export const NODE_CUSTOMERS: Record<string, { name: string; type: CustomerType }> = {
  C1: { name: "Delhi Distribution Hub", type: "standard" },
  C2: { name: "North-east Steel Works", type: "flexible" },
  C3: { name: "Central Medical Campus", type: "critical" },
  C4: { name: "East Retail Mart", type: "standard" },
  C5: { name: "South-east General Hospital", type: "critical" },
  C6: { name: "South Chemicals Plant", type: "flexible" },
  C7: { name: "West Retail Cooperative", type: "standard" },
};

// --- Mission 02: Save the Network ---------------------------------------------------------

/** The delayed truck, stalled on its route, and the two orders it carries. */
export const EXCEPTION = {
  truck: "TR-104",
  route: ["D3", "C3"] as [string, string],
  /** Route risk while the exception is open (critical). */
  riskValue: 78,
  orders: [
    { id: "5104", customer: "C3", note: "generator fuel" },
    { id: "5105", customer: "C2", note: "second drop after Central" },
  ],
};

export type M2Choice = "reroute" | "reassign" | "hold";

type Effect = { customer: string; outcome: "protected" | "delayed"; minutes?: number };

/**
 * Fixed outcome of each choice: dashboard deltas, route risk overrides for the
 * map, and what happens to each customer involved.
 */
export const M2_CHOICES: Record<
  M2Choice,
  {
    label: string;
    summary: string;
    hint: string;
    cost: number; // ₹ added to the header's Cost
    slaDelta: number;
    healthDelta: number;
    /** Route risk values to apply on the map (key "from-to"). */
    routeRisk: Record<string, number>;
    exceptions: { unresolved: number; critical: number }; // change vs. before the exception
    customers: Effect[];
    log: string;
  }
> = {
  reroute: {
    label: "Reroute",
    summary: "Faster, higher cost",
    hint: "TR-104 takes the bypass. Both drops arrive on time; tolls and extra fuel add up.",
    cost: 18_500,
    slaDelta: 0,
    healthDelta: 0,
    routeRisk: { "D3-C3": 32 },
    exceptions: { unresolved: 0, critical: 0 },
    customers: [
      { customer: "C3", outcome: "protected" },
      { customer: "C2", outcome: "protected" },
    ],
    log: "Mission 02: rerouted TR-104 via the bypass; both orders on time for ₹18,500 extra.",
  },
  reassign: {
    label: "Reassign",
    summary: "Move orders to another truck",
    hint: "{truck} takes both orders now. Its planned East Retail Mart run slips.",
    cost: 6_000,
    slaDelta: -1.5,
    healthDelta: -1,
    routeRisk: { "D3-C3": 30, "D4-C4": 55 },
    exceptions: { unresolved: 1, critical: 0 },
    customers: [
      { customer: "C3", outcome: "protected" },
      { customer: "C2", outcome: "protected" },
      { customer: "C4", outcome: "delayed", minutes: 42 },
    ],
    log: "Mission 02: reassigned TR-104's orders to {truck}; both on time, East Retail Mart delayed 42 min.",
  },
  hold: {
    label: "Hold",
    summary: "Wait, lower cost, higher SLA risk",
    hint: "Keep the orders on TR-104 until it's moving again, in about 95 minutes. No extra spend.",
    cost: 0,
    slaDelta: -4,
    healthDelta: -3,
    routeRisk: { "D3-C3": 78 },
    exceptions: { unresolved: 1, critical: 1 },
    customers: [
      { customer: "C3", outcome: "delayed", minutes: 95 },
      { customer: "C2", outcome: "delayed", minutes: 95 },
    ],
    log: "Mission 02: held TR-104's orders; both 95 min late, Central Medical Campus past its SLA.",
  },
};

/** The truck Reassign uses: TK-12, unless Mission 01 already sent TK-12 out. */
export function reassignTruck(m1Truck: string | null) {
  return m1Truck === "TK-12" ? "TK-07" : "TK-12";
}
/** Fills the {truck} placeholder in Mission 02 text. */
export function m2Text(text: string, m1Truck: string | null) {
  return text.replaceAll("{truck}", reassignTruck(m1Truck));
}

/** Whether a delay breaks the customer's SLA (their type's tolerance). */
export function breachesSla(customer: string, minutes = 0) {
  return minutes > CUSTOMER_TYPES[NODE_CUSTOMERS[customer].type].toleranceMinutes;
}

/**
 * The Customer Impact line, e.g. "Your decision protects 1 critical delivery
 * and 1 flexible delivery but delays 1 standard shipment by 42 minutes."
 */
export function customerImpactSentence(choice: M2Choice): string {
  const effects = M2_CHOICES[choice].customers;
  // "1 critical delivery and 1 flexible delivery", grouped by customer type.
  const phrase = (list: Effect[], one: string, many: string) => {
    const byType = new Map<string, number>();
    for (const e of list) {
      const t = CUSTOMER_TYPES[NODE_CUSTOMERS[e.customer].type].short.toLowerCase();
      byType.set(t, (byType.get(t) ?? 0) + 1);
    }
    return Array.from(byType, ([t, n]) => `${n} ${t} ${n > 1 ? many : one}`).join(" and ");
  };
  const protectedList = effects.filter((e) => e.outcome === "protected");
  const delayed = effects.filter((e) => e.outcome === "delayed");
  const parts: string[] = [];
  if (protectedList.length) parts.push(`protects ${phrase(protectedList, "delivery", "deliveries")}`);
  if (delayed.length) {
    const breached = delayed.filter((e) => breachesSla(e.customer, e.minutes)).length;
    parts.push(
      `delays ${phrase(delayed, "shipment", "shipments")} by ${delayed[0].minutes} minutes${
        breached ? `, breaking the SLA for ${breached} ${breached > 1 ? "customers" : "customer"}` : ""
      }`
    );
  }
  return `Your decision ${parts.join(" but ")}.`;
}

// --- Investigate (before deciding on an exception) ---------------------------------------------

export type InvestigationId = "fleet-ops" | "sap" | "customer-priority" | "route";

/** Each check reveals one piece of context and costs decision time (minutes, accumulated as a stat). */
export const INVESTIGATIONS: { id: InvestigationId; label: string; minutes: number; finding: string }[] = [
  {
    id: "fleet-ops",
    label: "Ask Fleet Operations",
    minutes: 4,
    finding: "TR-104 has a coolant leak; the mechanic estimates 90–100 minutes. {truck} is idle at D3 with 22 KL free.",
  },
  {
    id: "sap",
    label: "Check SAP Order Data",
    minutes: 6,
    finding: "#5104 is 8 KL of generator diesel promised by 11:30. #5105 is 14 KL of furnace oil with a window until 15:00.",
  },
  {
    id: "customer-priority",
    label: "Check Customer Priority",
    minutes: 3,
    finding: "Central Medical Campus is on the critical-facility list (15-minute tolerance). North-east Steel Works holds two days of buffer stock.",
  },
  {
    id: "route",
    label: "Inspect Route",
    minutes: 5,
    finding: "The ring-road bypass is clear: 18 km longer, about ₹18,500 in tolls and fuel. Reassigning {truck} would push its East Retail Mart run back about 42 minutes.",
  },
];

export const investigationMinutes = (ids: InvestigationId[]) =>
  INVESTIGATIONS.filter((i) => ids.includes(i.id)).reduce((sum, i) => sum + i.minutes, 0);

// --- Mission 03: quality exception --------------------------------------------------------------

/** The shipment in transit when the density check fires. */
export const QUALITY_SHIPMENT = { id: "5120", truck: "TK-31", from: "S1", to: "D2", load: "24 KL diesel", transitSeconds: 5 };

/** Density check at D2's inbound gauge: variance = (recorded − expected) / expected. Tolerance ±0.5%. */
export const DENSITY = { expected: 0.832, recorded: 0.818, tolerancePct: 0.5 };
export const densityVariancePct = () => ((DENSITY.recorded - DENSITY.expected) / DENSITY.expected) * 100;

export const QUALITY_SCORE_START = 92;

export type M3Choice = "accept" | "hold" | "escalate";
export const M3_CHOICES: Record<
  M3Choice,
  {
    label: string;
    summary: string;
    cost: number;
    slaDelta: number;
    healthDelta: number;
    qualityDelta: number;
    minutes: number; // time the decision costs
    consequence: string;
    log: string;
  }
> = {
  accept: {
    label: "Accept",
    summary: "Continue the shipment",
    cost: 0,
    slaDelta: 0,
    healthDelta: -2,
    qualityDelta: -8,
    minutes: 0,
    consequence:
      "The shipment reaches D2 on time, and 24 KL of off-spec diesel goes out to retail outlets. A variance this size points to possible adulteration: expect a customer complaint and a failed audit sample later.",
    log: "Mission 03: accepted shipment #5120 despite a −1.68% density variance; complaint risk later.",
  },
  hold: {
    label: "Hold",
    summary: "Stop for investigation",
    cost: 4_000,
    slaDelta: -2,
    healthDelta: 0,
    qualityDelta: 0,
    minutes: 60,
    consequence:
      "TK-31 waits at the D2 gate while the lab retests. The retest confirms the variance, so the load is quarantined and replaced from D1 stock: an hour late, but nothing off-spec reaches a customer.",
    log: "Mission 03: held shipment #5120 for a retest; load quarantined and replaced, about 60 min late.",
  },
  escalate: {
    label: "Escalate",
    summary: "Send to quality operations",
    cost: 2_500,
    slaDelta: -1,
    healthDelta: 0,
    qualityDelta: 3,
    minutes: 35,
    consequence:
      "Quality operations takes the sample and seal records, releases the load after checks, and logs the variance against the supplier. It costs time now, but the quality score improves and the supplier is on notice.",
    log: "Mission 03: escalated shipment #5120 to quality operations; released after checks, variance logged against the supplier.",
  },
};

// --- Mission 03 (optional): Distribution Integrity ----------------------------------------------

export type IntegrityCheck = "route-deviations" | "delivery-frequency" | "inventory-mismatch";
export const INTEGRITY_CHECKS: { id: IntegrityCheck; label: string; finding: string }[] = [
  {
    id: "route-deviations",
    label: "Inspect route deviations",
    finding: "TK-31 left its planned corridor twice this week near D6: 7.4 km and 22 minutes unaccounted for.",
  },
  {
    id: "delivery-frequency",
    label: "Check delivery frequency",
    finding: "Two retail outlets on the D6 route took 5 deliveries this week against 3 planned.",
  },
  {
    id: "inventory-mismatch",
    label: "Compare inventory records",
    finding: "D6 book stock: 412 cylinders. Physical count: 389, a gap of 23.",
  },
];
export type IntegrityConclusion = "audit" | "close";
export const INTEGRITY_CONCLUSIONS: Record<IntegrityConclusion, { label: string; result: string; log: string }> = {
  audit: {
    label: "Flag for an integrity audit",
    result: "D6 and TK-31's route go on the audit list: GPS, gate logs and stock counts will be reconciled.",
    log: "Mission 03: flagged D6 and TK-31 for a distribution integrity audit.",
  },
  close: {
    label: "Close: no pattern",
    result: "The case is closed. If the signals are real, the gap will keep growing unseen.",
    log: "Mission 03: closed the distribution integrity check with no action.",
  },
};

// --- Network balance ----------------------------------------------------------------------------

export type BalanceKey = "service" | "cost" | "capacity" | "risk";
export type Balance = Record<BalanceKey, number>;

/** Start of day. Service: higher is better. Cost: higher means more spend. Capacity: how fully the fleet is used. Risk: how little slack is left. */
export const BALANCE_START: Balance = { service: 70, cost: 50, capacity: 55, risk: 40 };

export const BALANCE_LABELS: Record<BalanceKey, { label: string; radar: string; better: "higher" | "lower" }> = {
  service: { label: "Service", radar: "SLA", better: "higher" },
  cost: { label: "Cost", radar: "Cost", better: "lower" },
  capacity: { label: "Capacity", radar: "Capacity", better: "higher" },
  risk: { label: "Risk", radar: "Risk", better: "lower" },
};

export type BalanceChange = { source: string; reason: string; deltas: Partial<Balance> };

/**
 * The balance after the decisions so far: the start values plus a fixed
 * change per decision, simple and deterministic.
 * - Consolidating (several orders on one truck) lowers Cost and slightly lowers Service.
 * - Maximising utilisation (90%+) raises Capacity but costs flexibility, so Risk rises.
 * - An under-filled truck (under 70%) lowers Capacity; paying more than separate trucks raises Cost.
 * - Each order left at risk lowers Service and raises Risk (more for critical).
 * - Expediting (Reroute) raises Service and Cost; Reassign trades a little of each and uses a
 *   spare truck; Holding saves a little Cost but lowers Service and raises Risk.
 */
export function balanceChanges(
  m1: ReturnType<typeof dispatchImpact> | null,
  m2: M2Choice | null,
  m3: M3Choice | null = null
): BalanceChange[] {
  const changes: BalanceChange[] = [];
  if (m1) {
    const loaded = ORDERS.length - m1.leftBehind.length;
    if (loaded > 1) changes.push({ source: "Mission 01", reason: `Consolidated ${loaded} orders on one truck`, deltas: { cost: -8, service: -3 } });
    if (m1.utilisation >= 90) changes.push({ source: "Mission 01", reason: `Ran ${m1.truck.id} at ${m1.utilisation}% utilisation`, deltas: { capacity: 10, risk: 5 } });
    else if (m1.utilisation < 70) changes.push({ source: "Mission 01", reason: `${m1.truck.id} left ${100 - m1.utilisation}% empty`, deltas: { capacity: -5 } });
    if (m1.avoidedCost < 0) changes.push({ source: "Mission 01", reason: "Paid more than separate trucks would have", deltas: { cost: 5 } });
    for (const l of m1.leftBehind) {
      if (l.risk === "critical") changes.push({ source: "Mission 01", reason: `Left #${l.order.id} critical`, deltas: { service: -8, risk: 8 } });
      if (l.risk === "at-risk") changes.push({ source: "Mission 01", reason: `Left #${l.order.id} at risk`, deltas: { service: -4, risk: 5 } });
    }
  }
  if (m2 === "reroute") changes.push({ source: "Mission 02", reason: "Expedited TR-104 via the bypass", deltas: { service: 8, cost: 10 } });
  if (m2 === "reassign") changes.push({ source: "Mission 02", reason: "Reassigned to a spare truck; a retail run slipped", deltas: { service: 2, cost: 4, capacity: -6, risk: 3 } });
  if (m2 === "hold") changes.push({ source: "Mission 02", reason: "Held TR-104; a critical delivery breached", deltas: { service: -10, cost: -2, risk: 10 } });
  if (m3 === "accept") changes.push({ source: "Mission 03", reason: "Accepted an off-spec load", deltas: { service: -2, risk: 8 } });
  if (m3 === "hold") changes.push({ source: "Mission 03", reason: "Held a load for a retest", deltas: { service: -4, cost: 3 } });
  if (m3 === "escalate") changes.push({ source: "Mission 03", reason: "Escalated to quality operations", deltas: { service: -2, cost: 2, risk: -3 } });
  return changes;
}

export function balanceFrom(changes: BalanceChange[]): Balance {
  const b = { ...BALANCE_START };
  for (const c of changes) for (const [k, d] of Object.entries(c.deltas)) b[k as BalanceKey] += d;
  for (const k of Object.keys(b) as BalanceKey[]) b[k] = Math.min(100, Math.max(0, b[k]));
  return b;
}

export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// --- Mission 01: Fill the Truck -----------------------------------------------------------

export type TruckType = "Fuel" | "Cylinder" | "Petrochemical";
export type TruckStatus = "Available" | "In transit" | "Maintenance";
export type Truck = {
  id: string;
  capacity: number; // KL
  type: TruckType;
  status: TruckStatus;
  /** Cost of one trip on this truck (₹), whatever it carries. */
  tripCost: number;
};

export const FLEET: Truck[] = [
  { id: "TK-07", capacity: 40, type: "Fuel", status: "Available", tripCost: 40_000 },
  { id: "TK-12", capacity: 24, type: "Fuel", status: "Available", tripCost: 30_000 },
  { id: "TK-44", capacity: 60, type: "Fuel", status: "Available", tripCost: 48_000 },
  { id: "TK-18", capacity: 40, type: "Petrochemical", status: "Available", tripCost: 44_000 },
  { id: "TK-21", capacity: 20, type: "Cylinder", status: "In transit", tripCost: 26_000 },
];

export type Priority = "High" | "Medium" | "Low";
export type Order = {
  id: string;
  customer: string;
  demand: number; // KL
  slaHours: number;
  priority: Priority;
  /** What it costs to send this order on its own truck (₹). */
  soloCost: number;
  /** The order the mission is about. */
  incoming?: boolean;
};

/** All fuel, all Delhi region. #4821 is the incoming order; the rest are pending orders heading the same way. */
export const ORDERS: Order[] = [
  { id: "4821", customer: "Delhi Distribution Hub", demand: 38, slaHours: 4, priority: "High", soloCost: 40_000, incoming: true },
  { id: "4822", customer: "Gurugram Retail", demand: 12, slaHours: 6, priority: "Medium", soloCost: 18_000 },
  { id: "4825", customer: "Noida Fuel Station", demand: 9, slaHours: 8, priority: "Low", soloCost: 15_000 },
  { id: "4827", customer: "Faridabad Depot", demand: 15, slaHours: 5, priority: "High", soloCost: 21_000 },
  { id: "4830", customer: "Sonipat Station", demand: 6, slaHours: 10, priority: "Low", soloCost: 12_000 },
];
export const INCOMING = ORDERS.find((o) => o.incoming)!;

/** Each extra drop on a consolidated run adds this to the truck's trip cost (₹). */
export const STOP_COST = 3_000;
/** Orders left behind wait for the next available truck: ready in 2 h, plus 1.5 h on the road. */
export const NEXT_TRUCK_LEAD_HOURS = 3.5;
/** Average truck utilisation on the network before this dispatch (%). */
export const BASELINE_UTILISATION = 72;

export const orderById = (id: string) => ORDERS.find((o) => o.id === id)!;
export const truckById = (id: string) => FLEET.find((t) => t.id === id)!;
export const loadOf = (ids: string[]) => ids.reduce((sum, id) => sum + orderById(id).demand, 0);

/** Why a truck can't take today's fuel orders, or null if it can. */
export function truckUnavailableReason(t: Truck): string | null {
  if (t.status !== "Available") return t.status;
  if (t.type !== "Fuel") return `${t.type} only`;
  return null;
}

/** Whether an order fits on the truck alongside what's already loaded. */
export function fits(truck: Truck, loaded: string[], orderId: string) {
  return loadOf(loaded) + orderById(orderId).demand <= truck.capacity;
}

/**
 * SLA risk for an order that didn't make this truck: slack = SLA − time until
 * the next truck delivers. Under 1 h is critical, under 2.5 h at risk.
 */
export function leftBehindRisk(o: Order): RouteRisk {
  const slack = o.slaHours - NEXT_TRUCK_LEAD_HOURS;
  return slack < 1 ? "critical" : slack < 2.5 ? "at-risk" : "normal";
}

/**
 * Dispatch impact, fully determined by the truck and the orders combined on it:
 * - avoided cost: what the loaded orders would cost on separate trucks, minus
 *   this truck's trip plus a fee per extra drop (can be negative)
 * - fleet efficiency: this truck's utilisation against the network baseline
 * - SLA risk: each order left behind, rated by its slack for the next truck
 */
export function dispatchImpact(truckId: string, loaded: string[]) {
  const truck = truckById(truckId);
  const load = loadOf(loaded);
  const utilisation = Math.round((load / truck.capacity) * 100);
  const consolidatedCost = truck.tripCost + STOP_COST * Math.max(0, loaded.length - 1);
  const soloCost = loaded.reduce((sum, id) => sum + orderById(id).soloCost, 0);
  const avoidedCost = soloCost - consolidatedCost;
  const efficiencyDelta = utilisation - BASELINE_UTILISATION;
  const leftBehind = ORDERS.filter((o) => !loaded.includes(o.id)).map((o) => ({ order: o, risk: leftBehindRisk(o) }));
  const critical = leftBehind.filter((l) => l.risk === "critical").length;
  const atRisk = leftBehind.filter((l) => l.risk === "at-risk").length;
  return {
    truck,
    load,
    utilisation,
    consolidatedCost,
    avoidedCost,
    efficiencyDelta,
    leftBehind,
    /** SLA points: −4 per critical order left behind, −1.5 per at-risk one. */
    slaDelta: -(critical * 4 + atRisk * 1.5),
    /** Network health points: −3 per critical, −1 per at-risk. */
    healthDelta: -(critical * 3 + atRisk),
    newExceptions: critical + atRisk,
    newCritical: critical,
  };
}

export type DecisionKind =
  | "dispatch"
  | "investigate"
  | "exception"
  | "quality"
  | "integrity-check"
  | "integrity-conclusion"
  | "policy"
  | "policy-off"
  | "consolidation-approved"
  | "consolidation-rejected";

/** What one decision adds to the end-of-shift totals; the sum over the log is the session's totals. */
export type Tally = Partial<Record<"shipments" | "consolidated" | "resolved" | "criticalProtected" | "breaches" | "trucks" | "investigateMinutes", number>>;

/**
 * One logged decision. Everything the ending shows (summary, operating style,
 * Decision Replay) is derived from these entries.
 */
export type DecisionLogEntry = {
  time: string;
  description: string;
  kind: DecisionKind;
  /** The option picked (e.g. "reroute", "accept", "expedite"), where there was one. */
  choice?: string;
  impact: string;
  secondary?: string;
  tally?: Tally;
  /** A truck run the player loaded: counts towards load utilisation. */
  run?: { load: number; capacity: number };
};

/** The decisionLog line for a dispatch. */
export function describeDispatch(impact: ReturnType<typeof dispatchImpact>, loaded: string[]) {
  const orders = loaded.map((id) => `#${id}`).join(", ");
  const behind = impact.leftBehind.filter((l) => l.risk !== "normal").map((l) => `#${l.order.id} ${RISK_LABEL[l.risk].toLowerCase()}`);
  const cost = impact.avoidedCost >= 0 ? `avoided ${inr.format(impact.avoidedCost)}` : `cost ${inr.format(-impact.avoidedCost)} more than separate trucks`;
  return `Mission 01: dispatched ${impact.truck.id} with ${orders} (${impact.load}/${impact.truck.capacity} KL, ${impact.utilisation}% full); ${cost}${
    behind.length ? `; left behind: ${behind.join(", ")}` : ""
  }.`;
}

export function formatClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

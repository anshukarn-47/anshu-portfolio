/**
 * Capacity fit: plan four sprints of fixed capacity. Fictional data in a fixed
 * order, and a pure reducer, so the same choices always give the same result.
 * See docs/arcade-game-rules.md.
 */

export type ItemType = "feature" | "bug" | "compliance" | "debt" | "defect";
export type Risk = "low" | "medium" | "high";

export type WorkItem = {
  id: string;
  title: string;
  type: ItemType;
  /** Width in capacity units, 1 to 4. */
  units: number;
  /** Features only: 1 to 5. */
  value?: number;
  /** Features only. */
  risk?: Risk;
  /** Compliance only: the sprint (1-based) it must ship in, at the latest. */
  deadline?: number;
};

export const SPRINTS = 4;
export const ROW_UNITS = 6;

/** The backlog, in arrival order. Fictional. 34 units of work for 24 units of capacity. */
export const ITEMS: WorkItem[] = [
  { id: "F-1", title: "Saved payment methods", type: "feature", units: 3, value: 4, risk: "low" },
  { id: "B-1", title: "Sign-in timeout on slow networks", type: "bug", units: 1 },
  { id: "C-1", title: "Consent record retention", type: "compliance", units: 2, deadline: 2 },
  { id: "F-2", title: "Extra colour theme", type: "feature", units: 2, value: 1, risk: "low" },
  { id: "T-1", title: "Upgrade an outdated library", type: "debt", units: 2 },
  { id: "F-3", title: "Live order tracking", type: "feature", units: 4, value: 5, risk: "high" },
  { id: "F-4", title: "Profile badges", type: "feature", units: 1, value: 1, risk: "low" },
  { id: "B-2", title: "Duplicate notifications", type: "bug", units: 1 },
  { id: "F-5", title: "Bulk reorder", type: "feature", units: 3, value: 4, risk: "medium" },
  { id: "C-2", title: "Accessibility statement", type: "compliance", units: 1, deadline: 3 },
  { id: "T-2", title: "Retire a legacy interface", type: "debt", units: 3 },
  { id: "F-6", title: "Smarter search", type: "feature", units: 2, value: 3, risk: "low" },
  { id: "F-7", title: "Loyalty points view", type: "feature", units: 3, value: 2, risk: "medium" },
  { id: "B-3", title: "Crash on older devices", type: "bug", units: 2 },
  { id: "T-3", title: "Rebuild flaky checkout tests", type: "debt", units: 2 },
  { id: "F-8", title: "Animated welcome screen", type: "feature", units: 2, value: 1, risk: "low" },
];

/** Arrives mid-game and must go into the current sprint. */
export const CRITICAL_DEFECT: WorkItem = { id: "X-1", title: "Checkout fails for some cards", type: "defect", units: 3 };
/** It arrives in sprint 3 (index 2), once 4 or more of its units are planned, or when sprint 3 is about to ship. */
export const DEFECT_SPRINT = 2;
export const DEFECT_TRIGGER_UNITS = 4;

/** Real milliseconds for an item to descend and drop. Relaxed mode never drops it. */
export const DESCENT_MS = 7000;

export const HEALTH = { start: 60, perSprint: -8, perDebtUnit: 8, min: 0, max: 100 } as const;

/** Points: value weighted by priority (risk lowers a feature's expected value), compliance on time, health, and a little per release. */
export const POINTS = {
  riskWeight: { low: 2, medium: 1.5, high: 1 } as Record<Risk, number>,
  bug: 3,
  complianceOnTime: 8,
  complianceLate: 2,
  release: 1,
  /** Final health divided by this. */
  healthDivisor: 3,
} as const;

export const TYPE_LABEL: Record<ItemType, string> = {
  feature: "Feature",
  bug: "Bug",
  compliance: "Compliance",
  debt: "Technical debt",
  defect: "Critical defect",
};

export const itemPoints = (i: WorkItem) => (i.type === "feature" ? (i.value ?? 0) * POINTS.riskWeight[i.risk ?? "low"] : i.type === "bug" ? POINTS.bug : 0);

// --- State ------------------------------------------------------------------------------------------

export type Placed = { item: WorkItem; start: number };
export type Shipped = { sprint: number; items: WorkItem[]; unused: number; healthAfter: number };

export type CapacityState = {
  /** Current sprint, 0-based. */
  sprint: number;
  rows: Placed[][];
  /** Next index in ITEMS. */
  queue: number;
  /** Carried-over items, offered before new ones this sprint. */
  offers: WorkItem[];
  /** Moved to carryover during this sprint; offered next sprint. */
  carry: WorkItem[];
  active: WorkItem | null;
  pos: number;
  mode: "place" | "make-room" | "done";
  defect: "pending" | "arrived" | "placed";
  health: number;
  shipped: Shipped[];
  /** Units ever planned into each sprint (including any later moved out). */
  planned: number[];
  /** The latest event, announced to screen readers. */
  note: string;
};

export function occupancy(row: Placed[]) {
  const cells = Array<WorkItem | null>(ROW_UNITS).fill(null);
  for (const p of row) for (let c = p.start; c < p.start + p.item.units; c++) cells[c] = p.item;
  return cells;
}
export const usedUnits = (row: Placed[]) => row.reduce((s, p) => s + p.item.units, 0);
export function fitsAt(row: Placed[], units: number, start: number) {
  if (start < 0 || start + units > ROW_UNITS) return false;
  const cells = occupancy(row);
  for (let c = start; c < start + units; c++) if (cells[c]) return false;
  return true;
}
export const validStarts = (row: Placed[], units: number) => Array.from({ length: ROW_UNITS - units + 1 }, (_, i) => i).filter((s) => fitsAt(row, units, s));
/** The valid start closest to `from` (ties go left), or `from` clamped if nothing fits. */
export function nearestStart(row: Placed[], units: number, from: number) {
  const starts = validStarts(row, units);
  if (!starts.length) return Math.max(0, Math.min(ROW_UNITS - units, from));
  return starts.reduce((best, s) => (Math.abs(s - from) < Math.abs(best - from) ? s : best), starts[0]);
}

export function initialState(): CapacityState {
  const s: CapacityState = {
    sprint: 0,
    rows: Array.from({ length: SPRINTS }, () => []),
    queue: 0,
    offers: [],
    carry: [],
    active: null,
    pos: 0,
    mode: "place",
    defect: "pending",
    health: HEALTH.start,
    shipped: [],
    planned: Array(SPRINTS).fill(0),
    note: "",
  };
  return activateNext(s);
}

const row = (s: CapacityState) => s.rows[s.sprint];
const withRow = (s: CapacityState, r: Placed[]) => s.rows.map((x, i) => (i === s.sprint ? r : x));
const sprintName = (i: number) => `Sprint ${i + 1}`;

/** Offers the next item: carried-over work first, then the backlog. Ships the sprint when nothing is left to offer. */
function activateNext(s: CapacityState): CapacityState {
  if (s.offers.length) {
    const [next, ...rest] = s.offers;
    return { ...s, offers: rest, active: next, pos: nearestStart(row(s), next.units, 0), mode: "place" };
  }
  if (s.queue < ITEMS.length) {
    const next = ITEMS[s.queue];
    return { ...s, queue: s.queue + 1, active: next, pos: nearestStart(row(s), next.units, 0), mode: "place" };
  }
  return ship({ ...s, active: null });
}

function defectDue(s: CapacityState) {
  return s.sprint === DEFECT_SPRINT && s.defect === "pending";
}

/** The critical defect arrives: it must go into this sprint, so make room first if there isn't a 3-unit gap. */
function arriveDefect(s: CapacityState, returning: WorkItem | null): CapacityState {
  const offers = returning ? [returning, ...s.offers] : s.offers;
  const room = validStarts(row(s), CRITICAL_DEFECT.units).length > 0;
  return {
    ...s,
    offers,
    defect: "arrived",
    active: CRITICAL_DEFECT,
    pos: nearestStart(row(s), CRITICAL_DEFECT.units, 0),
    mode: room ? "place" : "make-room",
    note: room
      ? `Critical defect: ${CRITICAL_DEFECT.title}. It goes into ${sprintName(s.sprint)} now.`
      : `Critical defect: ${CRITICAL_DEFECT.title}. It needs ${CRITICAL_DEFECT.units} units in ${sprintName(s.sprint)}, so choose planned work to move to carryover.`,
  };
}

/** After a placement or deferral: the defect may arrive, a full sprint ships, or the next item is offered. */
function advance(s: CapacityState): CapacityState {
  if (defectDue(s) && usedUnits(row(s)) >= DEFECT_TRIGGER_UNITS) return arriveDefect({ ...s, active: null }, null);
  if (usedUnits(row(s)) >= ROW_UNITS) return ship({ ...s, active: null });
  return activateNext(s);
}

function ship(s: CapacityState): CapacityState {
  if (defectDue(s)) return arriveDefect(s, s.active);
  const items = row(s).map((p) => p.item);
  const debtUnits = items.filter((i) => i.type === "debt").reduce((n, i) => n + i.units, 0);
  const health = Math.max(HEALTH.min, Math.min(HEALTH.max, s.health + HEALTH.perSprint + debtUnits * HEALTH.perDebtUnit));
  const unused = ROW_UNITS - usedUnits(row(s));
  const shipped = [...s.shipped, { sprint: s.sprint, items, unused, healthAfter: health }];
  const note = items.length
    ? `${sprintName(s.sprint)} shipped a release: ${items.length} ${items.length === 1 ? "item" : "items"}${unused ? `, ${unused} ${unused === 1 ? "unit" : "units"} unused` : ""}.`
    : `${sprintName(s.sprint)} closed with nothing shipped.`;
  // Anything not yet offered or in hand carries over too.
  const carried = [...(s.active ? [s.active] : []), ...s.offers, ...s.carry];
  if (s.sprint >= SPRINTS - 1) return { ...s, shipped, health, active: null, offers: [], carry: carried, mode: "done", note: `${note} That was the last sprint.` };
  return activateNext({ ...s, shipped, health, sprint: s.sprint + 1, offers: carried, carry: [], active: null, note });
}

export type CapacityAction =
  | { type: "move"; dir: -1 | 1 }
  | { type: "move-to"; col: number }
  | { type: "drop" }
  | { type: "defer" }
  | { type: "ship-now" }
  | { type: "bump"; id: string }
  /** The descent timer ran out: drop where it is if it fits there, otherwise carry it over. */
  | { type: "timeout" };

export function capacityReducer(s: CapacityState, a: CapacityAction): CapacityState {
  if (s.mode === "done") return s;
  const r = row(s);
  switch (a.type) {
    case "move": {
      if (!s.active || s.mode !== "place") return s;
      const starts = validStarts(r, s.active.units);
      if (!starts.length) return s;
      const next = a.dir > 0 ? starts.find((x) => x > s.pos) : [...starts].reverse().find((x) => x < s.pos);
      return next === undefined ? s : { ...s, pos: next };
    }
    case "move-to": {
      if (!s.active || s.mode !== "place") return s;
      return { ...s, pos: nearestStart(r, s.active.units, Math.min(a.col, ROW_UNITS - s.active.units)) };
    }
    case "drop":
    case "timeout": {
      if (!s.active || s.mode !== "place") return s;
      const item = s.active;
      if (!fitsAt(r, item.units, s.pos)) {
        if (a.type === "drop" || item.type === "defect") return s;
        return advance({ ...s, carry: [...s.carry, item], active: null, note: `No room for ${item.id} ${item.title}, so it moved to carryover.` });
      }
      const placed = [...r, { item, start: s.pos }];
      const planned = s.planned.map((n, i) => (i === s.sprint ? n + item.units : n));
      const note = `${item.id} ${item.title} planned into ${sprintName(s.sprint)}.`;
      return advance({
        ...s,
        rows: withRow(s, placed),
        planned,
        active: null,
        defect: item.type === "defect" ? "placed" : s.defect,
        note,
      });
    }
    case "defer": {
      if (!s.active || s.mode !== "place" || s.active.type === "defect") return s;
      const item = s.active;
      return advance({ ...s, carry: [...s.carry, item], active: null, note: `${item.id} ${item.title} moved to carryover.` });
    }
    case "ship-now": {
      if (s.mode !== "place" || s.active?.type === "defect") return s;
      return ship(s);
    }
    case "bump": {
      if (s.mode !== "make-room") return s;
      const target = r.find((p) => p.item.id === a.id);
      if (!target) return s;
      const rest = r.filter((p) => p.item.id !== a.id);
      const room = validStarts(rest, CRITICAL_DEFECT.units).length > 0;
      return {
        ...s,
        rows: withRow(s, rest),
        carry: [...s.carry, target.item],
        mode: room ? "place" : "make-room",
        pos: nearestStart(rest, CRITICAL_DEFECT.units, 0),
        note: `${target.item.id} ${target.item.title} moved to carryover.${room ? " There's room for the defect now." : ""}`,
      };
    }
  }
}

// --- Results ------------------------------------------------------------------------------------------

export type CapacitySummary = {
  score: number;
  priorityValue: number;
  compliance: { onTime: number; late: number; missed: number; total: number; points: number };
  healthPoints: number;
  releases: number;
  health: number;
  plannedUnits: number;
  deliveredUnits: number;
  carryoverUnits: number;
  /** Not yet offered when the last sprint shipped. */
  backlogLeft: number;
  perSprint: { sprint: number; planned: number; delivered: number; unused: number }[];
};

export function summarise(s: CapacityState): CapacitySummary {
  const shippedItems = s.shipped.flatMap((x) => x.items.map((item) => ({ item, sprint: x.sprint + 1 })));
  const priorityValue = shippedItems.reduce((n, { item }) => n + itemPoints(item), 0);
  const complianceItems = ITEMS.filter((i) => i.type === "compliance");
  let onTime = 0;
  let late = 0;
  for (const c of complianceItems) {
    const hit = shippedItems.find((x) => x.item.id === c.id);
    if (hit && hit.sprint <= (c.deadline ?? SPRINTS)) onTime++;
    else if (hit) late++;
  }
  const compliancePoints = onTime * POINTS.complianceOnTime + late * POINTS.complianceLate;
  const releases = s.shipped.filter((x) => x.items.length > 0).length;
  const healthPoints = Math.round(s.health / POINTS.healthDivisor);
  const deliveredUnits = shippedItems.reduce((n, { item }) => n + item.units, 0);
  return {
    score: Math.round(priorityValue + compliancePoints + healthPoints + releases * POINTS.release),
    priorityValue: Math.round(priorityValue * 10) / 10,
    compliance: { onTime, late, missed: complianceItems.length - onTime - late, total: complianceItems.length, points: compliancePoints },
    healthPoints,
    releases,
    health: s.health,
    plannedUnits: s.planned.reduce((a, b) => a + b, 0),
    deliveredUnits,
    carryoverUnits: s.carry.reduce((n, i) => n + i.units, 0),
    backlogLeft: ITEMS.length - s.queue,
    perSprint: s.shipped.map((x) => ({
      sprint: x.sprint + 1,
      planned: s.planned[x.sprint],
      delivered: x.items.reduce((n, i) => n + i.units, 0),
      unused: x.unused,
    })),
  };
}

/** Live meters while playing. */
export function meters(s: CapacityState) {
  const shippedItems = s.shipped.flatMap((x) => x.items);
  return {
    value: Math.round(shippedItems.reduce((n, i) => n + itemPoints(i), 0) * 10) / 10,
    health: s.health,
    carryover: [...s.offers, ...s.carry].reduce((n, i) => n + i.units, 0),
  };
}

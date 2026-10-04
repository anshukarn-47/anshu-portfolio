/**
 * Automation bundles: sort twelve fictional processes into four zones. Fixed
 * data and pure functions, so the same choices always give the same result.
 * Every hour here is simulated. See docs/arcade-game-rules.md.
 */

export type Volume = "low" | "medium" | "high";
export type Zone = "automate" | "bundle" | "redesign" | "manual";

export type Process = {
  id: string;
  name: string;
  /** Fictional system names only. */
  system: string;
  volume: Volume;
  stable: boolean;
  ruleBased: boolean;
  /** Share of runs that need a person, as a percentage. */
  exceptionRate: number;
};

export const ZONES: { id: Zone; label: string; key: string; hint: string }[] = [
  { id: "automate", label: "Automate now", key: "1", hint: "Build it on its own" },
  { id: "bundle", label: "Bundle with others", key: "2", hint: "Share the build with processes on the same system" },
  { id: "redesign", label: "Redesign first", key: "3", hint: "Fix the process before automating it" },
  { id: "manual", label: "Leave manual", key: "4", hint: "Not worth automating now" },
];
export const zoneLabel = (z: Zone) => ZONES.find((x) => x.id === z)!.label;

/** The twelve processes, in arrival order. Fictional. */
export const PROCESSES: Process[] = [
  { id: "P-01", name: "Invoice matching", system: "Ledgerline", volume: "high", stable: true, ruleBased: true, exceptionRate: 2 },
  { id: "P-02", name: "Expense approvals", system: "Ledgerline", volume: "medium", stable: false, ruleBased: false, exceptionRate: 18 },
  { id: "P-03", name: "Stock level report", system: "Stockroom", volume: "high", stable: true, ruleBased: true, exceptionRate: 1 },
  { id: "P-04", name: "New starter accounts", system: "Crewdesk", volume: "medium", stable: true, ruleBased: true, exceptionRate: 2 },
  { id: "P-05", name: "Order confirmation emails", system: "Orderbook", volume: "high", stable: true, ruleBased: true, exceptionRate: 1 },
  { id: "P-06", name: "Damaged goods claims", system: "Stockroom", volume: "low", stable: false, ruleBased: false, exceptionRate: 25 },
  { id: "P-07", name: "Leave balance queries", system: "Crewdesk", volume: "high", stable: false, ruleBased: true, exceptionRate: 12 },
  { id: "P-08", name: "Supplier payment run", system: "Ledgerline", volume: "medium", stable: true, ruleBased: true, exceptionRate: 3 },
  { id: "P-09", name: "Address change requests", system: "Orderbook", volume: "low", stable: true, ruleBased: true, exceptionRate: 5 },
  { id: "P-10", name: "Contract amendments", system: "Crewdesk", volume: "low", stable: true, ruleBased: false, exceptionRate: 10 },
  { id: "P-11", name: "Reorder requests", system: "Stockroom", volume: "medium", stable: true, ruleBased: true, exceptionRate: 4 },
  { id: "P-12", name: "Pricing exceptions", system: "Orderbook", volume: "medium", stable: false, ruleBased: false, exceptionRate: 30 },
];

/** Simulated model constants. */
export const MODEL = {
  runsPerMonth: { low: 40, medium: 120, high: 400 } as Record<Volume, number>,
  minutesPerRun: 5,
  /** Share of the manual work automation takes over. */
  capture: { ruleBased: 0.85, judgement: 0.35 },
  /** Unstable processes throw this many times more exceptions once automated. */
  unstableExceptionFactor: 3,
  minutesPerException: 15,
  /** Monthly upkeep of one automation, in hours. Bundles share it. */
  upkeepHours: 4,
  /** Two or more bundled processes on one system share components. */
  bundleMultiplier: 1.2,
  /** Redesign effort now, and the share of the manual hours it recovers later (unstable or judgement-based processes only). */
  redesignCostHours: 2,
  redesignRecovery: 0.3,
} as const;

/** Real seconds to decide each card in normal mode; it stays manual if time runs out. Relaxed mode has no timer. */
export const DECISION_SECONDS = 12;

export const manualHours = (p: Process) => (MODEL.runsPerMonth[p.volume] * MODEL.minutesPerRun) / 60;
/** A strong candidate: high volume, stable and rule-based. Leaving one manual wastes hours. */
export const isStrongCandidate = (p: Process) => p.volume === "high" && p.stable && p.ruleBased;

export type Outcome = { process: Process; zone: Zone; net: number; exceptions: number; note: string };

/** Each process's simulated monthly outcome, given every assignment (bundles depend on their neighbours). */
export function evaluate(assign: Record<string, Zone>): Outcome[] {
  const bundledOn = (system: string) => PROCESSES.filter((p) => p.system === system && assign[p.id] === "bundle").length;
  return PROCESSES.filter((p) => assign[p.id]).map((p) => {
    const zone = assign[p.id];
    const hours = manualHours(p);
    const runs = MODEL.runsPerMonth[p.volume];
    const exceptions = Math.round(runs * (p.exceptionRate / 100) * (p.stable ? 1 : MODEL.unstableExceptionFactor));
    const exceptionHours = (exceptions * MODEL.minutesPerException) / 60;
    const gross = hours * (p.ruleBased ? MODEL.capture.ruleBased : MODEL.capture.judgement);
    if (zone === "automate" || zone === "bundle") {
      const group = zone === "bundle" ? bundledOn(p.system) : 1;
      const shared = group >= 2;
      const net = gross * (shared ? MODEL.bundleMultiplier : 1) - exceptionHours - MODEL.upkeepHours / group;
      const note =
        zone === "bundle" && !shared
          ? `Nothing else on ${p.system} is bundled yet, so it's built on its own`
          : !p.stable
            ? `Unstable: ${exceptions} exceptions a month need a person`
            : shared
              ? `Bundled with ${group - 1} other ${group - 1 === 1 ? "process" : "processes"} on ${p.system}`
              : `${exceptions} exceptions a month`;
      return { process: p, zone, net, exceptions, note };
    }
    if (zone === "redesign") {
      const worth = !p.stable || !p.ruleBased;
      const net = (worth ? hours * MODEL.redesignRecovery : 0) - MODEL.redesignCostHours;
      return { process: p, zone, net, exceptions: 0, note: worth ? "Redesign effort now; easier to automate later" : "Already stable and rule-based, so redesign adds effort" };
    }
    return {
      process: p,
      zone,
      net: 0,
      exceptions: 0,
      note: isStrongCandidate(p) ? `${Math.round(hours)} manual hours a month stay with the team` : "Stays manual",
    };
  });
}

export type Totals = {
  net: number;
  /** Share of all twelve processes automated or bundled. */
  coverage: number;
  exceptions: number;
  /** Manual hours still spent on strong candidates left manual. */
  hoursLeftOnTable: number;
  automated: number;
};

export function totals(assign: Record<string, Zone>): Totals {
  const out = evaluate(assign);
  const automated = out.filter((o) => o.zone === "automate" || o.zone === "bundle");
  return {
    net: out.reduce((n, o) => n + o.net, 0),
    coverage: Math.round((automated.length / PROCESSES.length) * 100),
    exceptions: automated.reduce((n, o) => n + o.exceptions, 0),
    hoursLeftOnTable: out.filter((o) => o.zone === "manual" && isStrongCandidate(o.process)).reduce((n, o) => n + manualHours(o.process), 0),
    automated: automated.length,
  };
}

/** The best net hours available: systems are independent, so search every zone combination per system. */
export const BEST_NET = (() => {
  const zones: Zone[] = ["automate", "bundle", "redesign", "manual"];
  const systems = [...new Set(PROCESSES.map((p) => p.system))];
  let best = 0;
  for (const system of systems) {
    const ps = PROCESSES.filter((p) => p.system === system);
    let top = -Infinity;
    for (let n = 0; n < zones.length ** ps.length; n++) {
      const assign: Record<string, Zone> = {};
      ps.forEach((p, i) => (assign[p.id] = zones[Math.floor(n / zones.length ** i) % zones.length]));
      top = Math.max(top, evaluate(assign).reduce((s, o) => s + o.net, 0));
    }
    best += top;
  }
  return best;
})();

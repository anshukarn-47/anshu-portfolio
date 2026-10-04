/**
 * Sprint slice: choose what goes into one 20-point sprint as backlog items
 * drift past. Fixed fictional data and pure scoring, so the same choices always
 * give the same result. See docs/arcade-game-rules.md.
 */

export type SliceType = "feature" | "bug" | "debt" | "nice";
export type Risk = "low" | "medium" | "high";

export type BacklogItem = {
  id: string;
  title: string;
  type: SliceType;
  /** Business value, 1 to 8 (bugs and debt have none). */
  value: number;
  /** Effort in capacity points. */
  effort: number;
  risk: Risk;
};

export const CAPACITY = 20;
export const LANES = 3;

/** The backlog, in arrival order. Fictional. 47 points of effort for 20 points of capacity. */
export const BACKLOG: BacklogItem[] = [
  { id: "S-01", title: "Guest checkout", type: "feature", value: 8, effort: 5, risk: "low" },
  { id: "S-02", title: "Promo banner refresh", type: "nice", value: 1, effort: 3, risk: "low" },
  { id: "S-03", title: "Payments fail on retry", type: "bug", value: 0, effort: 3, risk: "low" },
  { id: "S-04", title: "Update the logging library", type: "debt", value: 0, effort: 2, risk: "low" },
  { id: "S-05", title: "Saved searches", type: "feature", value: 5, effort: 5, risk: "medium" },
  { id: "S-06", title: "Social sharing", type: "feature", value: 2, effort: 4, risk: "low" },
  { id: "S-07", title: "Mascot animation", type: "nice", value: 1, effort: 2, risk: "low" },
  { id: "S-08", title: "Delivery slot picker", type: "feature", value: 7, effort: 4, risk: "medium" },
  { id: "S-09", title: "Remove dead feature flags", type: "debt", value: 0, effort: 2, risk: "low" },
  { id: "S-10", title: "Extra colour theme", type: "feature", value: 3, effort: 5, risk: "low" },
  { id: "S-11", title: "Data export times out", type: "bug", value: 0, effort: 2, risk: "low" },
  { id: "S-12", title: "One-tap reorder", type: "feature", value: 6, effort: 3, risk: "low" },
  { id: "S-13", title: "Seasonal theme", type: "nice", value: 1, effort: 3, risk: "low" },
  { id: "S-14", title: "Split an oversized service", type: "debt", value: 0, effort: 4, risk: "high" },
];

export const TYPE_LABEL: Record<SliceType, string> = { feature: "Feature", bug: "Critical bug", debt: "Technical debt", nice: "Nice-to-have" };

/** Timing in real milliseconds. Relaxed mode is slower, and items pause on hover or focus. */
export const TIMING = {
  spawnEveryMs: 2400,
  driftMs: 8000,
  relaxedSpawnFactor: 1.6,
  relaxedDriftFactor: 2,
} as const;

export const SCORING = {
  riskFactor: { low: 1, medium: 0.8, high: 0.6 } as Record<Risk, number>,
  /** Value points: risk-adjusted value per capacity point, times this. */
  valueScale: 20,
  stabilityPerBug: 6,
  healthStart: 60,
  healthPerDebt: 12,
  /** Skipping debt costs more each time in a row: 8, then 16, then 24. Including debt resets the run. */
  healthPerSkippedDebtStep: 8,
  healthDivisor: 10,
  scopeCreepPerPoint: 4,
} as const;

export const adjustedValue = (i: BacklogItem) => i.value * SCORING.riskFactor[i.risk];

export type SliceResult = {
  score: number;
  used: number;
  over: number;
  valuePoints: number;
  value: number;
  stability: number;
  health: number;
  healthPoints: number;
  scopePenalty: number;
};

/** Scores a set of included ids. Health depends on the order debt was met, which is fixed. */
export function scoreSlice(included: Set<string>): SliceResult {
  const inc = BACKLOG.filter((i) => included.has(i.id));
  const used = inc.reduce((n, i) => n + i.effort, 0);
  const over = Math.max(0, used - CAPACITY);
  const value = inc.reduce((n, i) => n + adjustedValue(i), 0);
  const valuePoints = Math.round((value / CAPACITY) * SCORING.valueScale);
  const stability = inc.filter((i) => i.type === "bug").length * SCORING.stabilityPerBug;
  const health = healthAfter(included);
  const healthPoints = Math.round(health / SCORING.healthDivisor);
  const scopePenalty = over * SCORING.scopeCreepPerPoint;
  return { score: valuePoints + stability + healthPoints - scopePenalty, used, over, valuePoints, value: Math.round(value * 10) / 10, stability, health, healthPoints, scopePenalty };
}

/** Health after every debt item has been met (included, or skipped). */
export function healthAfter(included: Set<string>, upTo = BACKLOG.length) {
  let health: number = SCORING.healthStart;
  let skippedRun = 0;
  for (const i of BACKLOG.slice(0, upTo)) {
    if (i.type !== "debt") continue;
    if (included.has(i.id)) {
      health += SCORING.healthPerDebt;
      skippedRun = 0;
    } else {
      skippedRun++;
      health -= SCORING.healthPerSkippedDebtStep * skippedRun;
    }
  }
  return Math.max(0, Math.min(100, health));
}

/** The best score available: every subset of the fixed backlog. */
export const BEST_SCORE = (() => {
  let best = -Infinity;
  for (let mask = 0; mask < 1 << BACKLOG.length; mask++) {
    const set = new Set(BACKLOG.filter((_, i) => mask & (1 << i)).map((i) => i.id));
    best = Math.max(best, scoreSlice(set).score);
  }
  return best;
})();

/** One neutral line on why an item's decision played out as it did. */
export function reasonFor(i: BacklogItem, included: boolean): string {
  const density = i.value ? adjustedValue(i) / i.effort : 0;
  const per = `${(Math.round(density * 10) / 10).toString()} value per point`;
  if (i.type === "bug") return included ? `Fixes a critical bug: +${SCORING.stabilityPerBug} stability` : "Critical bug left open: no stability gained";
  if (i.type === "debt") return included ? `Pays down debt: health up ${SCORING.healthPerDebt}` : "Debt deferred again: health fell";
  if (i.type === "nice") return included ? `Low value for ${i.effort} points of capacity` : `Low value, so its ${i.effort} points went elsewhere`;
  const riskNote = i.risk === "low" ? "" : `, ${i.risk} risk`;
  if (density >= 1.2) return included ? `Strong value for its effort (${per}${riskNote})` : `Strong value left out (${per}${riskNote})`;
  if (density >= 0.8) return included ? `Fair value for its effort (${per}${riskNote})` : `Fair value, but other items gave more per point (${per})`;
  return included ? `Thin value for its effort (${per}${riskNote})` : `Thin value for its effort (${per}), so skipping it freed capacity`;
}

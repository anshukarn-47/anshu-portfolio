import { describe, expect, it } from "vitest";
import { BEST_NET, PROCESSES, evaluate, totals, type Zone } from "@/lib/arcade/games/automation-bundles";

const all = (z: Zone) => Object.fromEntries(PROCESSES.map((p) => [p.id, z])) as Record<string, Zone>;
const REASONABLE: Record<string, Zone> = {
  "P-01": "bundle",
  "P-08": "bundle",
  "P-02": "redesign",
  "P-03": "bundle",
  "P-11": "bundle",
  "P-06": "manual",
  "P-04": "automate",
  "P-07": "redesign",
  "P-10": "manual",
  "P-05": "bundle",
  "P-09": "bundle",
  "P-12": "redesign",
};
const round1 = (n: number) => Math.round(n * 10) / 10;

describe("automation bundles", () => {
  it("has twelve processes, three on each of four systems", () => {
    expect(PROCESSES).toHaveLength(12);
    const bySystem = PROCESSES.reduce<Record<string, number>>((m, p) => ({ ...m, [p.system]: (m[p.system] ?? 0) + 1 }), {});
    expect(Object.values(bySystem)).toEqual([3, 3, 3, 3]);
  });

  it("rewards net value, not coverage", () => {
    const automateAll = totals(all("automate"));
    const bundleAll = totals(all("bundle"));
    const reasonable = totals(REASONABLE);
    expect(automateAll.coverage).toBe(100);
    expect(round1(automateAll.net)).toBe(8);
    expect(round1(bundleAll.net)).toBe(70.2);
    expect(round1(reasonable.net)).toBe(121.1);
    expect(reasonable.coverage).toBeLessThan(automateAll.coverage);
    expect(reasonable.net).toBeGreaterThan(bundleAll.net);
  });

  it("knows the best possible net, and nothing beats it", () => {
    expect(round1(BEST_NET)).toBe(123.2);
    expect(totals(REASONABLE).net).toBeLessThanOrEqual(BEST_NET);
  });

  it("makes automating an unstable process cost hours and raise exceptions", () => {
    const redesign = totals({ ...REASONABLE, "P-07": "redesign" });
    const automate = totals({ ...REASONABLE, "P-07": "automate" });
    expect(automate.net).toBeLessThan(redesign.net);
    expect(automate.exceptions).toBeGreaterThan(redesign.exceptions + 100);
  });

  it("counts a strong candidate left manual as hours left on the table", () => {
    const t = totals({ ...REASONABLE, "P-01": "manual" });
    expect(t.hoursLeftOnTable).toBeGreaterThan(30);
  });

  it("only gives the bundle bonus when two or more on one system are bundled", () => {
    const alone = evaluate({ "P-01": "bundle" })[0];
    const automated = evaluate({ "P-01": "automate" })[0];
    expect(alone.net).toBeCloseTo(automated.net);
    const pair = evaluate({ "P-01": "bundle", "P-08": "bundle" }).find((o) => o.process.id === "P-01")!;
    expect(pair.net).toBeGreaterThan(alone.net);
  });
});

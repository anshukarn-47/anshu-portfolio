"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  PROBLEM,
  RULE_ARRIVAL_MS,
  RULE_IF,
  RULE_N,
  RULE_PAYMENTS,
  RULE_START,
  RULE_STREAM,
  RULE_THEN,
  RULE_WHEN,
  RULE_WINDOW_MINUTES,
  STREAM_SIGNATURE,
  ruleHeadline,
  simulateRule,
  type Rule,
  type RuleResult,
  type StreamOutcome,
} from "./model";

/**
 * The automation studio: a WHEN / IF / THEN rule, then a deterministic run over
 * a fixed window of new incidents. The result is described, never graded; the
 * player can edit and re-run, then keep the rule (which is logged).
 */
export function AutomationStudio({
  repeatBefore,
  kept,
  onKeep,
}: {
  /** The repeat-incident count when the rule goes live. */
  repeatBefore: number;
  kept: boolean;
  onKeep: (rule: Rule, result: RuleResult, runs: number) => void;
}) {
  const reduce = useReducedMotion();
  const [rule, setRule] = useState<Rule>(RULE_START);
  const [ran, setRan] = useState<{ rule: Rule; result: RuleResult } | null>(null);
  const [runs, setRuns] = useState(0);
  // Arrivals shown so far in the current run.
  const [shown, setShown] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const stale = ran !== null && JSON.stringify(ran.rule) !== JSON.stringify(rule);
  const playing = ran !== null && shown < RULE_STREAM.length;
  const locked = kept || playing;

  const activate = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setRan({ rule, result: simulateRule(rule, repeatBefore) });
    setRuns((n) => n + 1);
    if (reduce) return setShown(RULE_STREAM.length);
    setShown(0);
    RULE_STREAM.forEach((_, i) => timers.current.push(window.setTimeout(() => setShown(i + 1), (i + 1) * RULE_ARRIVAL_MS)));
  };

  const setN = (v: number) => setRule((r) => ({ ...r, n: Math.min(RULE_N.max, Math.max(RULE_N.min, Math.round(v) || RULE_N.min)) }));
  const toggleThen = (id: Rule["then"][number]) =>
    setRule((r) => ({ ...r, then: r.then.includes(id) ? r.then.filter((t) => t !== id) : [...r.then, id] }));

  const card = "rounded-md border border-rule bg-ink p-3";
  const legend = "font-mono text-xs uppercase tracking-wider text-text-faint";
  const option = "flex items-start gap-2 text-sm text-text has-[:disabled]:opacity-60";

  return (
    <section aria-labelledby="automation-title" className="rounded-lg border border-rule bg-panel p-4">
      <h4 id="automation-title" className="text-base">
        Automation studio
      </h4>
      <p className="mt-1 text-sm text-text-dim">Build a rule for the next wave of incidents, then run it on a simulated window.</p>

      <div className="mt-3 grid gap-2">
        <fieldset className={card} disabled={locked}>
          <legend className={`${legend} float-left mb-2 w-full`}>When</legend>
          <div className="clear-both space-y-2">
            {RULE_WHEN.map((w) => (
              <label key={w.id} className={option}>
                <input type="radio" name="rule-when" className="mt-1" checked={rule.when === w.id} onChange={() => setRule((r) => ({ ...r, when: w.id }))} />
                <span>
                  {w.label}
                  {w.id === "count" && (
                    <span className="mt-1 flex items-center gap-2 text-xs text-text-dim">
                      N
                      <input
                        type="number"
                        aria-label="N, the similar incident count"
                        min={RULE_N.min}
                        max={RULE_N.max}
                        value={rule.n}
                        disabled={rule.when !== "count" || locked}
                        onChange={(e) => setN(e.target.valueAsNumber)}
                        className="h-8 w-16 rounded-md border border-rule bg-panel px-2 font-mono text-sm text-text disabled:opacity-50"
                      />
                      <span>
                        {RULE_N.min} to {RULE_N.max}, over the last {RULE_WINDOW_MINUTES} simulated minutes
                      </span>
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={card} disabled={locked}>
          <legend className={`${legend} float-left mb-2 w-full`}>If</legend>
          <div className="clear-both space-y-2">
            {RULE_IF.map((c) => (
              <label key={c.id} className={option}>
                <input type="radio" name="rule-if" className="mt-1" checked={rule.if === c.id} onChange={() => setRule((r) => ({ ...r, if: c.id }))} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={card} disabled={locked}>
          <legend className={`${legend} float-left mb-2 w-full`}>Then</legend>
          <div className="clear-both space-y-2">
            {RULE_THEN.map((t) => (
              <label key={t.id} className={option}>
                <input type="checkbox" className="mt-1" checked={rule.then.includes(t.id)} onChange={() => toggleThen(t.id)} />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {!kept && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={activate}
            disabled={!rule.then.length || playing}
            className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ran ? "Re-run rule" : "Activate rule"}
          </button>
          {!rule.then.length && <span className="text-xs text-text-faint">Choose at least one action under Then.</span>}
          {stale && !playing && <span className="text-xs text-text-faint">Rule changed. Re-run to see what it does.</span>}
        </div>
      )}

      {ran && (
        <RunResult
          key={runs}
          rule={ran.rule}
          result={ran.result}
          shown={shown}
          dim={stale}
          reduce={!!reduce}
        />
      )}

      {ran && !playing && !stale && !kept && (
        <button
          type="button"
          onClick={() => onKeep(ran.rule, ran.result, runs)}
          className="mt-3 h-10 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2"
        >
          Keep this rule
        </button>
      )}
      {kept && <p className="mt-3 text-sm text-text-dim">Rule kept and logged.</p>}
    </section>
  );
}

const CHIP_STYLE = {
  linked: "border-signal-teal text-text",
  extra: "border-signal-amber text-text",
  fired: "border-signal-blue text-text",
  manual: "border-rule text-text-dim",
};
const chipKind = (o: StreamOutcome) => (o.problem === PROBLEM.id ? "linked" : o.problem ? "extra" : o.fired ? "fired" : "manual");

function RunResult({ rule, result: r, shown, dim, reduce }: { rule: Rule; result: RuleResult; shown: number; dim: boolean; reduce: boolean }) {
  const done = shown >= RULE_STREAM.length;
  const head = ruleHeadline(rule, r);
  const stats: [string, string][] = [
    [`Payment incidents linked to ${PROBLEM.id}`, `${r.paymentLinked} of ${RULE_PAYMENTS}`],
    ["Extra problem records", `${r.extraProblems.length}`],
    ["Support lead alerts", r.unrelatedAlerts ? `${r.alerts} (${r.unrelatedAlerts} unrelated)` : `${r.alerts}`],
    ["Articles suggested", `${r.articles}`],
    ["Escalations to specialists", `${r.escalations}`],
    ["Repeat incidents", `${r.repeatBefore} → ${r.repeatAfter}`],
    ["Manual triage minutes", `${r.minutesWithout} → ${r.minutesWith}`],
  ];

  return (
    <div className={`mt-4 space-y-3 transition-opacity ${dim ? "opacity-50" : ""}`}>
      <div>
        <p className="text-xs text-text-faint">
          Simulated window: {RULE_PAYMENTS} new payment incidents, plus {RULE_STREAM.length - RULE_PAYMENTS} routine ones
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Arrivals in the simulated window">
          {r.stream.slice(0, shown).map((o) => (
            <motion.li
              key={o.incident.id}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              title={`${o.incident.id} · ${STREAM_SIGNATURE[o.incident.kind]} · ${o.incident.unit}`}
              className={`rounded-md border bg-ink px-1.5 py-0.5 font-mono text-[0.6875rem] ${CHIP_STYLE[chipKind(o)]}`}
            >
              {o.incident.id.replace("INC-", "")}
              {o.incident.kind === "payment" && <span className="text-text-faint"> · pay</span>}
              {o.problem && <span className="text-text-faint"> → {o.problem.replace("PRB-", "")}</span>}
            </motion.li>
          ))}
        </ul>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-text-faint">
          <span><span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm border border-signal-teal" />linked to {PROBLEM.id}</span>
          <span><span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm border border-signal-amber" />new problem record</span>
          <span><span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm border border-signal-blue" />rule fired</span>
          <span><span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm border border-rule" />triaged by hand</span>
        </p>
      </div>

      <div aria-live="polite">
        {done && (
          <div className="rounded-md border border-rule bg-ink p-3">
            <p className="text-sm text-text">{head.title}</p>
            <p className="mt-1 text-sm text-text-dim">{head.detail}</p>
            {r.extraProblems.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-text-dim">
                {r.extraProblems.map((p) => (
                  <li key={p.id}>
                    <span className="font-mono">{p.id}</span> {p.title}
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {stats.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <dt className="text-xs text-text-faint">{k}</dt>
                  <dd className="font-mono tabular-nums text-text">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[0.6875rem] text-text-faint">Simulated. Same rule, same result.</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  LEARNING,
  PATTERN,
  PATTERN_OPTIONS,
  problemCard,
  relatedIncidents,
  repeatCount,
  type PatternChoice,
  type PatternState,
} from "./model";

/** Convergence timings (ms): cards hold, then gather to the centre, then the problem card appears. Total about 2.2 s. */
const HOLD_MS = 500;
const GATHER_MS = 1200;

/**
 * The pattern event after the third incident is resolved: a banner, three
 * responses, their consequences, and (on every path) the problem record.
 * No response is called wrong; each shows what it led to.
 */
export function PatternEvent({
  pattern,
  busy,
  onChoose,
  after,
}: {
  pattern: PatternState;
  /** Consequences are still playing out (arrivals, relief): hold the next choice. */
  busy: boolean;
  onChoose: (c: PatternChoice) => void;
  /** Shown after the learning callout, once the problem record is on screen. */
  after?: React.ReactNode;
}) {
  const bannerRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => bannerRef.current?.focus(), []);
  const last = pattern.choices.at(-1);

  return (
    <section aria-labelledby="pattern-title" className="space-y-3">
      <div role="status" className="rounded-lg border border-signal-amber bg-panel p-4">
        <h4 id="pattern-title" ref={bannerRef} tabIndex={-1} className="flex items-center gap-2 text-base">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-signal-amber" />
          {PATTERN.title}
        </h4>
        <p className="mt-1 text-sm text-text">{PATTERN.text}</p>
      </div>

      {!pattern.choices.length && (
        <div role="group" aria-label="Respond to the pattern" className="grid gap-2">
          {PATTERN_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChoose(o.id)}
              className="rounded-md border border-rule bg-ink p-3 text-left text-sm text-text transition-colors hover:border-text-faint hover:bg-panel-2"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {pattern.choices.length > 0 && !pattern.problemOpen && (last === "continue" || last === "workaround") && (
        <Consequence pattern={pattern} choice={last} busy={busy} onLink={() => onChoose("link")} />
      )}

      {pattern.problemOpen && <ProblemRecord pattern={pattern} after={after} />}
    </section>
  );
}

/** What continuing, or the workaround, led to: the incidents that kept arriving. Then the link option, again. */
function Consequence({ pattern, choice, busy, onLink }: { pattern: PatternState; choice: PatternChoice; busy: boolean; onLink: () => void }) {
  const arrivedHere = pattern.arrived;
  return (
    <div aria-live="polite" className="rounded-lg border border-rule bg-panel p-4">
      <p className="text-sm text-text">
        {choice === "continue"
          ? "You keep resolving them one by one. More arrive with the same failure signature."
          : `The workaround article helps: ${pattern.relief} people fix it themselves, so open incidents drop. New ones still arrive.`}
      </p>
      {arrivedHere.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {arrivedHere.map((r) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-md border border-rule bg-ink px-2 py-1 font-mono text-xs text-text"
            >
              {r.id} <span className="text-text-faint">· {r.unit}</span>
            </motion.li>
          ))}
        </ul>
      )}
      <p className="mt-3 font-mono text-xs tabular-nums text-text-dim">Repeat incidents: {repeatCount(pattern)}</p>
      {!busy && (
        <button
          type="button"
          onClick={onLink}
          className="mt-4 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
        >
          Link the incidents and investigate a common cause
        </button>
      )}
    </div>
  );
}

/**
 * The signature moment: the related incident cards gather into one problem
 * card. About 2.2 seconds, skippable with a click, instant under reduced motion.
 * Then the one-line learning callout.
 */
function ProblemRecord({ pattern, after }: { pattern: PatternState; after?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"spread" | "gather" | "done">(reduce ? "done" : "spread");
  useEffect(() => {
    if (reduce) return setPhase("done");
    const a = window.setTimeout(() => setPhase("gather"), HOLD_MS);
    const b = window.setTimeout(() => setPhase("done"), HOLD_MS + GATHER_MS);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [reduce]);

  const related = relatedIncidents(pattern);
  const card = problemCard(pattern);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === "done") headingRef.current?.focus();
  }, [phase]);

  return (
    <div className="space-y-3">
      {phase !== "done" ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPhase("done")}
            aria-label="Skip animation and show the problem record"
            className="relative block min-h-[11rem] w-full overflow-hidden rounded-lg border border-dashed border-rule bg-ink"
          >
            <span className={phase === "spread" ? "flex flex-wrap justify-center gap-2 p-4" : "block"}>
              {related.map((r, i) => (
                <motion.span
                  key={r.id}
                  layout
                  transition={{ type: "spring", stiffness: 140, damping: 20, delay: phase === "gather" ? i * 0.05 : 0 }}
                  animate={phase === "gather" ? { opacity: 0.25, scale: 0.85 } : { opacity: 1, scale: 1 }}
                  className={`flex h-9 w-28 items-center justify-center rounded-md border border-signal-amber bg-panel font-mono text-xs text-text ${
                    phase === "gather" ? "absolute inset-0 m-auto" : ""
                  }`}
                >
                  {r.id}
                </motion.span>
              ))}
            </span>
          </button>
          <p className="mt-1 text-right text-xs text-text-faint">Click to skip</p>
        </div>
      ) : (
        <motion.article
          initial={reduce ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          aria-labelledby="problem-title"
          className="rounded-lg border border-signal-blue bg-panel p-4"
        >
          <p className="font-mono text-xs text-signal-blue">{card.id}</p>
          <h4 id="problem-title" ref={headingRef} tabIndex={-1} className="mt-1 text-lg">
            {card.title}
          </h4>
          <ul className="mt-2 space-y-0.5 text-sm text-text-dim">
            {card.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </motion.article>
      )}

      {phase === "done" && <p className="border-l-2 border-signal-blue pl-3 text-sm text-text">{LEARNING}</p>}
      {phase === "done" && after}
    </div>
  );
}

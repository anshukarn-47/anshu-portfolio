"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  KB_CONFIRMATION,
  KB_MINUTES,
  KB_MINUTES_SAVED,
  KB_QUERY,
  KB_REJECT_NOTE,
  KB_RESOLVES,
  KB_RESULTS,
  KB_RESULT_INTERVAL_MS,
  KB_STEPS,
  PROBLEM,
} from "./model";

/**
 * The knowledge suggestion: retrieval shown step by step (the query, then three
 * articles with match scores, one at a time), and the top result's suggested
 * resolution, which runs only once the agent confirms. Pre-written and
 * deterministic: no live model.
 */
export function KnowledgeSuggestion({
  decision,
  onAccept,
  onReject,
}: {
  decision: "accepted" | "rejected" | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  const reduce = useReducedMotion();
  // Results shown so far. Already decided (or reduced motion): all of them at once.
  const [shown, setShown] = useState(reduce || decision ? KB_RESULTS.length : 0);
  useEffect(() => {
    if (reduce || decision) return setShown(KB_RESULTS.length);
    const ids = KB_RESULTS.map((_, i) => window.setTimeout(() => setShown(i + 1), (i + 1) * KB_RESULT_INTERVAL_MS));
    return () => ids.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retrieval plays once, on mount
  }, [reduce]);

  const complete = shown === KB_RESULTS.length;
  const top = KB_RESULTS[0];

  return (
    <section aria-labelledby="kb-title" className="rounded-lg border border-rule bg-panel p-4">
      <h4 id="kb-title" className="text-base">
        Knowledge suggestion
      </h4>
      <p className="mt-1 text-xs text-text-faint">Simulated retrieval. Pre-written articles and match scores.</p>

      <div className="mt-3 rounded-md border border-rule bg-ink px-3 py-2">
        <p className="text-xs text-text-faint">Query</p>
        <p className="mt-0.5 font-mono text-sm text-text">&ldquo;{KB_QUERY}&rdquo;</p>
      </div>

      <ol aria-live="polite" aria-busy={!complete} className="mt-3 space-y-2">
        {KB_RESULTS.slice(0, shown).map((r) => (
          <motion.li
            key={r.id}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`rounded-md border bg-ink p-3 ${r === top ? "border-signal-blue" : "border-rule"}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-sm text-text">
                <span className="font-mono text-xs text-text-dim">{r.id}</span> {r.title}
              </p>
              <span className="shrink-0 font-mono text-sm tabular-nums text-text" aria-label={`Match score ${r.score.toFixed(2)}`}>
                {r.score.toFixed(2)}
              </span>
            </div>
            <div aria-hidden className="mt-1.5 h-1 rounded-full bg-panel-2">
              <div className="h-1 rounded-full bg-signal-blue" style={{ width: `${r.score * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-text-dim">{r.summary}</p>
          </motion.li>
        ))}
        {!complete && <li className="text-xs text-text-faint">Searching the knowledge base…</li>}
      </ol>

      {complete && (
        <div className="mt-4 rounded-md border border-rule bg-ink p-3">
          <p className="text-xs text-text-faint">
            Suggested resolution from {top.id} · for {KB_RESOLVES.join(" and ")}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text">
            {KB_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-signal-amber">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-signal-amber" />
            {KB_CONFIRMATION}
          </p>

          {!decision && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onAccept} className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
                Use suggested resolution
              </button>
              <button type="button" onClick={onReject} className="h-10 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2">
                Reject suggestion
              </button>
            </div>
          )}
          <div aria-live="polite">
            {decision === "accepted" && (
              <p className="mt-3 text-sm text-text">
                Applied. {KB_RESOLVES.join(" and ")} resolved in {KB_MINUTES} simulated minutes each, {KB_MINUTES_SAVED} fewer than handling them manually.{" "}
                {top.id} is now the proposed workaround on {PROBLEM.id}.
              </p>
            )}
            {decision === "rejected" && <p className="mt-3 text-sm text-text-dim">{KB_REJECT_NOTE}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

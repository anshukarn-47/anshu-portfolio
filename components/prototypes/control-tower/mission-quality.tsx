"use client";

import { useEffect, useRef } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import {
  DENSITY,
  INTEGRITY_CHECKS,
  INTEGRITY_CONCLUSIONS,
  M3_CHOICES,
  QUALITY_SHIPMENT,
  densityVariancePct,
  inr,
  type IntegrityCheck,
  type IntegrityConclusion,
  type M3Choice,
} from "./model";
import { IntegrationView, type LiveNumbers } from "./integration-view";

export type M3State = {
  started: boolean;
  phase: "transit" | "exception" | "resolved";
  choice: M3Choice | null;
  integrity: { open: boolean; checked: IntegrityCheck[]; conclusion: IntegrityConclusion | null };
};
export const M3_START: M3State = { started: false, phase: "transit", choice: null, integrity: { open: false, checked: [], conclusion: null } };

/**
 * Mission 03: the Integration View, a shipment that hits a density (quality)
 * exception partway through, and an optional Distribution Integrity check.
 */
export function MissionQuality({
  state,
  live,
  caseOutcome,
  onStart,
  onArrive,
  onChoose,
  onOpenIntegrity,
  onCheck,
  onConclude,
}: {
  state: M3State;
  live: LiveNumbers;
  /** The related case study's real outcome (from Supabase), shown after the integrity check. */
  caseOutcome: string | null;
  onStart: () => void;
  onArrive: () => void;
  onChoose: (c: M3Choice) => void;
  onOpenIntegrity: () => void;
  onCheck: (c: IntegrityCheck) => void;
  onConclude: (c: IntegrityConclusion) => void;
}) {
  return (
    <div className="space-y-4">
      <IntegrationView live={live} />
      {!state.started ? (
        <div className="rounded-lg border border-dashed border-rule p-4">
          <p className="text-sm text-text-dim">
            Shipment #{QUALITY_SHIPMENT.id} is ready: {QUALITY_SHIPMENT.load} on {QUALITY_SHIPMENT.truck}, Refinery to D2. Every inbound load is
            density-checked at the depot gauge.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="mt-3 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            Start Mission 03
          </button>
        </div>
      ) : state.phase === "transit" ? (
        <Transit onArrive={onArrive} />
      ) : state.phase === "exception" ? (
        <QualityException onChoose={onChoose} />
      ) : (
        <>
          <Consequence choice={state.choice!} />
          <Integrity state={state} caseOutcome={caseOutcome} onOpen={onOpenIntegrity} onCheck={onCheck} onConclude={onConclude} />
        </>
      )}
    </div>
  );
}

/** The shipment on its way; the density check fires when it reaches the depot gauge. */
function Transit({ onArrive }: { onArrive: () => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Start the fill on the next frame so the width transition runs.
    const raf = requestAnimationFrame(() => barRef.current && (barRef.current.style.width = "100%"));
    const id = window.setTimeout(onArrive, QUALITY_SHIPMENT.transitSeconds * 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(id);
    };
  }, [onArrive]);
  return (
    <div role="status" className="rounded-lg border border-rule bg-panel p-4">
      <p className="text-sm text-text">
        Shipment #{QUALITY_SHIPMENT.id} in transit · {QUALITY_SHIPMENT.truck} · Refinery → D2
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div
          ref={barRef}
          className="h-full w-0 rounded-full bg-signal-blue motion-safe:transition-[width] motion-safe:ease-linear"
          style={{ transitionDuration: `${QUALITY_SHIPMENT.transitSeconds}s` }}
        />
      </div>
      <p className="mt-2 text-xs text-text-faint">Approaching the D2 inbound density gauge…</p>
    </div>
  );
}

function QualityException({ onChoose }: { onChoose: (c: M3Choice) => void }) {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => alertRef.current?.focus(), []);
  const variance = densityVariancePct();
  return (
    <div className="space-y-3">
      <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-lg border border-signal-red bg-panel p-4">
        <p className="text-sm font-medium text-signal-red">
          <span aria-hidden>⚠ </span>Quality exception.
        </p>
        <p className="mt-1 font-mono text-sm tabular-nums text-text">
          Expected density: {DENSITY.expected.toFixed(3)}. Recorded density: {DENSITY.recorded.toFixed(3)}. Variance: {variance.toFixed(2)}%.
        </p>
        <p className="mt-2 text-xs text-text-dim">
          Shipment #{QUALITY_SHIPMENT.id} ({QUALITY_SHIPMENT.load}, {QUALITY_SHIPMENT.truck}) at the D2 gauge. Tolerance is ±{DENSITY.tolerancePct}%;
          this is more than three times that.
        </p>
      </div>
      <div role="group" aria-label="Quality decision" className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(M3_CHOICES) as M3Choice[]).map((k) => {
          const c = M3_CHOICES[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChoose(k)}
              className="flex flex-col rounded-lg border border-rule bg-panel p-4 text-left transition-colors hover:border-text-faint hover:bg-panel-2"
            >
              <span className="text-base font-medium text-text">{c.label}</span>
              <span className="mt-0.5 text-xs text-signal-blue">{c.summary}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What the quality decision leads to downstream. */
function Consequence({ choice }: { choice: M3Choice }) {
  const c = M3_CHOICES[choice];
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const quality = c.qualityDelta;
  return (
    <section aria-labelledby="consequence-title" className="rounded-lg border border-rule bg-panel p-4 sm:p-5">
      <h4 id="consequence-title" ref={headingRef} tabIndex={-1} className="text-lg">
        {c.label}: what happens next
      </h4>
      <p className="mt-2 text-sm text-text">{c.consequence}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Quality score" value={quality === 0 ? "Unchanged" : `${quality > 0 ? "+" : "−"}${Math.abs(quality)}`} tone={quality > 0 ? "good" : quality < 0 ? "bad" : "neutral"} />
        <Stat label="Time" value={c.minutes ? `${c.minutes} min` : "None"} tone={c.minutes ? "bad" : "neutral"} />
        <Stat label="Cost" value={c.cost ? `+${inr.format(c.cost)}` : "None"} tone={c.cost ? "bad" : "neutral"} />
        <Stat label="SLA" value={c.slaDelta ? `−${Math.abs(c.slaDelta)} ${Math.abs(c.slaDelta) === 1 ? "pt" : "pts"}` : "Unchanged"} tone={c.slaDelta ? "bad" : "neutral"} />
      </dl>
      {choice === "accept" && <p className="mt-3 text-xs text-signal-amber">Complaint risk: high. The off-spec load is already with customers.</p>}
      <p className="mt-4 text-xs text-text-faint">Mission 03 complete. The optional integrity investigation is below.</p>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <div className="rounded-md border border-rule bg-ink px-3 py-2">
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className={`mt-0.5 font-mono text-base tabular-nums ${tone === "good" ? "text-signal-teal" : tone === "bad" ? "text-signal-amber" : "text-text"}`}>{value}</dd>
    </div>
  );
}

/** Optional: a short Distribution Integrity investigation (route deviations, delivery frequency, inventory). */
function Integrity({
  state,
  caseOutcome,
  onOpen,
  onCheck,
  onConclude,
}: {
  state: M3State;
  caseOutcome: string | null;
  onOpen: () => void;
  onCheck: (c: IntegrityCheck) => void;
  onConclude: (c: IntegrityConclusion) => void;
}) {
  const { integrity } = state;
  if (!integrity.open) {
    return (
      <div className="rounded-lg border border-dashed border-rule p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-text">Something else doesn&apos;t add up around D6.</p>
          <StatusPill tone="idle">Optional</StatusPill>
        </div>
        <p className="mt-1 text-sm text-text-dim">Not needed to finish the mission, but worth a look.</p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-md border border-rule px-3 py-1.5 text-sm text-text transition-colors hover:bg-panel-2"
        >
          Open Distribution Integrity investigation
        </button>
      </div>
    );
  }
  const findings = INTEGRITY_CHECKS.filter((c) => integrity.checked.includes(c.id));
  return (
    <section aria-labelledby="integrity-title" className="rounded-lg border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="integrity-title" className="text-base">
          Distribution Integrity
        </h4>
        <StatusPill tone="idle">Optional</StatusPill>
      </div>

      {!integrity.conclusion && (
        <div className="mt-3 flex flex-wrap gap-2">
          {INTEGRITY_CHECKS.map((c) => {
            const done = integrity.checked.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={done}
                onClick={() => onCheck(c.id)}
                className="rounded-md border border-rule bg-ink px-3 py-1.5 text-sm text-text transition-colors hover:bg-panel-2 disabled:cursor-default disabled:text-text-faint disabled:hover:bg-ink"
              >
                {done && <span aria-hidden>✓ </span>}
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {findings.length > 0 && (
        <ol aria-live="polite" className="mt-3 space-y-2">
          {findings.map((f) => (
            <li key={f.id} className="border-l-2 border-signal-blue pl-3 text-sm">
              <span className="block text-xs text-text-faint">{f.label}</span>
              <span className="text-text">{f.finding}</span>
            </li>
          ))}
        </ol>
      )}

      {!integrity.conclusion && findings.length > 0 && (
        <div role="group" aria-label="Conclusion" className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(INTEGRITY_CONCLUSIONS) as IntegrityConclusion[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onConclude(k)}
              className={`h-9 rounded-md px-3 text-sm transition-opacity ${
                k === "audit" ? "bg-text font-medium text-ink hover:opacity-90" : "border border-rule text-text-dim hover:bg-panel-2 hover:text-text"
              }`}
            >
              {INTEGRITY_CONCLUSIONS[k].label}
            </button>
          ))}
        </div>
      )}

      {integrity.conclusion && (
        <div className="mt-4 rounded-md border border-rule bg-ink p-3 text-sm">
          <p className="text-text">{INTEGRITY_CONCLUSIONS[integrity.conclusion].result}</p>
          {caseOutcome && (
            <p className="mt-2 text-text-dim">
              <span className="text-text-faint">In the real project: </span>
              {caseOutcome}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useId, useRef } from "react";
import {
  ACTIONS,
  ACTION_MINUTES,
  CSAT_FORMULA,
  FIRST_CONTACT_RULE,
  minutesLeft,
  ringTone,
  shareLeft,
  teamById,
  type ActionId,
  type DecisionLogEntry,
  type RingTone,
  type RoutedIncident,
} from "./model";
import { PRIORITY_STYLE } from "./triage";

const RING_STROKE: Record<RingTone, string> = { teal: "text-signal-teal", amber: "text-signal-amber", red: "text-signal-red" };

/**
 * SLA countdown ring: the share of the resolution target left, on the
 * simulated clock (so it stops under No rush). Teal above 50%, amber 20–50%,
 * red below 20%. Always paired with the minutes in text.
 */
export function CountdownRing({ routed: r, now, size = 28 }: { routed: RoutedIncident; now: number; size?: number }) {
  const share = shareLeft(r, now);
  const tone = ringTone(share);
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const left = minutesLeft(r, now);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={left > 0 ? `${left} of ${r.target} simulated minutes left` : "SLA breached"} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-panel-2" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - share)}
        className={`${RING_STROKE[tone]} motion-safe:transition-[stroke-dashoffset,color] motion-safe:duration-700`}
      />
    </svg>
  );
}

/** "SLA breached by 4 simulated minutes": neutral wording, then the player carries on. */
export function BreachLine({ minutes }: { minutes: number }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-text-dim">
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-signal-red" />
      SLA breached by {minutes} simulated {minutes === 1 ? "minute" : "minutes"}
    </p>
  );
}

/** A small "i" button with a text tooltip on hover and keyboard focus; the text is its accessible description. */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-rule font-mono text-[0.625rem] text-text-faint hover:text-text"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-md border border-rule bg-panel-2 p-2 text-xs font-normal text-text-dim shadow-lg group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}

const minutesFor = (a: ActionId, r: RoutedIncident) =>
  a === "knowledge"
    ? `${ACTION_MINUTES.knowledge} min if an article exists`
    : a === "escalate"
      ? `${r.work.investigated ? ACTION_MINUTES.escalateWithContext : ACTION_MINUTES.escalate} min`
      : a === "investigate"
        ? `${ACTION_MINUTES.investigate} min`
        : `${ACTION_MINUTES.requestInfo} min`;

/**
 * Working one routed incident: what's known so far, its countdown, and the
 * four actions. Investigate and Request more information can each be used
 * once; a knowledge article works only once a matching one exists.
 */
export function ResolveStage({
  routed: r,
  now,
  lastEntry,
  onAction,
  next,
}: {
  routed: RoutedIncident;
  now: number;
  /** The latest log entry for this incident, shown as the result of the last action. */
  lastEntry: DecisionLogEntry | undefined;
  onAction: (a: ActionId) => void;
  /** What the player can do next once it's resolved. */
  next: React.ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [r.incident.id]);
  const w = r.work;
  const res = w.resolution;
  const left = minutesLeft(r, now);

  const disabled = (a: ActionId) =>
    !!res ||
    (a === "investigate" && w.investigated) ||
    (a === "request-info" && w.infoRequests > 0) ||
    (a === "knowledge" && !w.article && w.articleMisses > 0);

  return (
    <article aria-labelledby={`${r.incident.id}-work-title`} className="rounded-lg border border-rule bg-panel p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-text-faint">
            {r.incident.id} · {r.incident.unit} · {teamById(r.team).name}
          </p>
          <h3 id={`${r.incident.id}-work-title`} ref={headingRef} tabIndex={-1} className="mt-1 text-lg">
            {r.incident.summary}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md border px-2 py-0.5 font-mono text-sm ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</span>
          <CountdownRing routed={r} now={now} size={36} />
          <span className="font-mono text-sm tabular-nums text-text">{Math.max(0, left)} min</span>
        </div>
      </header>
      {left < 0 && !res && (
        <div className="mt-2">
          <BreachLine minutes={-left} />
          <p className="text-xs text-text-faint">It stays open: resolve it when you can.</p>
        </div>
      )}

      {w.signals.length > 0 && (
        <section aria-label="What you know" className="mt-4">
          <h4 className="text-xs text-text-faint">What you know</h4>
          <ul className="mt-1 space-y-1">
            {w.signals.map((s) => (
              <li key={s} className="border-l-2 border-signal-blue pl-3 text-sm text-text">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}
      {w.article && !res && (
        <p className="mt-3 text-sm text-text-dim">
          Knowledge article available: <span className="font-mono text-text">{w.article.id}</span> {w.article.title}
        </p>
      )}

      {!res && (
        <div role="group" aria-label="Resolution actions" className="mt-4 grid gap-2 sm:grid-cols-2">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={disabled(a.id)}
              onClick={() => onAction(a.id)}
              className="flex flex-col rounded-md border border-rule bg-ink p-3 text-left transition-colors hover:border-text-faint hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink"
            >
              <span className="text-sm font-medium text-text">{a.label}</span>
              <span className="mt-0.5 text-xs text-text-dim">{a.hint}</span>
              <span className="mt-1 font-mono text-xs text-text-faint">{minutesFor(a.id, r)}</span>
            </button>
          ))}
        </div>
      )}

      {lastEntry && !res && (
        <p aria-live="polite" className="mt-3 text-sm text-text-dim">
          {lastEntry.decision}: {lastEntry.consequence}
        </p>
      )}

      {res && (
        <div role="status" className="mt-4 rounded-md border border-rule bg-ink p-3">
          <p className="text-base text-text">Resolved in {res.minutes} simulated minutes</p>
          <div className="mt-2">{res.breachedBy > 0 ? <BreachLine minutes={res.breachedBy} /> : <p className="text-sm text-signal-teal">Within the SLA target</p>}</div>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-text-faint">
                First-contact resolution <InfoTip label="What counts as first-contact resolution" text={FIRST_CONTACT_RULE} />
              </dt>
              <dd className="mt-0.5 text-text">{res.firstContact ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-text-faint">
                CSAT <InfoTip label="How CSAT is scored" text={`Simulated. ${CSAT_FORMULA}`} />
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums text-text">{res.csat} / 5</dd>
            </div>
          </dl>
          <div className="mt-4">{next}</div>
        </div>
      )}
    </article>
  );
}

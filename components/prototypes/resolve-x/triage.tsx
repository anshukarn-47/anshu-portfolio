"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CATEGORIES,
  IMPACTS,
  PRIORITY_MATRIX,
  SLA_TARGET_MINUTES,
  TEAMS,
  URGENCIES,
  formatSimTime,
  openCount,
  type Category,
  type Impact,
  type Incident,
  type Priority,
  type RoutedIncident,
  type TeamId,
  type Triage,
  type Urgency,
} from "./model";

/** Priority badge colours: P1/P2 urgent (red/amber), P3/P4 routine (blue/neutral). Always shown with the label. */
export const PRIORITY_STYLE: Record<Priority, string> = {
  P1: "border-signal-red text-signal-red",
  P2: "border-signal-amber text-signal-amber",
  P3: "border-signal-blue text-signal-blue",
  P4: "border-rule text-text-dim",
};

/** How long the priority badge sits in the chosen cell before moving to its slot. */
const BADGE_EMERGE_MS = 160;

/** Shared layout id: the incident card on the stage and its chip in a team queue are the same element. */
export const incidentLayoutId = (id: string) => `incident-${id}`;

/**
 * The central stage for one incident: category, impact x urgency (priority),
 * then a team, then Submit triage. Nothing here judges the choices; the
 * consequences show once the incident is routed.
 */
export function TriageStage({
  incident,
  arrivedAt,
  routed,
  onSubmit,
}: {
  incident: Incident;
  arrivedAt: number;
  /** Already-routed incidents, for the team loads shown on the routing buttons. */
  routed: RoutedIncident[];
  onSubmit: (t: Triage) => void;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [cell, setCell] = useState<{ impact: Impact; urgency: Urgency } | null>(null);
  const [team, setTeam] = useState<TeamId | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const priority = cell ? PRIORITY_MATRIX[cell.impact][cell.urgency] : null;
  const ready = category && cell && team;
  const badgeHome = useBadgeHome(cell ? `${cell.impact}-${cell.urgency}` : null);

  return (
    <motion.article
      layoutId={incidentLayoutId(incident.id)}
      aria-labelledby={`${incident.id}-title`}
      className="rounded-lg border border-rule bg-panel p-4 sm:p-5"
    >
      <header>
        <p className="font-mono text-xs text-text-faint">
          {incident.id} · {incident.unit} · arrived {formatSimTime(arrivedAt)}
        </p>
        <h3 id={`${incident.id}-title`} ref={headingRef} tabIndex={-1} className="mt-1 text-lg">
          {incident.summary}
        </h3>
      </header>

      <form
        className="mt-5 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (category && cell && team) onSubmit({ category, impact: cell.impact, urgency: cell.urgency, team });
        }}
      >
        <ChoiceGroup legend="1. Category" name={`${incident.id}-category`} options={CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onChange={setCategory} />

        <fieldset>
          <legend className="text-sm font-medium text-text">2. Impact and urgency</legend>
          <div className="mt-2 flex flex-wrap items-start gap-5">
            <PriorityMatrix id={incident.id} value={cell} onChange={setCell} badgeInCell={badgeHome === "cell"} />
            <PrioritySlot cell={cell} priority={priority} incidentId={incident.id} badgeInSlot={badgeHome === "slot"} />
          </div>
        </fieldset>

        <ChoiceGroup
          legend="3. Route to a team"
          name={`${incident.id}-team`}
          options={TEAMS.map((t) => ({ value: t.id, label: t.name, note: `${openCount(t, routed)} / ${t.capacity} open` }))}
          value={team}
          onChange={setTeam}
        />

        <button
          type="submit"
          disabled={!ready}
          className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit triage
        </button>
      </form>
    </motion.article>
  );
}

/** A row of radio pills (native radios: arrow keys and Space work). */
function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string; note?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-text">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-rule px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-panel-2 hover:text-text has-[:checked]:border-signal-blue has-[:checked]:bg-panel-2 has-[:checked]:text-text has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal-teal"
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
            {o.note && <span className="font-mono text-xs tabular-nums text-text-faint">{o.note}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * 3x3 impact (rows) by urgency (columns) matrix as a radio group: one tab
 * stop, arrow keys move in two dimensions and select, Space/Enter select.
 */
function PriorityMatrix({
  id,
  value,
  onChange,
  badgeInCell,
}: {
  id: string;
  value: { impact: Impact; urgency: Urgency } | null;
  onChange: (v: { impact: Impact; urgency: Urgency }) => void;
  /** The priority badge is still in the chosen cell (it moves to the slot shortly after). */
  badgeInCell: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = value ? IMPACTS.findIndex((i) => i.id === value.impact) * 3 + URGENCIES.findIndex((u) => u.id === value.urgency) : -1;

  const select = (row: number, col: number) => {
    onChange({ impact: IMPACTS[row].id, urgency: URGENCIES[col].id });
    refs.current[row * 3 + col]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    select(Math.min(2, Math.max(0, row + m[0])), Math.min(2, Math.max(0, col + m[1])));
  };

  return (
    <div className="grid grid-cols-[auto_repeat(3,3.25rem)] items-center gap-1.5 sm:grid-cols-[auto_repeat(3,4rem)]">
      <span aria-hidden />
      {URGENCIES.map((u) => (
        <span key={u.id} aria-hidden className="text-center text-xs text-text-faint">
          {u.label}
        </span>
      ))}
      <div role="radiogroup" aria-label="Impact and urgency" className="contents">
        {IMPACTS.map((impact, row) => (
          <div key={impact.id} className="contents">
            <span aria-hidden className="pr-2 text-right text-xs text-text-dim">
              {impact.label}
            </span>
            {URGENCIES.map((urgency, col) => {
              const i = row * 3 + col;
              const checked = i === index;
              return (
                <button
                  key={urgency.id}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={`${impact.label}, ${urgency.label.toLowerCase()} urgency`}
                  tabIndex={checked || (index === -1 && i === 0) ? 0 : -1}
                  onClick={() => select(row, col)}
                  onKeyDown={(e) => onKeyDown(e, row, col)}
                  className={`relative flex h-11 items-center justify-center rounded-md border transition-colors ${
                    checked ? "border-signal-blue bg-panel-2" : "border-rule bg-ink hover:bg-panel-2"
                  }`}
                >
                  {checked && badgeInCell && (
                    <motion.span
                      layoutId={`priority-${id}-${impact.id}-${urgency.id}`}
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.14 }}
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full bg-signal-blue"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <span aria-hidden className="col-span-4 pt-1 text-xs text-text-faint">
        Rows: impact · Columns: urgency
      </span>
    </div>
  );
}

/**
 * Where the priority badge is: it appears in the chosen cell, then moves to the
 * slot beside the matrix (the two share a layoutId, and switch in one render).
 * A new cell starts over; under reduced motion it goes straight to the slot.
 */
function useBadgeHome(cellKey: string | null): "cell" | "slot" | null {
  const reduce = useReducedMotion();
  const [home, setHome] = useState<{ key: string | null; at: "cell" | "slot" }>({ key: null, at: "cell" });
  useEffect(() => {
    if (!cellKey) return setHome({ key: null, at: "cell" });
    if (reduce) return setHome({ key: cellKey, at: "slot" });
    setHome({ key: cellKey, at: "cell" });
    const t = window.setTimeout(() => setHome({ key: cellKey, at: "slot" }), BADGE_EMERGE_MS);
    return () => window.clearTimeout(t);
  }, [cellKey, reduce]);
  return cellKey && home.key === cellKey ? home.at : null;
}

/** Where the priority badge settles, with the SLA target it sets. Announced politely when it changes. */
function PrioritySlot({
  cell,
  priority,
  incidentId,
  badgeInSlot,
}: {
  cell: { impact: Impact; urgency: Urgency } | null;
  priority: Priority | null;
  incidentId: string;
  badgeInSlot: boolean;
}) {
  const key = cell ? `${cell.impact}-${cell.urgency}` : null;
  return (
    <div aria-live="polite" className="min-w-[9rem]">
      <p className="text-xs text-text-faint">Priority</p>
      <div className="mt-1 flex h-9 items-center">
        {priority && badgeInSlot ? (
          <motion.span
            layoutId={`priority-${incidentId}-${key}`}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-lg font-medium ${PRIORITY_STYLE[priority]}`}
          >
            {priority}
          </motion.span>
        ) : (
          !priority && <span className="text-sm text-text-faint">Pick a cell</span>
        )}
      </div>
      {priority && <p className="mt-1 text-xs text-text-dim">SLA target {SLA_TARGET_MINUTES[priority]} simulated min</p>}
    </div>
  );
}

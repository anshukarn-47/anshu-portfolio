"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  CRITICAL_DEFECT,
  DESCENT_MS,
  ROW_UNITS,
  SPRINTS,
  TYPE_LABEL,
  capacityReducer,
  fitsAt,
  initialState,
  meters,
  summarise,
  usedUnits,
  validStarts,
  type ItemType,
  type WorkItem,
} from "@/lib/arcade/games/capacity-fit";
import { useGameLoop } from "../use-game-loop";
import type { GameDefinition, PlayProps } from "../types";

/** Each type has its own outline and a text label, so colour is never the only cue. */
const TYPE_STYLE: Record<ItemType, string> = {
  feature: "border-signal-blue",
  bug: "border-signal-amber",
  compliance: "border-text",
  debt: "border-dashed border-text-faint",
  defect: "border-signal-red",
};
/** In relaxed mode the bar descends at half speed and waits at the bottom; it never drops on its own. */
const RELAXED_DESCENT_MS = DESCENT_MS * 2;
const LANE_PX = 72;
const BAR_PX = 32;

function details(i: WorkItem) {
  if (i.type === "feature") return `Value ${i.value} · ${i.risk} risk`;
  if (i.type === "compliance") return `Mandatory · due by sprint ${i.deadline}`;
  if (i.type === "debt") return "No immediate value · raises technical health";
  if (i.type === "defect") return "Must go into this sprint";
  return "Small fix";
}

const healthTone = (h: number) => (h >= 50 ? "bg-signal-teal" : h >= 30 ? "bg-signal-amber" : "bg-signal-red");

function CapacityFitPlay({ relaxed, paused, onFinish }: PlayProps) {
  const reduce = useReducedMotion();
  const [s, dispatch] = useReducer(capacityReducer, undefined, initialState);
  const active = s.active;
  const current = s.rows[s.sprint];
  const placing = s.mode === "place" && !!active;
  const fits = !!active && fitsAt(current, active.units, s.pos);
  const anyRoom = !!active && validStarts(current, active.units).length > 0;

  // Descent: elapsed time lives in a ref and moves the bar directly, so the loop doesn't re-render 60 times a second.
  const elapsed = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(DESCENT_MS / 1000));
  const [hovered, setHovered] = useState(false);
  const activationKey = `${s.sprint}|${s.queue}|${s.offers.length}|${active?.id ?? "-"}|${s.mode}`;

  const paint = () => {
    const share = Math.min(1, elapsed.current / (relaxed ? RELAXED_DESCENT_MS : DESCENT_MS));
    if (barRef.current) barRef.current.style.transform = reduce ? "none" : `translateY(${share * (LANE_PX - BAR_PX)}px)`;
    if (fillRef.current) fillRef.current.style.width = `${(1 - share) * 100}%`;
    const left = Math.max(0, Math.ceil((DESCENT_MS - elapsed.current) / 1000));
    setSecondsLeft((v) => (v === left ? v : left));
  };

  // A new item starts at the top.
  useEffect(() => {
    elapsed.current = 0;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per activation only
  }, [activationKey]);

  // Relaxed mode: motion also pauses while the board is hovered or focused.
  const running = !paused && placing && !(relaxed && hovered);
  useGameLoop(
    (dt) => {
      if (elapsed.current < 0) return;
      elapsed.current += dt;
      if (!relaxed && elapsed.current >= DESCENT_MS) {
        elapsed.current = -1; // drop once; the next activation resets it
        dispatch({ type: "timeout" });
        return;
      }
      if (relaxed) elapsed.current = Math.min(elapsed.current, RELAXED_DESCENT_MS);
      paint();
    },
    { running }
  );

  // Keyboard: arrows move, down / Enter / Space drop, D defers, S ships the sprint now. Buttons do the same for mouse and touch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      // Enter and Space on a focused button belong to that button.
      if (t?.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      const k = e.key;
      if (k === "ArrowLeft") dispatch({ type: "move", dir: -1 });
      else if (k === "ArrowRight") dispatch({ type: "move", dir: 1 });
      else if (k === "ArrowDown" || k === "Enter" || k === " ") dispatch({ type: "drop" });
      else if (k === "d" || k === "D") dispatch({ type: "defer" });
      else if (k === "s" || k === "S") dispatch({ type: "ship-now" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);

  // The run finishes after the last sprint ships.
  const finished = useRef(false);
  useEffect(() => {
    if (s.mode !== "done" || finished.current) return;
    finished.current = true;
    const r = summarise(s);
    onFinish({
      score: r.score,
      lines: [
        { label: "Value shipped (priority-weighted)", value: `${r.priorityValue}` },
        {
          label: "Compliance on time",
          value: `${r.compliance.onTime} of ${r.compliance.total}${r.compliance.late ? `, ${r.compliance.late} late` : ""}`,
        },
        { label: "Technical health", value: `${r.health}%` },
        { label: "Releases shipped", value: `${r.releases} of ${SPRINTS}` },
        { label: "Planned vs delivered", value: `${r.deliveredUnits} of ${r.plannedUnits} units` },
        {
          label: "Carryover at the end",
          value: `${r.carryoverUnits} ${r.carryoverUnits === 1 ? "unit" : "units"}${r.backlogLeft ? `, ${r.backlogLeft} not yet offered` : ""}`,
        },
        {
          label: "Score breakdown",
          value: `${Math.round(r.priorityValue)} value + ${r.compliance.points} compliance + ${r.healthPoints} health + ${r.releases} releases`,
        },
      ],
      table: {
        caption: "Planned vs delivered, per sprint (units)",
        columns: ["Sprint", "Planned", "Delivered", "Unused"],
        rows: r.perSprint.map((p) => [`Sprint ${p.sprint}`, `${p.planned}`, `${p.delivered}`, `${p.unused}`]),
      },
    });
  }, [s, onFinish]);

  const m = meters(s);
  const pct = (n: number) => `${(n / ROW_UNITS) * 100}%`;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Value shipped</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{m.value}</dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Technical health</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{m.health}%</dd>
          <dd aria-hidden className="mt-1 h-1 rounded-full bg-panel-2">
            <div className={`h-1 rounded-full ${healthTone(m.health)}`} style={{ width: `${m.health}%` }} />
          </dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Carryover</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">
            {m.carryover} <span className="text-xs text-text-faint">units</span>
          </dd>
        </div>
      </dl>

      <div className="rounded-md border border-rule bg-ink p-3">
        <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-text-faint">
          <span>
            Sprint {Math.min(s.sprint + 1, SPRINTS)} of {SPRINTS} · {usedUnits(current)} of {ROW_UNITS} units planned
          </span>
          {placing && !relaxed && <span className="font-mono tabular-nums">Drops in {secondsLeft}s</span>}
        </p>
        {active && (
          <div className="mt-2">
            <p className="text-sm text-text">
              <span className="font-mono text-xs text-text-dim">{active.id}</span> {active.title}
            </p>
            <p className="mt-0.5 text-xs text-text-dim">
              {TYPE_LABEL[active.type]} · {active.units} {active.units === 1 ? "unit" : "units"} · {details(active)}
            </p>
            {placing && !relaxed && (
              <div aria-hidden className="mt-2 h-1 rounded-full bg-panel-2">
                <div ref={fillRef} className={`h-1 rounded-full ${active.type === "defect" ? "bg-signal-red" : "bg-signal-blue"}`} />
              </div>
            )}
          </div>
        )}
        {s.mode === "make-room" && (
          <p className="mt-2 text-sm text-signal-red">Choose planned work in sprint {s.sprint + 1} to move to carryover.</p>
        )}
      </div>

      <div
        role="group"
        aria-label="Sprint board"
        aria-describedby="capacity-keys"
        tabIndex={0}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHovered(false)}
        className="rounded-md border border-rule bg-ink p-2 outline-none focus-visible:ring-2 focus-visible:ring-signal-blue"
      >
        {/* Intake lane: the item descends here, above the column it will land in. */}
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2">
          <span aria-hidden className="self-start pt-1 font-mono text-[0.625rem] text-text-faint">
            Next
          </span>
          <div className="relative" style={{ height: LANE_PX }}>
            <div aria-hidden className="absolute inset-0 grid grid-cols-6">
              {Array.from({ length: ROW_UNITS }, (_, c) => (
                <span key={c} className="border-l border-dashed border-rule first:border-l-0" />
              ))}
            </div>
            {placing && active && (
              <div
                ref={barRef}
                aria-hidden
                className={`absolute top-0 flex items-center justify-center rounded-md border-2 bg-panel-2 font-mono text-xs text-text ${TYPE_STYLE[active.type]} ${
                  fits ? "" : "opacity-50"
                }`}
                style={{ left: pct(s.pos), width: pct(active.units), height: BAR_PX }}
              >
                {active.id}
              </div>
            )}
          </div>
        </div>

        <ol className="mt-2 space-y-1.5">
          {s.rows.map((r, i) => {
            const isCurrent = i === s.sprint && s.mode !== "done";
            const shipped = i < s.sprint || s.mode === "done";
            return (
              <li key={i} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2">
                <span className={`font-mono text-[0.6875rem] ${isCurrent ? "text-text" : "text-text-faint"}`}>
                  S{i + 1}
                  {shipped && s.shipped.some((x) => x.sprint === i) && <span className="sr-only"> shipped</span>}
                </span>
                <div
                  className={`relative h-10 rounded-md border ${isCurrent ? "border-signal-blue bg-panel" : "border-rule"} ${shipped ? "opacity-60" : ""}`}
                  aria-label={`Sprint ${i + 1}: ${usedUnits(r)} of ${ROW_UNITS} units${shipped ? ", shipped" : isCurrent ? ", current" : ""}`}
                >
                  {/* Columns: tap one to move the bar there (the arrows and buttons do the same). */}
                  <div className="absolute inset-0 grid grid-cols-6">
                    {Array.from({ length: ROW_UNITS }, (_, c) =>
                      isCurrent && placing ? (
                        <button
                          key={c}
                          type="button"
                          tabIndex={-1}
                          aria-label={`Move to column ${c + 1}`}
                          onClick={() => dispatch({ type: "move-to", col: c })}
                          className="border-l border-dashed border-rule first:border-l-0 hover:bg-panel-2"
                        />
                      ) : (
                        <span key={c} aria-hidden className="border-l border-dashed border-rule first:border-l-0" />
                      )
                    )}
                  </div>
                  {/* Where the bar will land. */}
                  {isCurrent && placing && active && fits && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-1 rounded border border-dashed border-signal-blue"
                      style={{ left: `calc(${pct(s.pos)} + 2px)`, width: `calc(${pct(active.units)} - 4px)` }}
                    />
                  )}
                  {r.map((p) => {
                    const style = { left: `calc(${pct(p.start)} + 2px)`, width: `calc(${pct(p.item.units)} - 4px)` };
                    const cls = `absolute inset-y-1 flex items-center justify-center overflow-hidden rounded border-2 bg-panel-2 px-1 font-mono text-[0.6875rem] text-text ${TYPE_STYLE[p.item.type]}`;
                    return isCurrent && s.mode === "make-room" && p.item.type !== "defect" ? (
                      <button
                        key={p.item.id}
                        type="button"
                        onClick={() => dispatch({ type: "bump", id: p.item.id })}
                        aria-label={`Move ${p.item.id} ${p.item.title} to carryover`}
                        className={`${cls} hover:bg-panel focus-visible:ring-2 focus-visible:ring-signal-red`}
                        style={style}
                      >
                        {p.item.id}
                      </button>
                    ) : (
                      <span key={p.item.id} className={cls} style={style} title={`${p.item.id} ${p.item.title}`}>
                        {p.item.id}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {s.mode !== "done" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <button type="button" aria-keyshortcuts="ArrowLeft" disabled={!placing || !anyRoom} onClick={() => dispatch({ type: "move", dir: -1 })} className={ctrl}>
            ← Left
          </button>
          <button type="button" aria-keyshortcuts="ArrowRight" disabled={!placing || !anyRoom} onClick={() => dispatch({ type: "move", dir: 1 })} className={ctrl}>
            Right →
          </button>
          <button type="button" aria-keyshortcuts="ArrowDown Enter" disabled={!placing || !fits} onClick={() => dispatch({ type: "drop" })} className={primaryCtrl}>
            Drop ↓
          </button>
          <button
            type="button"
            aria-keyshortcuts="D"
            disabled={!placing || active?.type === "defect"}
            onClick={() => dispatch({ type: "defer" })}
            className={ctrl}
          >
            Defer
          </button>
          <button
            type="button"
            aria-keyshortcuts="S"
            disabled={s.mode !== "place" || active?.type === "defect"}
            onClick={() => dispatch({ type: "ship-now" })}
            className={`${ctrl} col-span-2 sm:col-span-1`}
          >
            Ship sprint now
          </button>
        </div>
      )}
      {placing && !anyRoom && <p className="text-sm text-text-dim">No room for this item in sprint {s.sprint + 1}. Defer it, or ship the sprint now.</p>}

      <p id="capacity-keys" className="text-xs text-text-faint">
        Keys: ← → move, ↓ or Enter drop, D defer, S ship the sprint now, P pause.
      </p>
      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-text-dim">
        {s.note}
      </p>
    </div>
  );
}

const ctrl =
  "h-11 rounded-md border border-rule px-2 text-sm text-text transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
const primaryCtrl = "h-11 rounded-md bg-text px-2 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

export const capacityFit: GameDefinition = {
  tutorial: [
    {
      title: "Four sprints, six units each",
      body: "Each row is a sprint with 6 units of capacity. Work arrives one item at a time, as a bar 1 to 4 units wide. A full row ships a release.",
    },
    {
      title: "Position and drop",
      body: "Move the bar with the arrow keys or the Left and Right buttons, or tap a column. Drop it with the down arrow, Enter or the Drop button. If you wait, it drops where it is.",
    },
    {
      title: "Know what you're placing",
      body: "Features have a value from 1 to 5 and a risk. Bugs are small fixes. Compliance items are mandatory and due by a set sprint. Technical debt adds no value now but keeps technical health up.",
    },
    {
      title: "Defer, ship early, expect the unexpected",
      body: "Defer an item to carryover (D) and it comes back next sprint, or ship a sprint early (S). Something urgent may arrive mid-game. Relaxed mode removes the timer.",
    },
  ],
  Play: CapacityFitPlay,
  demonstrates: [
    "Treating sprint capacity as a budget: each unit spent on low-value work is a unit not spent on what matters.",
    "Balancing new features against technical debt across delivery cycles, so health doesn't quietly erode.",
    "Meeting fixed compliance deadlines inside the same capacity as everything else.",
    `Absorbing an urgent ${CRITICAL_DEFECT.units}-unit defect by choosing what moves to carryover.`,
  ],
  scoreRewards:
    "Value shipped, weighted by each item's priority (a feature's value, discounted for risk); compliance items shipped by their deadline; and the technical health you leave behind. A full row on its own earns only a small release point. Speed and clicks don't count.",
  caseFocus: /technical debt/i,
};

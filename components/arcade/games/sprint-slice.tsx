"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  BACKLOG,
  BEST_SCORE,
  CAPACITY,
  LANES,
  SCORING,
  TIMING,
  TYPE_LABEL,
  reasonFor,
  scoreSlice,
  type BacklogItem,
  type SliceType,
} from "@/lib/arcade/games/sprint-slice";
import { useGameLoop } from "../use-game-loop";
import type { GameDefinition, PlayProps } from "../types";

type Status = "live" | "included" | "skipped";

/** Each type has its own outline and a text label, so colour is never the only cue. */
const TYPE_STYLE: Record<SliceType, string> = {
  feature: "border-signal-blue",
  bug: "border-signal-red",
  debt: "border-dashed border-text-faint",
  nice: "border-rule",
};
/** Cards are at most this wide, and never more than 70% of the track (narrow phones). */
const CARD_PX = 156;
const cardWidth = (track: number) => Math.min(CARD_PX, Math.round(track * 0.7));
const LANE_PX = 76;

function stats(i: BacklogItem) {
  const parts = [`${i.effort} pts`];
  if (i.type === "feature" || i.type === "nice") parts.unshift(`Value ${i.value}`);
  if (i.type === "feature" && i.risk !== "low") parts.push(`${i.risk} risk`);
  return parts.join(" · ");
}

function SprintSlicePlay({ relaxed, paused, onFinish }: PlayProps) {
  const reduce = useReducedMotion();
  const [spawned, setSpawned] = useState(0);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [note, setNote] = useState("");

  // Per-frame values live in refs; the loop moves cards directly instead of re-rendering 60 times a second.
  const clock = useRef(0);
  const ages = useRef(new Map<string, number>());
  const cardEls = useRef(new Map<string, HTMLElement>());
  const barEls = useRef(new Map<string, HTMLElement>());
  const trackRef = useRef<HTMLDivElement>(null);
  const trackWidth = useRef(320);
  const pausedOn = useRef<{ hover: string | null; focus: string | null }>({ hover: null, focus: null });
  const spawnedRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const spawnEvery = TIMING.spawnEveryMs * (relaxed ? TIMING.relaxedSpawnFactor : 1);
  const drift = TIMING.driftMs * (relaxed ? TIMING.relaxedDriftFactor : 1);

  const included = new Set(BACKLOG.filter((i) => status[i.id] === "included").map((i) => i.id));
  const live = BACKLOG.slice(0, spawned).filter((i) => (status[i.id] ?? "live") === "live");
  const allMet = spawned === BACKLOG.length && live.length === 0;
  const result = scoreSlice(included);
  // Health so far: only debt items already decided count (included raises it; skipped lowers it, more each time in a row).
  const healthNow = (() => {
    let h: number = SCORING.healthStart;
    let run = 0;
    for (const i of BACKLOG) {
      const st = status[i.id];
      if (i.type !== "debt" || !st || st === "live") continue;
      if (st === "included") {
        h += SCORING.healthPerDebt;
        run = 0;
      } else h -= SCORING.healthPerSkippedDebtStep * ++run;
    }
    return Math.max(0, Math.min(100, h));
  })();

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => (trackWidth.current = el.clientWidth));
    ro.observe(el);
    trackWidth.current = el.clientWidth;
    return () => ro.disconnect();
  }, [reduce]);

  const decide = (id: string, to: "included" | "skipped", how: string) => {
    if (paused || (statusRef.current[id] ?? "live") !== "live") return;
    const item = BACKLOG.find((i) => i.id === id)!;
    const next = { ...statusRef.current, [id]: to };
    statusRef.current = next;
    setStatus(next);
    if (to === "included") {
      const used = BACKLOG.filter((i) => next[i.id] === "included").reduce((n, i) => n + i.effort, 0);
      setNote(
        used > CAPACITY
          ? `${item.title} included. Scope creep: the sprint is ${used - CAPACITY} ${used - CAPACITY === 1 ? "point" : "points"} over capacity.`
          : `${item.title} included. ${used} of ${CAPACITY} points used.`
      );
    } else {
      setNote(`${item.title} ${how}. ${item.type === "debt" ? "Debt deferred: health falls." : ""}`.trim());
    }
    // Keep keyboard focus on the board: move it to the next live card.
    if (document.activeElement === cardEls.current.get(id)) {
      const nextLive = BACKLOG.find((i) => i.id !== id && (next[i.id] ?? "live") === "live" && cardEls.current.get(i.id));
      (nextLive ? cardEls.current.get(nextLive.id) : trackRef.current)?.focus();
    }
  };
  const decideRef = useRef(decide);
  decideRef.current = decide;

  useGameLoop(
    (dt) => {
      clock.current += dt;
      // Arrivals on a fixed schedule.
      const due = Math.min(BACKLOG.length, Math.floor(clock.current / spawnEvery) + 1);
      if (due > spawnedRef.current) {
        for (let k = spawnedRef.current; k < due; k++) ages.current.set(BACKLOG[k].id, 0);
        spawnedRef.current = due;
        setSpawned(due);
      }
      // Drift. In relaxed mode an item pauses while hovered or focused.
      for (const item of BACKLOG.slice(0, spawnedRef.current)) {
        if ((statusRef.current[item.id] ?? "live") !== "live") continue;
        const held = relaxed && (pausedOn.current.hover === item.id || pausedOn.current.focus === item.id);
        const age = (ages.current.get(item.id) ?? 0) + (held ? 0 : dt);
        ages.current.set(item.id, age);
        const share = Math.min(1, age / drift);
        const el = cardEls.current.get(item.id);
        if (el && !reduce) el.style.transform = `translateX(${trackWidth.current - share * (trackWidth.current + cardWidth(trackWidth.current))}px)`;
        const bar = barEls.current.get(item.id);
        if (bar) bar.style.width = `${(1 - share) * 100}%`;
        if (share >= 1) decideRef.current(item.id, "skipped", "drifted past");
      }
    },
    { running: !paused && !allMet }
  );

  // Swipe or drag across cards to include them; a tap includes the card under it. Works for mouse, pen and touch.
  const swiping = useRef(false);
  const includeAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const id = (el as HTMLElement).dataset?.item;
      if (id) return decide(id, "included", "");
    }
  };
  const trackHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (paused || e.button !== 0) return;
      swiping.current = true;
      // Capture keeps the swipe going past the track edge; if it isn't available, the swipe still works inside it.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      includeAt(e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (swiping.current) includeAt(e.clientX, e.clientY);
    },
    onPointerUp: () => (swiping.current = false),
    onPointerCancel: () => (swiping.current = false),
  };

  const commit = () => {
    const r = scoreSlice(included);
    onFinish({
      score: r.score,
      maxScore: BEST_SCORE,
      lines: [
        { label: "Capacity used", value: `${r.used} of ${CAPACITY} points${r.over ? `, ${r.over} over` : ""}` },
        { label: "Value (risk-adjusted)", value: `${r.value}` },
        { label: "Stability", value: `+${r.stability}` },
        { label: "Technical health", value: `${r.health}%` },
        {
          label: "Score breakdown",
          value: `${r.valuePoints} value + ${r.stability} stability + ${r.healthPoints} health${r.scopePenalty ? ` − ${r.scopePenalty} scope creep` : ""}`,
        },
      ],
      table: {
        caption: "What was included and skipped",
        columns: ["Item", "Decision", "Why"],
        rows: BACKLOG.map((i) => [i.title, included.has(i.id) ? "Included" : "Skipped", reasonFor(i, included.has(i.id))]),
      },
    });
  };

  const card = (i: BacklogItem, k: number) => (
    <button
      key={i.id}
      type="button"
      data-item={i.id}
      ref={(el) => {
        if (el) cardEls.current.set(i.id, el);
        else cardEls.current.delete(i.id);
      }}
      aria-label={`${i.title}. ${TYPE_LABEL[i.type]}, ${stats(i)}. Enter to include, Space to skip.`}
      onClick={(e) => e.detail === 0 && decide(i.id, "included", "")}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          decide(i.id, "included", "");
        } else if (e.key === " ") {
          e.preventDefault();
          decide(i.id, "skipped", "skipped");
        }
      }}
      onKeyUp={(e) => e.key === " " && e.preventDefault()}
      onPointerEnter={() => (pausedOn.current.hover = i.id)}
      onPointerLeave={() => pausedOn.current.hover === i.id && (pausedOn.current.hover = null)}
      onFocus={() => (pausedOn.current.focus = i.id)}
      onBlur={() => pausedOn.current.focus === i.id && (pausedOn.current.focus = null)}
      className={`${reduce ? "relative w-full" : "absolute left-0 h-16"} flex flex-col justify-center overflow-hidden rounded-md border-2 bg-panel px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-blue ${TYPE_STYLE[i.type]}`}
      style={reduce ? undefined : { width: cardWidth(trackWidth.current), top: (k % LANES) * LANE_PX + 6, transform: `translateX(${trackWidth.current}px)` }}
    >
      <span className="truncate text-sm text-text">{i.title}</span>
      <span className="truncate font-mono text-[0.6875rem] text-text-dim">
        {TYPE_LABEL[i.type]} · {stats(i)}
      </span>
      {reduce && (
        <span aria-hidden className="mt-1 h-0.5 rounded-full bg-panel-2">
          <span
            ref={(el) => {
              if (el) barEls.current.set(i.id, el);
              else barEls.current.delete(i.id);
            }}
            className="block h-0.5 rounded-full bg-signal-blue"
          />
        </span>
      )}
    </button>
  );

  const usedShare = Math.min(1, result.used / CAPACITY);
  const overShare = Math.min(1, result.over / CAPACITY);

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Value</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{result.value}</dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Stability</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">+{result.stability}</dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Health</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{healthNow}%</dd>
        </div>
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)_4rem] gap-2">
        <div
          ref={trackRef}
          tabIndex={-1}
          role="group"
          aria-label="Backlog items drifting past"
          aria-describedby="slice-keys"
          {...trackHandlers}
          className={`relative touch-none select-none overflow-hidden rounded-md border border-rule bg-ink outline-none ${reduce ? "flex flex-col gap-1.5 p-1.5" : ""}`}
          style={reduce ? { minHeight: LANES * LANE_PX } : { height: LANES * LANE_PX + 6 }}
        >
          {!reduce &&
            Array.from({ length: LANES - 1 }, (_, l) => (
              <span key={l} aria-hidden className="absolute inset-x-0 border-t border-dashed border-rule" style={{ top: (l + 1) * LANE_PX + 3 }} />
            ))}
          {BACKLOG.slice(0, spawned).map((i, k) => ((status[i.id] ?? "live") === "live" ? card(i, k) : null))}
          {allMet && (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-text-dim">The backlog has passed. Review the sprint, then commit it.</p>
          )}
        </div>

        {/* Sprint capacity: 20 points. Anything past the line is scope creep. */}
        <div className="flex flex-col items-center gap-1" aria-label={`Sprint capacity: ${result.used} of ${CAPACITY} points${result.over ? `, ${result.over} over` : ""}`} role="img">
          <span className="font-mono text-xs tabular-nums text-text">
            {result.used}/{CAPACITY}
          </span>
          <div className="relative w-8 flex-1 overflow-hidden rounded-md border border-rule bg-panel-2" style={{ minHeight: LANES * LANE_PX - 24 }}>
            <div className="absolute inset-x-0 bottom-0 bg-signal-teal" style={{ height: `${usedShare * 100}%` }} />
            {result.over > 0 && <div className="absolute inset-x-0 top-0 bg-signal-red" style={{ height: `${Math.max(6, overShare * 100)}%` }} />}
          </div>
          <span className="text-[0.625rem] text-text-faint">points</span>
        </div>
      </div>

      <div className="rounded-md border border-rule bg-ink p-2">
        <p className="text-xs text-text-faint">
          In the sprint · {included.size} {included.size === 1 ? "item" : "items"}
          {result.over > 0 && <span className="text-signal-red"> · scope creep: {result.over} over capacity</span>}
        </p>
        {included.size > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {BACKLOG.filter((i) => included.has(i.id)).map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (paused) return;
                    const next = { ...statusRef.current, [i.id]: "skipped" as Status };
                    statusRef.current = next;
                    setStatus(next);
                    setNote(`${i.title} taken out of the sprint.`);
                  }}
                  aria-label={`Take ${i.title} out of the sprint`}
                  className="rounded border border-rule bg-panel px-2 py-1 text-xs text-text hover:bg-panel-2"
                >
                  {i.title} <span className="font-mono text-text-faint">{i.effort}</span> <span aria-hidden className="text-text-faint">×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-text-dim">Nothing yet.</p>
        )}
      </div>

      {allMet && (
        <button type="button" onClick={commit} className="h-11 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
          Commit the sprint
        </button>
      )}

      <p id="slice-keys" className="text-xs text-text-faint">
        Swipe or drag across items, or tap one, to include it. Keyboard: Tab to an item, Enter to include, Space to skip. Items you leave drift past. P pauses.
      </p>
      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-text-dim">
        {note}
      </p>
    </div>
  );
}

export const sprintSlice: GameDefinition = {
  tutorial: [
    {
      title: "One sprint, 20 points",
      body: "Backlog items drift across the board. Each shows its value, its effort in points, and its risk. The bar on the side is the sprint's capacity.",
    },
    {
      title: "Include what earns its place",
      body: "Swipe or drag across an item, or tap it, to put it in the sprint. On a keyboard, Tab to an item, then Enter to include it or Space to skip it. Anything you leave drifts past.",
    },
    {
      title: "Not everything is a feature",
      body: "Critical bugs add stability. Technical debt costs capacity but keeps health up, and health falls faster each time debt is skipped in a row. Nice-to-haves bring little value.",
    },
    {
      title: "Mind the line",
      body: "Going past 20 points is scope creep and costs points. At the end you can take items out before you commit. Relaxed mode slows the drift, and items pause while you hover or focus them.",
    },
  ],
  Play: SprintSlicePlay,
  demonstrates: [
    "Judging backlog items by value for their effort, not by value alone.",
    "Holding the line on capacity instead of letting scope creep in.",
    "Making room for critical bugs and technical debt alongside new features.",
  ],
  scoreRewards: `Risk-adjusted value per capacity point, stability from critical bugs fixed, and technical health; every point over the ${CAPACITY}-point capacity costs ${SCORING.scopeCreepPerPoint}. Including everything or nothing both score low. Speed and clicks don't count.`,
  caseFocus: /backlog/i,
};

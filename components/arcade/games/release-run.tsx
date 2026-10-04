"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  COURSE,
  COURSE_LENGTH,
  FORKS,
  ITEM_LABEL,
  LANES,
  OUTCOME_LABEL,
  TUNING,
  VIEW_AHEAD,
  brake,
  changeLane,
  chooseRollout,
  initialRun,
  matchingRollout,
  outcomeFor,
  scoreRun,
  stepRun,
  type ItemKind,
  type Rollout,
  type RunState,
} from "@/lib/arcade/games/release-run";
import { useGameLoop } from "../use-game-loop";
import type { GameDefinition, PlayProps } from "../types";

/** Each kind has its own outline and a text label, so colour is never the only cue. */
const KIND_STYLE: Record<ItemKind, string> = {
  test: "border-signal-teal text-text",
  alignment: "border-signal-blue text-text",
  debt: "border-dashed border-text-faint text-text-dim",
  scope: "border-signal-amber bg-panel text-text",
  regression: "border-signal-red text-text",
};
const KIND_SHORT: Record<ItemKind, string> = { test: "Tests", alignment: "Aligned", debt: "Debt", scope: "Scope creep", regression: "Regression" };
const ITEM_PX = 30;
const MARKER_PX = 34;
/** Under reduced motion the course scrolls more slowly. */
const REDUCED_SPEED = 0.7;

const GATE_TEXT: Record<ReturnType<typeof outcomeFor>, string> = {
  smooth: "The release went out to everyone without issues.",
  minor: "The release went out. A minor incident followed and was fixed within the day.",
  "rolled-back": "Issues surfaced after the release, so it was rolled back to the previous version while they're fixed.",
};

function forkFit(f: RunState["forks"][number], i: number) {
  const fit = matchingRollout(i, f.riskAt, f.healthAt);
  if (f.matched) return "Fits the risk at that point";
  return fit === "controlled" ? "Less caution than the risk called for" : "More caution than the risk called for";
}

function ReleaseRunPlay({ relaxed, paused, onFinish }: PlayProps) {
  const reduce = useReducedMotion();
  const sim = useRef<RunState>(initialRun());
  // Display state: refreshed about ten times a second and on every event, never per frame.
  const [view, setView] = useState<RunState>(sim.current);
  const [visible, setVisible] = useState<number[]>([]);
  const [hoverHold, setHoverHold] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const trackH = useRef(320);
  const itemEls = useRef(new Map<number, HTMLElement>());
  const gateEl = useRef<HTMLDivElement>(null);
  const sinceUi = useRef(0);
  const forkElapsed = useRef(0);
  const forkFill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => (trackH.current = el.clientHeight));
    ro.observe(el);
    trackH.current = el.clientHeight;
    return () => ro.disconnect();
  }, []);

  const markerY = () => trackH.current - MARKER_PX - 8;
  const yFor = (at: number, traveled: number) => markerY() - ((at - traveled) / VIEW_AHEAD) * markerY();

  const publish = (s: RunState) => {
    sim.current = s;
    setView(s);
  };

  const paint = (s: RunState) => {
    for (const [id, el] of itemEls.current) {
      const item = COURSE[id];
      const top = yFor(item.until ?? item.at, s.traveled);
      el.style.transform = `translateY(${top}px)`;
    }
    if (gateEl.current) gateEl.current.style.transform = `translateY(${yFor(COURSE_LENGTH, s.traveled)}px)`;
  };

  const running = !paused && view.phase === "run" && !(relaxed && hoverHold);
  useGameLoop(
    (dt) => {
      const before = sim.current;
      const scaled = reduce ? dt * REDUCED_SPEED : dt;
      const s = stepRun(before, scaled, relaxed);
      sim.current = s;
      // Which items are on screen (re-render only when that set changes).
      const ids = COURSE.filter((c) => !s.resolved.includes(c.id) || (c.until ?? c.at) >= s.traveled)
        .filter((c) => c.at - s.traveled <= VIEW_AHEAD && (c.until ?? c.at) - s.traveled >= -12)
        .map((c) => c.id);
      setVisible((v) => (v.length === ids.length && v.every((x, i) => x === ids[i]) ? v : ids));
      paint(s);
      sinceUi.current += dt;
      if (s.note !== before.note || s.phase !== before.phase || sinceUi.current > 100) {
        sinceUi.current = 0;
        setView(s);
      }
    },
    { running }
  );

  // Fork decision timer (normal mode only). With no choice, the release continues as a controlled rollout.
  useEffect(() => {
    forkElapsed.current = 0;
    if (forkFill.current) forkFill.current.style.width = "100%";
  }, [view.forks.length, view.phase]);
  useGameLoop(
    (dt) => {
      forkElapsed.current += dt;
      const share = Math.min(1, forkElapsed.current / (TUNING.forkSeconds * 1000));
      if (forkFill.current) forkFill.current.style.width = `${(1 - share) * 100}%`;
      if (share >= 1) publish(chooseRollout(sim.current, "controlled", true));
    },
    { running: !paused && !relaxed && view.phase === "fork" }
  );

  const act = (fn: (s: RunState) => RunState) => {
    if (paused) return;
    publish(fn(sim.current));
  };
  const actRef = useRef(act);
  actRef.current = act;

  // Keys: ← → (or A, D) change lane, B or Space applies the rollback brake, 1 or 2 choose at a fork.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") actRef.current((s) => changeLane(s, s.lane - 1));
      else if (k === "ArrowRight" || k === "d" || k === "D") actRef.current((s) => changeLane(s, s.lane + 1));
      else if (k === "b" || k === "B" || k === " ") actRef.current(brake);
      else if (k === "1") actRef.current((s) => chooseRollout(s, "fast"));
      else if (k === "2") actRef.current((s) => chooseRollout(s, "controlled"));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);

  const finish = () => {
    const s = sim.current;
    const r = scoreRun(s);
    onFinish({
      score: r.score,
      maxScore: r.maxScore,
      lines: [
        { label: "At the gate", value: OUTCOME_LABEL[r.outcome] },
        { label: "Accumulated risk (simulated)", value: `${s.risk}` },
        { label: "Health", value: `${s.health}%` },
        { label: "Regressions caught by tests", value: `${s.tally.absorbed} of ${s.tally.absorbed + s.tally.regressions}` },
        { label: "Rollback brakes used", value: `${s.tally.brakes} of ${TUNING.brake.uses}` },
        { label: "Score breakdown", value: `${r.matches * 15} rollout fit + ${r.score - r.matches * 15 - r.healthPoints} gate + ${r.healthPoints} health` },
      ],
      table: {
        caption: "Each fork, and the risk at that point",
        columns: ["Fork", "Risk then", "Health then", "Choice", "How it fit"],
        rows: s.forks.map((f, i) => [
          `${i + 1}`,
          `${f.riskAt}`,
          `${f.healthAt}%`,
          `${f.choice === "fast" ? "Fast release" : "Controlled rollout"}${f.timedOut ? " (no choice in time)" : ""}`,
          forkFit(f, i),
        ]),
      },
    });
  };

  const s = view;
  const laneLeft = (l: number) => `${(l * 100) / LANES}%`;
  const forkIndex = s.forks.length;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-4 gap-2">
        {[
          ["Health", `${s.health}%`],
          ["Risk", `${s.risk}`],
          ["Shields", `${s.shields}`],
          ["Brakes", `${s.brakesLeft}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-rule bg-ink px-2 py-1.5">
            <dt className="text-[0.625rem] text-text-faint">{k}</dt>
            <dd
              className={`font-mono text-base tabular-nums ${
                k === "Risk" && s.risk >= 5 ? "text-signal-amber" : k === "Health" && s.health < 50 ? "text-signal-amber" : "text-text"
              }`}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <div aria-hidden className="h-1 rounded-full bg-panel-2">
        <div className="h-1 rounded-full bg-signal-blue" style={{ width: `${(s.traveled / COURSE_LENGTH) * 100}%` }} />
      </div>

      {/* The course: three lanes. Tap a lane to move into it. */}
      <div
        ref={trackRef}
        role="group"
        aria-label={`Release course, lane ${s.lane + 1} of ${LANES}`}
        aria-describedby="run-keys"
        className="relative h-[20rem] touch-none select-none overflow-hidden rounded-md border border-rule bg-ink sm:h-[24rem]"
        onPointerDown={(e) => {
          if (paused || s.phase !== "run") return;
          const r = e.currentTarget.getBoundingClientRect();
          const lane = Math.min(LANES - 1, Math.floor(((e.clientX - r.left) / r.width) * LANES));
          act((st) => changeLane(st, lane));
        }}
      >
        {Array.from({ length: LANES - 1 }, (_, l) => (
          <span key={l} aria-hidden className="absolute inset-y-0 border-l border-dashed border-rule" style={{ left: laneLeft(l + 1) }} />
        ))}
        {/* The production gate. */}
        <div ref={gateEl} aria-hidden className="absolute inset-x-0 top-0 flex h-6 items-center justify-center border-y-2 border-signal-teal bg-panel font-mono text-[0.625rem] text-text">
          Production gate
        </div>
        {visible.map((id) => {
          const item = COURSE[id];
          const h = item.until ? Math.max(ITEM_PX, ((item.until - item.at) / VIEW_AHEAD) * (trackH.current - MARKER_PX - 8)) : ITEM_PX;
          return (
            <div
              key={id}
              ref={(el) => {
                if (el) {
                  itemEls.current.set(id, el);
                  el.style.transform = `translateY(${yFor(item.until ?? item.at, sim.current.traveled)}px)`;
                } else itemEls.current.delete(id);
              }}
              onPointerEnter={() => relaxed && setHoverHold(true)}
              onPointerLeave={() => setHoverHold(false)}
              title={ITEM_LABEL[item.kind]}
              className={`absolute top-0 flex items-center justify-center overflow-hidden rounded border-2 bg-panel-2 px-1 text-center text-[0.625rem] leading-tight ${KIND_STYLE[item.kind]}`}
              style={{ left: `calc(${laneLeft(item.lane)} + 6px)`, width: `calc(${100 / LANES}% - 12px)`, height: h }}
            >
              {KIND_SHORT[item.kind]}
            </div>
          );
        })}
        {/* The release marker: a plain square. */}
        <div
          aria-hidden
          className={`absolute flex items-center justify-center rounded border-2 border-text bg-panel font-mono text-[0.5625rem] text-text ${reduce ? "" : "transition-[left] duration-100"}`}
          style={{ width: MARKER_PX, height: MARKER_PX, bottom: 8, left: `calc(${laneLeft(s.lane)} + (${100 / LANES}% - ${MARKER_PX}px) / 2)` }}
        >
          {s.shields > 0 ? `+${s.shields}` : "R"}
        </div>

        {s.phase === "fork" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_88%,transparent)] p-3" role="dialog" aria-labelledby="fork-title" aria-modal="false">
            <div className="w-full max-w-sm rounded-md border border-rule bg-panel p-3" onPointerDown={(e) => e.stopPropagation()}>
              <p id="fork-title" className="text-sm text-text">
                Fork {forkIndex + 1} of {FORKS.length}: how do you release from here?
              </p>
              <p className="mt-1 text-xs text-text-dim">
                Risk so far {s.risk} · health {s.health}%
              </p>
              <div className="mt-3 grid gap-2">
                {(
                  [
                    ["fast", "Fast release", "Full speed; new risk counts for more", "1"],
                    ["controlled", "Controlled rollout", "Staged and slower; new risk counts for less", "2"],
                  ] as [Rollout, string, string, string][]
                ).map(([id, label, hint, key]) => (
                  <button
                    key={id}
                    type="button"
                    aria-keyshortcuts={key}
                    onClick={() => act((st) => chooseRollout(st, id))}
                    className="flex items-baseline justify-between gap-2 rounded-md border border-rule bg-ink px-3 py-2 text-left hover:bg-panel-2"
                  >
                    <span>
                      <span className="block text-sm text-text">{label}</span>
                      <span className="block text-xs text-text-dim">{hint}</span>
                    </span>
                    <span className="rounded border border-rule px-1 font-mono text-[0.625rem] text-text-faint">{key}</span>
                  </button>
                ))}
              </div>
              {!relaxed && (
                <div aria-hidden className="mt-2 h-1 rounded-full bg-panel-2">
                  <div ref={forkFill} className="h-1 rounded-full bg-signal-blue" />
                </div>
              )}
            </div>
          </div>
        )}

        {s.phase === "done" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_88%,transparent)] p-3" onPointerDown={(e) => e.stopPropagation()}>
            <div className="w-full max-w-sm rounded-md border border-rule bg-panel p-4" role="status">
              <p className="font-mono text-xs uppercase tracking-wider text-text-faint">At the gate</p>
              <p className="mt-1 text-lg text-text">{OUTCOME_LABEL[outcomeFor(s.risk)]}</p>
              <p className="mt-1 text-sm text-text-dim">{GATE_TEXT[outcomeFor(s.risk)]}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-text-dim">
                {s.forks.map((f, i) => (
                  <li key={i}>
                    Fork {i + 1}: {f.choice === "fast" ? "fast release" : "controlled rollout"} with risk at {f.riskAt}.
                  </li>
                ))}
                <li>Accumulated risk at the gate: {s.risk}.</li>
              </ul>
              <button type="button" onClick={finish} className="mt-3 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
                Continue to the debrief
              </button>
            </div>
          </div>
        )}
      </div>

      {s.phase === "run" && (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" aria-keyshortcuts="ArrowLeft" onClick={() => act((st) => changeLane(st, st.lane - 1))} className={ctrl}>
            ← Lane
          </button>
          <button type="button" aria-keyshortcuts="B" disabled={!s.brakesLeft} onClick={() => act(brake)} className={ctrl}>
            Brake ({s.brakesLeft})
          </button>
          <button type="button" aria-keyshortcuts="ArrowRight" onClick={() => act((st) => changeLane(st, st.lane + 1))} className={ctrl}>
            Lane →
          </button>
        </div>
      )}

      <p id="run-keys" className="text-xs text-text-faint">
        Change lane with ← → (or A, D), by tapping a lane, or with the buttons. B or Space is the rollback brake. 1 or 2 chooses at a fork. P pauses.
      </p>
      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-text-dim">
        {s.note}
      </p>
    </div>
  );
}

const ctrl =
  "h-11 rounded-md border border-rule px-2 text-sm text-text transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export const releaseRun: GameDefinition = {
  tutorial: [
    {
      title: "Get the release to the gate",
      body: "Your release runs down three lanes toward the production gate. Change lane with the arrow keys, by tapping a lane, or with the buttons.",
    },
    {
      title: "What's on the course",
      body: "Tests give a shield that catches one regression. Stakeholder alignment gives a short burst of speed. Technical debt slows you down, scope creep blocks a lane, and regressions cut health. Each obstacle adds risk.",
    },
    {
      title: "Two forks, one brake",
      body: "Twice on the way, choose a fast release (full speed, new risk counts for more) or a controlled rollout (staged and slower, new risk counts for less). The rollback brake (B) slows you down and recovers health, twice.",
    },
    {
      title: "At the gate",
      body: "Accumulated risk decides how the release goes. The score rewards matching the rollout to the risk, not speed. Relaxed mode slows the course and removes the fork timer.",
    },
  ],
  Play: ReleaseRunPlay,
  demonstrates: [
    "Matching the rollout to the risk: moving fast when it's low, and staging the release when it has built up.",
    "Testing as a way to catch regressions before they reach production.",
    "Keeping scope and technical debt from quietly adding risk to a release.",
  ],
  scoreRewards:
    "Choosing the rollout that fits the risk at each fork, a smooth outcome at the gate, and the health you keep. Speed doesn't count: a controlled rollout when risk is high scores better than a fast one.",
  caseFocus: /business case|prototypes|migration/i,
};

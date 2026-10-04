"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArcadeEntry } from "@/lib/arcade/registry";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";
import { trackEvent } from "@/components/analytics/tracker";
import { Debrief, RealCase } from "./debrief";
import type { GameDefinition, GameResult } from "./types";

type Phase = "tutorial" | "play" | "debrief" | "real-case";
const PHASES: { id: Phase; label: string }[] = [
  { id: "tutorial", label: "Tutorial" },
  { id: "play", label: "Play" },
  { id: "debrief", label: "Debrief" },
  { id: "real-case", label: "Real case" },
];

const RELAXED_KEY = "arcade:relaxed";

/** Relaxed mode (no timer, slower pace), remembered for this browser tab's session. */
function useRelaxed() {
  const [relaxed, setRelaxed] = useState(false);
  useEffect(() => {
    try {
      setRelaxed(sessionStorage.getItem(RELAXED_KEY) === "1");
    } catch {
      // Storage unavailable: start with relaxed mode off.
    }
  }, []);
  const toggle = () =>
    setRelaxed((r) => {
      try {
        sessionStorage.setItem(RELAXED_KEY, r ? "0" : "1");
      } catch {
        // Not remembered, but still applied.
      }
      return !r;
    });
  return [relaxed, toggle] as const;
}

const primary = "h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90";
const secondary = "h-10 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2";

/**
 * The frame every arcade game runs in: tutorial (short, skippable) → play →
 * debrief → real case. Owns relaxed mode, pause (also P, and automatic when the
 * tab is hidden), restart, focus moves between phases and the arcade_ events.
 */
export function GameShell({ entry, game, cases }: { entry: ArcadeEntry; game: GameDefinition; cases: PrototypeCaseStudy[] }) {
  const [phase, setPhase] = useState<Phase>("tutorial");
  const [step, setStep] = useState(0);
  const [relaxed, toggleRelaxed] = useRelaxed();
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);

  // Each phase's heading takes focus, so keyboard and screen-reader users land on the new content.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [phase, step]);

  const startPlay = () => {
    setResult(null);
    setPaused(false);
    setRun((n) => n + 1);
    setPhase("play");
    trackEvent("arcade_game_start", entry.slug);
  };
  const onFinish = useCallback(
    (r: GameResult) => {
      setResult(r);
      setPhase("debrief");
      trackEvent("arcade_game_complete", entry.slug);
      trackEvent("arcade_debrief_view", entry.slug);
    },
    [entry.slug]
  );

  // Hiding the tab pauses play; the player resumes when they're back.
  useEffect(() => {
    if (phase !== "play") return;
    const onVisibility = () => document.hidden && setPaused(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "p" || e.key === "P") && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target instanceof HTMLInputElement)) setPaused((p) => !p);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase]);

  const tutorialStep = game.tutorial[step];
  const heading =
    phase === "tutorial" ? tutorialStep.title : phase === "play" ? (paused ? "Paused" : entry.title) : phase === "debrief" ? "Debrief" : "The real case";

  return (
    <section aria-labelledby="game-phase-title" className="rounded-lg border border-rule bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-6">
        <ol aria-label="Phases" className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {PHASES.map((p, i) => {
            const current = p.id === phase;
            const done = PHASES.findIndex((x) => x.id === phase) > i;
            return (
              <li key={p.id} aria-current={current ? "step" : undefined} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="h-px w-3 bg-rule" />}
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    current ? "border-signal-teal text-text" : done ? "border-rule text-text-dim" : "border-rule text-text-faint"
                  }`}
                >
                  {p.label}
                </span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          role="switch"
          aria-checked={relaxed}
          onClick={toggleRelaxed}
          className="flex items-center gap-2 rounded-md border border-rule px-2.5 py-1 text-sm text-text-dim transition-colors hover:bg-panel-2 hover:text-text"
        >
          <span aria-hidden className={`relative h-4 w-7 rounded-full border border-rule motion-safe:transition-colors ${relaxed ? "bg-signal-blue" : "bg-panel-2"}`}>
            <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-text motion-safe:transition-[left] ${relaxed ? "left-[0.875rem]" : "left-0.5"}`} />
          </span>
          Relaxed mode
        </button>
      </div>

      <div className="p-4 sm:p-6">
        <h2 id="game-phase-title" ref={headingRef} tabIndex={-1} className="text-2xl">
          {heading}
        </h2>
        {relaxed && phase === "play" && <p className="mt-1 text-xs text-text-faint">Relaxed mode: no timer, slower pace.</p>}

        {phase === "tutorial" && (
          <div className="mt-3">
            <p className="max-w-prose text-text-dim">{tutorialStep.body}</p>
            <p className="mt-3 font-mono text-xs text-text-faint">
              Step {step + 1} of {game.tutorial.length}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {step > 0 && (
                <button type="button" className={secondary} onClick={() => setStep((s) => s - 1)}>
                  Back
                </button>
              )}
              {step < game.tutorial.length - 1 ? (
                <button type="button" className={primary} onClick={() => setStep((s) => s + 1)}>
                  Next
                </button>
              ) : (
                <button type="button" className={primary} onClick={startPlay}>
                  Start
                </button>
              )}
              {step < game.tutorial.length - 1 && (
                <button type="button" className={secondary} onClick={startPlay}>
                  Skip tutorial
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "play" && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} aria-keyshortcuts="P" onClick={() => setPaused((p) => !p)}>
                {paused ? "Resume" : "Pause"}
              </button>
              <button type="button" className={secondary} onClick={startPlay}>
                Restart
              </button>
            </div>
            <div className="relative mt-4">
              <div inert={paused || undefined} className={paused ? "opacity-40" : ""}>
                <game.Play key={run} relaxed={relaxed} paused={paused} onFinish={onFinish} />
              </div>
              {paused && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button type="button" className={primary} onClick={() => setPaused(false)}>
                    Resume
                  </button>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-text-faint">Press P to pause or resume.</p>
          </div>
        )}

        {phase === "debrief" && result && (
          <div className="mt-4">
            <Debrief game={game} result={result} />
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={() => setPhase("real-case")}>
                See the real case
              </button>
              <button type="button" className={secondary} onClick={startPlay}>
                Play again
              </button>
            </div>
          </div>
        )}

        {phase === "real-case" && (
          <div className="mt-4">
            <RealCase entry={entry} cases={cases} focus={game.caseFocus} />
            <button type="button" className={`${secondary} mt-6`} onClick={startPlay}>
              Play again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";

/** One fixed simulation step: 60 per second, whatever the display's refresh rate. */
export const STEP_MS = 1000 / 60;
/** After a long frame, catch up at most this many steps, so a stall never fast-forwards the game. */
const MAX_STEPS_PER_FRAME = 5;

/**
 * A fixed-timestep game loop. `step(dtMs)` runs at a steady rate, scaled by
 * `speed` (relaxed mode slows it), from requestAnimationFrame. It stops while
 * `running` is false and whenever the tab is hidden, and never jumps ahead on
 * return.
 */
export function useGameLoop(step: (dtMs: number) => void, { running, speed = 1 }: { running: boolean; speed?: number }) {
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last: number | null = null;
    let acc = 0;

    const frame = (now: number) => {
      if (last !== null) {
        acc += Math.min(now - last, STEP_MS * MAX_STEPS_PER_FRAME);
        while (acc >= STEP_MS) {
          stepRef.current(STEP_MS * speed);
          acc -= STEP_MS;
        }
      }
      last = now;
      raf = requestAnimationFrame(frame);
    };
    // Idempotent: a second start (say, a "visible" event while already running) never doubles the loop.
    const start = () => {
      cancelAnimationFrame(raf);
      last = null;
      acc = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => cancelAnimationFrame(raf);
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running, speed]);
}

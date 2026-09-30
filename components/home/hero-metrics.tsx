"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { formatMetric } from "@/lib/format";
import type { HeroMetric } from "@/lib/highlights";

const DURATION_MS = 800;
const SESSION_KEY = "flightdeck:hero-counted";
// Module-level flag: survives client-side route changes within the session.
let countedThisSession = false;

// useLayoutEffect on the client (reset to 0 before first paint, so there's no
// flash of the final numbers); plain useEffect during SSR to avoid the warning.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Homepage hero load sequence: the four numbers count up from 0 once per
 * session, on first mount. Server HTML carries the real values (no-JS, crawlers
 * and screen readers always get them); reduced-motion visitors see them directly.
 */
export function HeroMetrics({ metrics }: { metrics: HeroMetric[] }) {
  const [progress, setProgress] = useState(1);

  useIsomorphicLayoutEffect(() => {
    let alreadyCounted = countedThisSession;
    try {
      alreadyCounted ||= window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // storage blocked: fall back to the module flag
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = () => delete document.documentElement.dataset.heroCount;
    if (alreadyCounted || reduceMotion) {
      reveal();
      return;
    }

    const markCounted = (value: boolean) => {
      countedThisSession = value;
      try {
        if (value) window.sessionStorage.setItem(SESSION_KEY, "1");
        else window.sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    };
    markCounted(true);
    setProgress(0);
    reveal(); // numbers were hidden pre-hydration; they now start from 0

    let frame = 0;
    let done = false;
    const start = performance.now();
    const tick = (now: number) => {
      // rAF timestamps can precede `start` by a fraction of a frame; clamp to [0, 1].
      const t = Math.min(1, Math.max(0, (now - start) / DURATION_MS));
      setProgress(1 - Math.pow(1 - t, 3)); // ease-out cubic
      if (t < 1) frame = requestAnimationFrame(tick);
      else done = true;
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      // Interrupted before finishing (e.g. React Strict Mode's double mount): allow a rerun.
      if (!done) {
        markCounted(false);
        setProgress(1);
      }
    };
  }, []);

  return (
    <>
      {/* Runs before first paint on a full page load: if the count-up is about to
          play, hide the server-rendered final numbers until hydration resets them
          to 0 (avoids a final → 0 → final flash). Client-side navigations don't
          execute it, and they never animate anyway. */}
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      <MetricList metrics={metrics} progress={progress} />
    </>
  );
}

const PRE_PAINT_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(SESSION_KEY)})!=="1"&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.heroCount="pending"}catch(e){}`;

function MetricList({ metrics, progress }: { metrics: HeroMetric[]; progress: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {metrics.map((m) => {
        const current = progress >= 1 ? m.value : Number.isInteger(m.value) ? Math.round(m.value * progress) : m.value * progress;
        const finalText = formatMetric(m.value, m.unit);
        const body = (
          <>
            <span className="block text-sm text-text-faint">{m.label}</span>
            <span className="mt-2 block font-mono text-3xl font-medium tabular-nums text-text sm:text-4xl">
              <span aria-hidden className="hero-count-value">
                {formatMetric(current, m.unit)}
              </span>
              <span className="sr-only">{finalText}</span>
            </span>
            {m.context && <span className="mt-1 block text-sm text-text-dim">{m.context}</span>}
          </>
        );
        const cardClass = `block h-full rounded-lg border bg-panel p-4 sm:p-5 ${m.standout ? "border-signal-amber" : "border-rule"}`;
        return (
          <li key={m.key}>
            {m.href ? (
              <Link href={m.href} className={`${cardClass} transition-colors hover:bg-panel-2`}>
                {body}
              </Link>
            ) : (
              <div className={cardClass}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

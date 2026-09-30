"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

type Phase = "idle" | "loading" | "done";

/** Only show the bar if a navigation takes longer than this; fast ones never flash it. */
const SHOW_AFTER_MS = 80;

/**
 * 2px teal bar at the top of the viewport while a route transition is in
 * flight. The App Router has no router events, so a navigation "starts" on a
 * click on an internal link and "completes" when the pathname changes.
 * Ignored: modified clicks, new-tab/download links, same-page (hash) links,
 * and clicks that change the URL synchronously (case-study cards expand in
 * place via pushState, so there's nothing to wait for).
 * Reduced motion: a static full-width bar while loading, removed on completion.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const pending = useRef(false);
  const showTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      const target = url.pathname + url.search;
      // Let the click's own handlers run first: if the URL already changed, it was instant.
      window.setTimeout(() => {
        if (window.location.pathname + window.location.search === target) return;
        pending.current = true;
        window.clearTimeout(showTimer.current);
        showTimer.current = window.setTimeout(() => {
          if (pending.current) setPhase("loading");
        }, SHOW_AFTER_MS);
      }, 0);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // The new route has rendered.
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    window.clearTimeout(showTimer.current);
    setPhase((p) => (p === "loading" ? "done" : "idle"));
  }, [pathname]);

  // Finish: fill and fade (or just disappear under reduced motion).
  useEffect(() => {
    if (phase !== "done") return;
    const t = window.setTimeout(() => setPhase("idle"), reduceMotion ? 0 : 320);
    return () => window.clearTimeout(t);
  }, [phase, reduceMotion]);

  if (phase === "idle") return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      {reduceMotion ? (
        <div className="h-full w-full bg-signal-teal" />
      ) : (
        <motion.div
          className="h-full bg-signal-teal"
          initial={{ width: "0%", opacity: 1 }}
          animate={phase === "loading" ? { width: "85%", opacity: 1 } : { width: "100%", opacity: 0 }}
          transition={
            phase === "loading"
              ? { width: { duration: 8, ease: [0.1, 0.9, 0.2, 1] } } // quick start, then creeps while waiting
              : { width: { duration: 0.12 }, opacity: { duration: 0.2, delay: 0.1 } }
          }
        />
      )}
    </div>
  );
}

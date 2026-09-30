"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { WorkDetail, WorkSummary } from "@/lib/work";
import { WorkDetailView } from "./work-detail";
import { workLayoutId } from "./work-card";

type Loaded = { work: WorkDetail; prev: WorkSummary | null; next: WorkSummary | null };

/**
 * Expanded case study the clicked card morphs into (shared layoutId). Rendered
 * by WorkGrid in the same update as the click, which is what lets framer-motion
 * measure the card and animate from it. Details load while the box grows; the
 * card's own title shows immediately. Reduced motion: no morph, no fade.
 */
export function CaseStudyOverlay({ summary, onClose }: { summary: WorkSummary; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [scrollTop] = useState(() => window.scrollY); // mounted on click, so window exists
  const titleId = `case-study-${summary.slug}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/work/${encodeURIComponent(summary.slug)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Loaded) => setData(d))
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error(err);
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [summary.slug]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <motion.div
      // Absolutely positioned at the current scroll offset (not position: fixed),
      // so the panel is measured in the same page coordinates as the card it
      // morphs from; with page scroll locked it behaves exactly like a fixed
      // layer. layoutScroll accounts for this container's own scroll.
      layoutScroll
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="absolute inset-x-0 z-50 h-dvh overflow-y-auto"
      style={{ top: scrollTop, background: "color-mix(in srgb, var(--ink) 82%, transparent)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        layoutId={workLayoutId(summary.slug)}
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
        className="relative mx-auto my-6 max-w-4xl rounded-lg border border-rule bg-ink px-5 py-10 outline-none sm:my-10 sm:px-10"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md border border-rule px-3 py-1 text-sm text-text-dim transition-colors hover:text-text"
        >
          Close
        </button>
        <motion.div initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12, duration: 0.2 }}>
          {data ? (
            <WorkDetailView work={data.work} prev={data.prev} next={data.next} titleAs="h2" titleId={titleId} />
          ) : (
            <header>
              <h2 id={titleId} className="max-w-[24ch] text-4xl sm:text-5xl">
                {summary.title}
              </h2>
              {summary.subtitle && <p className="mt-3 text-xl text-text-dim">{summary.subtitle}</p>}
              <p className="mt-8 text-sm text-text-faint" role="status">
                {failed ? "Couldn't load the full case study. Try again or open it as a page." : "Loading case study…"}
              </p>
            </header>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

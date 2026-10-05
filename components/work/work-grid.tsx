"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkSummary } from "@/lib/work";
import { WorkCard } from "./work-card";
import { CaseStudyOverlay } from "./case-study-overlay";

/**
 * A grid of case study cards that expand in place. Clicking a card opens the
 * overlay in the same render (so the card→detail morph can run) and pushes
 * /work/[slug] onto history; Back, Escape or Close collapse it. Refreshing or
 * sharing that URL loads the full server-rendered page instead.
 * Modified clicks (new tab, etc.) keep normal link behaviour.
 */
export function WorkGrid({ work, className = "", headingLevel = 3 }: { work: WorkSummary[]; className?: string; headingLevel?: 2 | 3 }) {
  const [open, setOpen] = useState<WorkSummary | null>(null);

  useEffect(() => {
    // Back button (or history.back from close) collapses the overlay.
    const onPop = () => setOpen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openCard = useCallback((w: WorkSummary, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history.pushState(null, "", `/work/${w.slug}`);
    setOpen(w);
  }, []);

  const close = useCallback(() => window.history.back(), []);

  return (
    <>
      <ul className={className}>
        {work.map((w) => (
          <li key={w.id}>
            <WorkCard work={w} onOpen={(e) => openCard(w, e)} headingLevel={headingLevel} />
          </li>
        ))}
      </ul>
      {open && <CaseStudyOverlay summary={open} onClose={close} />}
    </>
  );
}

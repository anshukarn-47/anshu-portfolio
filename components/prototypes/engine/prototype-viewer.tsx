"use client";

import { useCallback, useRef, useState } from "react";
import type { PrototypeEntry } from "@/lib/prototypes/registry";
import { PROTOTYPE_CANVASES } from "@/components/prototypes/canvases";
import { PrototypeHeader, type ViewMode } from "./prototype-header";
import { PrototypeControls } from "./prototype-controls";
import { ProductLens } from "./product-lens";
import { CaseStudyView, type PrototypeCaseStudy } from "./case-study-view";

const LENS_ID = "product-lens";

/**
 * The shell every prototype runs in: header with the Experience / Case study
 * toggle, the prototype's canvas (with the Product lens over it), and controls.
 * All prototype state is local React state; Restart remounts the canvas.
 *
 * Prototypes with revealAfterPlay end with their own real-world reveal, so the
 * Case study mode and the lens trade-offs unlock only once the canvas reports
 * completion (for the rest of the visit to this page).
 */
export function PrototypeViewer({ prototype, caseStudy }: { prototype: PrototypeEntry; caseStudy: PrototypeCaseStudy | null }) {
  const [mode, setMode] = useState<ViewMode>("experience");
  const [lensOpen, setLensOpen] = useState(false);
  const [runId, setRunId] = useState(0);
  const [completed, setCompleted] = useState(false);
  const lensButtonRef = useRef<HTMLButtonElement>(null);
  const closeLens = useCallback(() => {
    setLensOpen(false);
    lensButtonRef.current?.focus();
  }, []);
  const onComplete = useCallback(() => setCompleted(true), []);

  const locked = !!prototype.revealAfterPlay && !completed;
  const Canvas = PROTOTYPE_CANVASES[prototype.slug];

  return (
    <div>
      <PrototypeHeader
        prototype={prototype}
        mode={mode}
        onModeChange={setMode}
        hasCaseStudy={!!prototype.relatedWorkSlug}
        caseStudyLocked={locked}
      />

      <div className="mt-8">
        {/* The canvas stays mounted while the case study is shown, so a run isn't lost by switching views. */}
        <div hidden={mode !== "experience"}>
          <div className="relative overflow-hidden rounded-lg border border-rule bg-ink">
            {Canvas ? (
              <Canvas key={runId} caseStudy={caseStudy} onComplete={onComplete} />
            ) : (
              <p className="p-8 text-sm text-text-dim">This prototype is on its way.</p>
            )}
            <ProductLens id={LENS_ID} prototype={prototype} open={lensOpen} onClose={closeLens} tradeoffsLocked={locked} />
          </div>
          <PrototypeControls
            onReset={() => setRunId((n) => n + 1)}
            lensOpen={lensOpen}
            onToggleLens={() => setLensOpen((o) => !o)}
            lensId={LENS_ID}
            lensButtonRef={lensButtonRef}
          />
        </div>
        {mode === "case-study" && !locked && <CaseStudyView caseStudy={caseStudy} prototype={prototype} />}
      </div>
    </div>
  );
}

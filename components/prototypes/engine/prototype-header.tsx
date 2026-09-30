import Link from "next/link";
import type { PrototypeEntry } from "@/lib/prototypes/registry";
import { CategoryBadge } from "./category-badge";

export type ViewMode = "experience" | "case-study";

const MODES: { value: ViewMode; label: string }[] = [
  { value: "experience", label: "Experience" },
  { value: "case-study", label: "Case study" },
];

/**
 * Title, category and hook, with the Experience / Case study toggle. The case
 * study can be locked until the prototype is played through (revealAfterPlay).
 */
export function PrototypeHeader({
  prototype,
  mode,
  onModeChange,
  hasCaseStudy,
  caseStudyLocked = false,
}: {
  prototype: PrototypeEntry;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  hasCaseStudy: boolean;
  caseStudyLocked?: boolean;
}) {
  return (
    <header>
      <Link href="/prototype-lab" className="text-sm text-text-dim hover:text-text">
        ← Prototype lab
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <CategoryBadge category={prototype.category} />
          <h1 className="mt-3 text-4xl sm:text-5xl">{prototype.title}</h1>
          <p className="mt-3 max-w-prose text-lg text-text-dim">{prototype.hook}</p>
        </div>
        {hasCaseStudy && (
          <div className="flex flex-col items-end gap-1">
            <div role="group" aria-label="View" className="flex rounded-md border border-rule p-0.5 text-sm">
              {MODES.map((m) => {
                const locked = m.value === "case-study" && caseStudyLocked;
                return (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={mode === m.value}
                    disabled={locked}
                    aria-describedby={locked ? "case-study-locked" : undefined}
                    onClick={() => onModeChange(m.value)}
                    className={`rounded px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${
                      mode === m.value ? "bg-panel-2 text-text" : "text-text-dim hover:text-text"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            {caseStudyLocked && (
              <p id="case-study-locked" className="text-xs text-text-faint">
                The case study unlocks when you finish the simulation.
              </p>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

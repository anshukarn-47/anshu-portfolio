"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PrototypeEntry } from "@/lib/prototypes/registry";
import { MetricsPanel } from "./metrics-panel";
import { TradeoffPanel } from "./tradeoff-panel";

const LENS: { key: keyof PrototypeEntry["pmLens"]; label: string }[] = [
  { key: "user", label: "User" },
  { key: "problem", label: "Problem" },
  { key: "signal", label: "Signal" },
  { key: "decision", label: "Decision" },
];

/**
 * Product lens: a panel over the canvas explaining the prototype as a product
 * problem (user, problem, signal, decision), what I'd measure, and the
 * trade-offs. Escape closes it; focus moves in when it opens.
 */
export function ProductLens({
  id,
  prototype,
  open,
  onClose,
  tradeoffsLocked = false,
}: {
  id: string;
  prototype: PrototypeEntry;
  open: boolean;
  onClose: () => void;
  /** The trade-offs give away the real decision, so they can wait until the prototype is finished. */
  tradeoffsLocked?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          id={id}
          aria-labelledby={`${id}-title`}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="absolute inset-y-0 right-0 z-10 w-full overflow-y-auto border-l border-rule bg-panel p-5 shadow-2xl sm:w-[26rem]"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="text-lg">
              Product lens
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-rule px-2 py-1 text-xs text-text-dim hover:text-text"
            >
              Close
            </button>
          </div>

          <dl className="mt-4 space-y-3">
            {LENS.map(({ key, label }) => (
              <div key={key}>
                <dt className="font-mono text-xs uppercase tracking-wider text-signal-blue">{label}</dt>
                <dd className="mt-0.5 text-sm text-text-dim">{prototype.pmLens[key]}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 border-t border-rule pt-5">
            <MetricsPanel measures={prototype.whatIWouldMeasure} />
          </div>
          <div className="mt-6 border-t border-rule pt-5">
            {tradeoffsLocked ? (
              <>
                <h3 className="text-base">Trade-offs</h3>
                <p className="mt-2 text-sm text-text-faint">These unlock when you finish the simulation, so they don&apos;t give the game away.</p>
              </>
            ) : (
              <TradeoffPanel tradeoffs={prototype.tradeoffs} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

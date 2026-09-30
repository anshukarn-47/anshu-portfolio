"use client";

import { useEffect, useRef, useState } from "react";

type State = "idle" | "copied" | "failed";

const COPIED_MS = 1200;
const FAILED_MS = 2400;

/**
 * Copies a value with the Clipboard API. Success: the icon becomes a teal
 * checkmark for ~1.2s, then reverts. Failure (rejected, or the API isn't
 * available, e.g. on http): a brief inline "Couldn't copy" in signal red.
 * The colour change is motion-safe only; with reduced motion it just switches.
 *
 * `absolute`: resolve `value` against the current origin (for site paths like
 * "/resume.pdf" or "/" for the portfolio link), since the server doesn't know
 * the public URL.
 */
export function CopyButton({ value, label, absolute = false }: { value: string; label: string; absolute?: boolean }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    window.clearTimeout(timer.current);
    const text = absolute ? new URL(value, window.location.origin).href : value;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      setState("copied");
      timer.current = window.setTimeout(() => setState("idle"), COPIED_MS);
    } catch {
      setState("failed");
      timer.current = window.setTimeout(() => setState("idle"), FAILED_MS);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border motion-safe:transition-colors ${
          state === "copied" ? "border-signal-teal text-signal-teal" : "border-rule text-text-dim hover:text-text"
        }`}
      >
        {state === "copied" ? <CheckIcon /> : <CopyIcon />}
      </button>
      {state === "failed" && (
        <span className="text-xs text-signal-red" aria-hidden>
          Couldn&apos;t copy
        </span>
      )}
      <span className="sr-only" role="status">
        {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : ""}
      </span>
    </span>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

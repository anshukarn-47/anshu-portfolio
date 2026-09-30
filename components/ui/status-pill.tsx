/**
 * The recurring status motif: a 6px dot beside a short label in a bordered pill.
 *
 * - "live": teal dot with the soft pulse (the only ambient animation on the site)
 * - "ok": teal dot, no pulse (operational but not a live signal)
 * - "alert": amber, only for a real warning state, never decoration
 * - "idle": neutral
 * - "critical": red dot with the same soft pulse, for a live critical incident (prototypes)
 * The pulse is motion-safe, so it's a static dot under prefers-reduced-motion.
 */
type Tone = "live" | "ok" | "alert" | "idle" | "critical";

const dot: Record<Tone, string> = {
  live: "bg-signal-teal motion-safe:animate-status-pulse",
  ok: "bg-signal-teal",
  alert: "bg-signal-amber",
  idle: "bg-text-faint",
  critical: "bg-signal-red motion-safe:animate-status-pulse [--pulse-color:var(--signal-red)]",
};

export function StatusPill({ tone = "live", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs text-text-dim ${
        tone === "alert" ? "border-signal-amber" : tone === "critical" ? "border-signal-red" : "border-rule"
      } ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[tone]}`} />
      {children}
    </span>
  );
}

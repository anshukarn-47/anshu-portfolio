/**
 * Status colours for prototype canvases, mapped onto the Flight Deck signals
 * (no second palette): critical → red, warning → amber, stable → teal,
 * informational → blue.
 */
export type Status = "stable" | "warning" | "critical" | "info" | "inactive";

export const statusDot: Record<Status, string> = {
  stable: "bg-signal-teal",
  warning: "bg-signal-amber",
  critical: "bg-signal-red",
  info: "bg-signal-blue",
  inactive: "border border-text-faint bg-transparent",
};

export const statusText: Record<Status, string> = {
  stable: "text-signal-teal",
  warning: "text-signal-amber",
  critical: "text-signal-red",
  info: "text-signal-blue",
  inactive: "text-text-faint",
};

export const statusLabel: Record<Status, string> = {
  stable: "Stable",
  warning: "Warning",
  critical: "Critical",
  info: "Info",
  inactive: "Inactive",
};

/** A 6px status dot. Colour is never the only signal: pair it with a visible or sr-only label. */
export function dotClass(status: Status) {
  return `inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[status]}`;
}

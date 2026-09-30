/**
 * Formats a metric as "42%", "3.5x", "320+", "130M+" or "120 ms".
 * Symbol and magnitude units (%, x, +, K, M, B, optionally with +) attach
 * directly; word units get a space. Empty string when there's no value.
 */
export function formatMetric(value: number | null | undefined, unit?: string | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const n = new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
  if (!unit) return n;
  return /^(%|x|×|\+|[KMB]\+?)$/i.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
}

/** "2025-05-01" -> "May 2025". Parsed as UTC so the month never shifts with the server's time zone. */
export function formatMonthYear(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

/** True when a YYYY-MM-DD date is before today (UTC). */
export function isPastDate(date: string | null | undefined): boolean {
  if (!date) return false;
  return date < new Date().toISOString().slice(0, 10);
}

/**
 * True for a site path ("/images/me.jpg") or an http(s) URL. Anything else, such as
 * an icon name, a protocol-relative "//host" or a "javascript:" URL, is rejected.
 */
export function isSafeSrc(src: string | null | undefined): src is string {
  return !!src && ((src.startsWith("/") && !src.startsWith("//")) || /^https?:\/\//.test(src));
}

/** "AI / ML" -> "ai-ml", for in-page anchors. */
export function toAnchor(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

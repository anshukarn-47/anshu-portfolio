import "server-only";

/**
 * In-memory burst limiting for the AI endpoints, in front of the database-backed
 * hourly and daily caps in lib/rag/limits.ts. Those count logged questions, so
 * on their own they can't stop a burst of parallel requests that all pass the
 * check before any is logged; this can.
 *
 * State is per server instance (each serverless instance keeps its own), which
 * is enough to blunt bursts at this site's traffic; the database caps remain the
 * hard limit across instances.
 */

const windows = new Map<string, number[]>();
const running = new Map<string, number>();

export type BurstResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Allows at most `limit` requests per `windowMs` for this key (sliding window). */
export function burstLimit(key: string, limit: number, windowMs: number): BurstResult {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    windows.set(key, hits);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000)) };
  }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 10_000) {
    // Drop keys with no recent hits so memory stays bounded.
    windows.forEach((v, k) => {
      if (!v.some((t) => now - t < windowMs)) windows.delete(k);
    });
  }
  return { ok: true };
}

/**
 * Caps concurrent work per key (e.g. one Career Agent run per visitor at a time).
 * Returns a release function, or null when the key is already at the cap.
 */
export function acquireSlot(key: string, max = 1): (() => void) | null {
  const n = running.get(key) ?? 0;
  if (n >= max) return null;
  running.set(key, n + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (running.get(key) ?? 1) - 1;
    if (left > 0) running.set(key, left);
    else running.delete(key);
  };
}

export const TOO_FAST = "You're sending requests too quickly. Please wait a moment and try again.";

export function tooManyRequests(message: string, retryAfterSeconds: number, body: (m: string) => unknown = (m) => ({ type: "error", message: m })) {
  return Response.json(body(message), { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
}

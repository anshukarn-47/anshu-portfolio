/** Events the tracker may send, shared by the client tracker and /api/track. */
export const TRACKED_EVENTS = ["pageview", "resume_download", "outbound_click"] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export type TrackPayload = {
  name: TrackedEvent;
  path: string;
  referrer?: string | null;
  /** e.g. the destination of an outbound link. */
  target?: string | null;
};

/** Paths never tracked: the admin area and API routes. */
export const isUntrackedPath = (path: string) => /^\/(admin|api)(\/|$)/.test(path);

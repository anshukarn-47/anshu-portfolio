/**
 * Wire format for /api/chat: newline-delimited JSON events, shared by the
 * route handler and the chat UI.
 */
export type ChatSource = { title: string; url: string | null };

export type ChatEvent =
  | { type: "session"; sessionId: string }
  | { type: "sources"; sources: ChatSource[] }
  | { type: "text"; text: string }
  | { type: "done" }
  /** Dispatcher mode's answer: one consolidation candidate (by id) and the reasoning. */
  | { type: "proposal"; candidate: string; reasoning: string }
  /** kind "unavailable": the assistant failed (show AI_MESSAGES.unavailable with the case-studies link). */
  | { type: "error"; message: string; kind?: "unavailable" };

/** Earlier turns aren't sent: the server loads them from the session's own log. */
export type ChatRequest = {
  sessionId?: string | null;
  question: string;
};

/**
 * The same endpoint in reflection mode: a prototype's slug (its case study is
 * loaded server-side) and the visitor's written reasoning.
 */
export type ReflectionRequest = { reflection: { prototype: string; reasoning: string } };

/**
 * Dispatcher mode (Control tower's AI Dispatcher Copilot): the player's decisions
 * so far; the server rebuilds the shipment queue from them and validates every id.
 */
export type DispatcherRequest = { dispatcher: { prototype: string; state: unknown } };

export const LIMITS = {
  questionChars: 1000,
  reflectionChars: 1000,
  historyTurns: 8, // earlier messages loaded from the session log
  historyChars: 4000, // per earlier message
};

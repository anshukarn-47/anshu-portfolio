/**
 * Wire format for /api/agent: newline-delimited JSON events, shared by the
 * route handler and the Career Agent UI. Step events are sent as each step
 * actually starts and finishes on the server.
 */
import type { ChatSource } from "@/lib/rag/protocol";

export const AGENT_STEPS = [
  { id: "parse", label: "Parsed job description" },
  { id: "extract", label: "Extracted requirements" },
  { id: "search", label: "Searched portfolio" },
  { id: "map", label: "Mapped evidence" },
] as const;

export type AgentStepId = (typeof AGENT_STEPS)[number]["id"];

export type Requirement = { requirement: string; kind: "must" | "nice" };

export type AgentEvent =
  | { type: "step"; step: AgentStepId; status: "active" | "done" }
  | { type: "role"; title: string | null }
  | { type: "requirements"; requirements: Requirement[] }
  | { type: "text"; text: string }
  | { type: "sources"; sources: ChatSource[] }
  | { type: "done" }
  | { type: "error"; message: string };

export const AGENT_LIMITS = {
  minChars: 200,
  maxChars: 12000,
  maxRequirements: 10,
};

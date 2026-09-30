/**
 * Visitor-facing AI failure states, shared by the API routes and the UI so the
 * wording is identical wherever a failure surfaces.
 *
 * Input problems (a question that's too long, a rate limit, pasted text that
 * isn't a job description) keep their own specific messages: the visitor can
 * act on those, so they aren't failures of the assistant.
 */
export const AI_MESSAGES = {
  /** The assistant (RAG chat) failed or isn't available. Shown with a link to the case studies. */
  unavailable: "The AI assistant is temporarily unavailable.",
  /** Retrieval found no portfolio passages for the question: answered without calling the model. */
  noEvidence: "I couldn't find enough documented evidence to answer that question.",
  /** The career agent failed at any step. */
  agentFailed: "The analysis couldn't be completed. Please try again.",
} as const;

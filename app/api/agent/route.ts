import { createAdminClient } from "@/lib/supabase/admin";
import { AI_MESSAGES } from "@/lib/ai/messages";
import { aiLabConfigured, CHAT_MODEL } from "@/lib/rag/answer";
import { checkLimits, visitorId } from "@/lib/rag/limits";
import { retrieveMany, uniqueSources, type RetrievedChunk } from "@/lib/rag/retrieve";
import { extractRequirements, parseJobDescription, streamEvidenceMap } from "@/lib/agent/career-agent";
import { AGENT_LIMITS, type AgentEvent } from "@/lib/agent/protocol";
import { getProfile } from "@/lib/profile";
import { readJsonBody } from "@/lib/security/request";
import { TOO_FAST, acquireSlot, burstLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Chunks per requirement, and the most sent to Claude after merging. */
const PER_REQUIREMENT = 4;
const MAX_DOCUMENTS = 16;

/** A 12,000-character job description is at most ~48 KB of UTF-8, plus JSON escaping. */
const MAX_BODY_BYTES = 64 * 1024;
/** Each run is ~2 model calls and an embedding call: a few per ten minutes, one at a time, per visitor. */
const BURST = { limit: 3, windowMs: 10 * 60_000 };

const json = (status: number, message: string) =>
  Response.json({ type: "error", message } satisfies AgentEvent, { status });

/** An input problem the visitor can fix; the message is shown as is. Any other failure is AI_MESSAGES.agentFailed. */
class InputError extends Error {}

/**
 * Career Agent: job description in, evidence map out. Streams NDJSON events,
 * including a step event as each stage really starts and finishes, so the
 * page's checklist reflects actual progress.
 */
export async function POST(request: Request) {
  if (!aiLabConfigured()) return json(503, AI_MESSAGES.agentFailed);

  const visitor = visitorId(request.headers);
  const burst = burstLimit(`agent:${visitor}`, BURST.limit, BURST.windowMs);
  if (!burst.ok) return tooManyRequests(TOO_FAST, burst.retryAfterSeconds);

  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (!read.ok && read.tooLarge) return json(413, `Keep it under ${AGENT_LIMITS.maxChars.toLocaleString("en")} characters.`);
  const raw = read.ok ? (read.body as Record<string, unknown> | null)?.jobDescription : undefined;
  if (typeof raw !== "string" || !raw.trim()) return json(400, "Paste a job description.");
  if (raw.length > AGENT_LIMITS.maxChars) return json(400, `Keep it under ${AGENT_LIMITS.maxChars.toLocaleString("en")} characters.`);
  if (raw.trim().length < AGENT_LIMITS.minChars) {
    return json(400, `That's too short for a job description. Paste at least ${AGENT_LIMITS.minChars} characters.`);
  }

  // One run at a time per visitor; released when the stream ends (or on an early return below).
  const release = acquireSlot(`agent:${visitor}`);
  if (!release) return json(429, "An analysis is already running. Wait for it to finish, then try again.");

  const db = createAdminClient();

  // Shares the AI Lab's question budget: each run counts as one question.
  try {
    const limit = await checkLimits(visitor);
    if (!limit.ok) {
      release();
      return json(429, limit.message);
    }
  } catch (err) {
    release();
    console.error("[agent] limit check failed", err);
    return json(500, AI_MESSAGES.agentFailed);
  }

  const { data: session, error: sessionError } = await db
    .from("chat_sessions")
    .insert({ visitor_id: visitor, channel: "agent" })
    .select("id")
    .single();
  if (sessionError) {
    release();
    console.error("[agent] could not create session", sessionError);
    return json(500, AI_MESSAGES.agentFailed);
  }

  const encoder = new TextEncoder();
  const started = Date.now();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        // 1. Parse
        send({ type: "step", step: "parse", status: "active" });
        const jobDescription = parseJobDescription(raw as string);
        if (!jobDescription) throw new InputError("That's too short for a job description once formatting is removed.");
        const { error: logError } = await db
          .from("chat_messages")
          .insert({ session_id: session.id, role: "user", content: jobDescription });
        if (logError) console.error("[agent] could not log job description", logError);
        send({ type: "step", step: "parse", status: "done" });

        // 2. Extract
        send({ type: "step", step: "extract", status: "active" });
        const [extraction, profile] = await Promise.all([extractRequirements(jobDescription, signal), getProfile()]);
        if (!extraction.isJobDescription) {
          throw new InputError("That doesn't look like a job description. Paste a role's responsibilities and requirements.");
        }
        send({ type: "role", title: extraction.roleTitle });
        send({ type: "requirements", requirements: extraction.requirements });
        send({ type: "step", step: "extract", status: "done" });

        // 3. Search
        send({ type: "step", step: "search", status: "active" });
        const chunks = await retrieveMany(
          extraction.requirements.map((r) => r.requirement),
          PER_REQUIREMENT,
          MAX_DOCUMENTS,
          signal
        );
        send({ type: "step", step: "search", status: "done" });

        // 4. Map evidence (streamed)
        send({ type: "step", step: "map", status: "active" });
        const response = streamEvidenceMap({
          ownerName: profile?.full_name ?? "the portfolio owner",
          roleTitle: extraction.roleTitle,
          requirements: extraction.requirements,
          chunks,
          signal,
        });
        let report = "";
        const cited: RetrievedChunk[] = [];
        for await (const event of response) {
          if (event.type !== "content_block_delta") continue;
          if (event.delta.type === "text_delta") {
            report += event.delta.text;
            send({ type: "text", text: event.delta.text });
          } else if (event.delta.type === "citations_delta" && "document_index" in event.delta.citation) {
            const chunk = chunks[event.delta.citation.document_index];
            if (chunk && !cited.includes(chunk)) cited.push(chunk);
          }
        }
        const final = await response.finalMessage();
        if (final.stop_reason === "refusal" && !report.trim()) throw new Error("Evidence map refused");
        // Citation order follows the requirements, so a low cap would drop the last ones' pages.
        const sources = uniqueSources(cited).slice(0, 10);
        send({ type: "sources", sources });
        send({ type: "step", step: "map", status: "done" });
        send({ type: "done" });

        const { error } = await db.from("chat_messages").insert({
          session_id: session.id,
          role: "assistant",
          content: report,
          sources,
          tool_calls: { role_title: extraction.roleTitle, requirements: extraction.requirements },
          model: final.model ?? CHAT_MODEL,
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          latency_ms: Date.now() - started,
        });
        if (error) console.error("[agent] could not log report", error);
      } catch (err) {
        if (signal.aborted) return; // visitor stopped the run or left the page
        if (err instanceof InputError) {
          send({ type: "error", message: err.message });
        } else {
          console.error("[agent] failed", err);
          send({ type: "error", message: AI_MESSAGES.agentFailed });
        }
      } finally {
        release();
        try {
          controller.close();
        } catch {
          // already closed by an abort
        }
      }
    },
    cancel() {
      release(); // the visitor closed the connection before the stream finished
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

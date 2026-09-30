import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/admin/entities";
import { AI_MESSAGES } from "@/lib/ai/messages";
import { aiLabConfigured, CHAT_MODEL, DISPATCHER_MODEL, proposeConsolidation, streamAnswer, streamReflection, type ChatTurn } from "@/lib/rag/answer";
import { checkLimits, visitorId } from "@/lib/rag/limits";
import { retrieve, uniqueSources } from "@/lib/rag/retrieve";
import { LIMITS, type ChatEvent } from "@/lib/rag/protocol";
import { getProfile } from "@/lib/profile";
import { getPrototypeEntry } from "@/lib/prototypes/registry";
import { formatMetric } from "@/lib/format";
import { getWorkBySlug, type WorkDetail } from "@/lib/work";
import { readJsonBody } from "@/lib/security/request";
import { TOO_FAST, burstLimit, tooManyRequests } from "@/lib/security/rate-limit";
import { consolidation, dispatcherSnapshot, parseDispatcherState } from "@/components/prototypes/control-tower/strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Largest request body accepted (a question is at most 1,000 characters; this leaves room for JSON). */
const MAX_BODY_BYTES = 16 * 1024;
/** Burst limit per visitor, in front of the hourly and daily caps in lib/rag/limits.ts. */
const BURST = { limit: 6, windowMs: 60_000 };

/** An input problem the visitor can fix (validation, rate limit): shown as is. */
const json = (status: number, message: string) =>
  Response.json({ type: "error", message } satisfies ChatEvent, { status });

/** The assistant itself failed or isn't available. */
const unavailable = (status: number) =>
  Response.json({ type: "error", message: AI_MESSAGES.unavailable, kind: "unavailable" } satisfies ChatEvent, { status });

/**
 * What this endpoint answers, sharing limits, logging and the NDJSON stream:
 * Ask Anshu questions (retrieval + citations), prototype reflections (a
 * visitor's reasoning compared with a case study), and TOWER // 24's AI
 * Dispatcher (one consolidation proposal from the current game state).
 */
type Parsed =
  | { kind: "chat"; sessionId: string | null; question: string }
  | { kind: "reflection"; slug: string; reasoning: string; prototype: string }
  | { kind: "dispatcher"; prototype: string; snapshot: string; candidateIds: string[] };

/** The one prototype with an AI Dispatcher. */
const DISPATCHER_PROTOTYPE = "control-tower-24";

/** Validates and normalises the request body; returns an error message when invalid. */
function parseBody(body: unknown): Parsed | string {
  if (!body || typeof body !== "object") return "Invalid request.";
  const { sessionId, question, reflection, dispatcher } = body as Record<string, unknown>;

  if (dispatcher !== undefined) {
    const { prototype, state } = (dispatcher ?? {}) as Record<string, unknown>;
    if (prototype !== DISPATCHER_PROTOTYPE || !getPrototypeEntry(prototype)) return "Unknown prototype.";
    // Only the player's decisions come from the browser; the queue and candidates are rebuilt here.
    const game = parseDispatcherState(state);
    if (!game) return "Invalid game state.";
    const { candidates } = consolidation(game);
    if (!candidates.length) return "No consolidation opportunities in the queue right now.";
    return { kind: "dispatcher", prototype, snapshot: dispatcherSnapshot(game), candidateIds: candidates.map((c) => c.id) };
  }

  if (reflection !== undefined) {
    const { prototype, reasoning } = (reflection ?? {}) as Record<string, unknown>;
    const entry = typeof prototype === "string" ? getPrototypeEntry(prototype) : null;
    if (!entry?.relatedWorkSlug) return "Unknown prototype.";
    if (typeof reasoning !== "string" || !reasoning.trim()) return "Write what you would do differently first.";
    if (reasoning.length > LIMITS.reflectionChars) return `Keep it under ${LIMITS.reflectionChars} characters.`;
    return { kind: "reflection", slug: entry.relatedWorkSlug, reasoning: reasoning.trim(), prototype: entry.slug };
  }

  if (typeof question !== "string" || !question.trim()) return "Ask a question.";
  if (question.length > LIMITS.questionChars) return `Keep questions under ${LIMITS.questionChars} characters.`;
  if (sessionId !== undefined && sessionId !== null && (typeof sessionId !== "string" || !UUID_RE.test(sessionId))) {
    return "Invalid session.";
  }
  // Earlier turns are loaded from the session's own log on the server (see loadHistory), never taken
  // from the request, so a visitor can't put words in the assistant's mouth.
  return { kind: "chat", sessionId: (sessionId as string | null | undefined) ?? null, question: question.trim() };
}

/**
 * The conversation so far, from the logged messages of the visitor's own chat
 * session: the last LIMITS.historyTurns turns, starting with a user turn, with
 * consecutive same-role turns merged (a stopped answer leaves two user turns in a row).
 */
async function loadHistory(db: ReturnType<typeof createAdminClient>, sessionId: string): Promise<ChatTurn[]> {
  const { data, error } = await db
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(LIMITS.historyTurns);
  if (error) {
    console.error("[chat] could not load history", error);
    return [];
  }
  const turns: ChatTurn[] = [];
  for (const m of [...(data ?? [])].reverse()) {
    const role = m.role as ChatTurn["role"];
    const content = m.content.slice(0, LIMITS.historyChars);
    if (!content.trim()) continue;
    const last = turns.at(-1);
    if (last?.role === role) last.content += `\n\n${content}`;
    else turns.push({ role, content });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

/** The case study's documented facts, as plain text for the reflection prompt. */
function caseFacts(w: WorkDetail): string {
  const lines = [`Case study: ${w.title}`];
  if (w.problem) lines.push(`Situation: ${w.problem}`);
  if (w.users) lines.push(`Users: ${w.users}`);
  if (w.role) lines.push(`Role: ${w.role}${w.company ? `, ${w.company}` : ""}`);
  if (w.approach) lines.push(`Approach: ${w.approach}`);
  for (const d of w.decisions) {
    const parts = [d.title, d.choice && `Choice: ${d.choice}`, d.tradeoffs && `Trade-off: ${d.tradeoffs}`].filter(Boolean);
    if (parts.length) lines.push(`Decision: ${parts.join(". ")}`);
  }
  for (const m of w.metrics) {
    if (m.label) lines.push(`Metric: ${m.label}: ${formatMetric(m.value, m.unit)}${m.context ? ` (${m.context})` : ""}`);
  }
  if (w.outcome) lines.push(`Outcome: ${w.outcome}`);
  return lines.join("\n");
}

export async function POST(request: Request) {
  if (!aiLabConfigured()) return unavailable(503);

  const visitor = visitorId(request.headers);
  const burst = burstLimit(`chat:${visitor}`, BURST.limit, BURST.windowMs);
  if (!burst.ok) return tooManyRequests(TOO_FAST, burst.retryAfterSeconds);

  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (!read.ok) return json(read.tooLarge ? 413 : 400, read.tooLarge ? "That request is too large." : "Invalid request.");
  const parsed = parseBody(read.body);
  if (typeof parsed === "string") return json(400, parsed);
  const req = parsed;

  // Reflections need their case study; load it before anything is logged.
  let facts: string | null = null;
  if (req.kind === "reflection") {
    try {
      const work = await getWorkBySlug(req.slug);
      if (!work) return unavailable(503);
      facts = caseFacts(work);
    } catch (err) {
      console.error("[chat] could not load case study for reflection", err);
      return unavailable(500);
    }
  }

  const db = createAdminClient();

  try {
    const limit = await checkLimits(visitor);
    if (!limit.ok) return json(429, limit.message);
  } catch (err) {
    console.error("[chat] limit check failed", err);
    return unavailable(500);
  }

  // Reuse the visitor's own Ask Anshu session (not a reflection or dispatcher one), or start a new one.
  let sessionId: string | null = null;
  let history: ChatTurn[] = [];
  if (req.kind === "chat" && req.sessionId) {
    const { data } = await db
      .from("chat_sessions")
      .select("id, metadata")
      .eq("id", req.sessionId)
      .eq("visitor_id", visitor)
      .eq("channel", "rag")
      .maybeSingle();
    if (data && !(data.metadata as { kind?: string } | null)?.kind) {
      sessionId = data.id;
      history = await loadHistory(db, sessionId);
    }
  }
  if (!sessionId) {
    const { data, error } = await db
      .from("chat_sessions")
      .insert({
        visitor_id: visitor,
        channel: "rag",
        metadata: req.kind === "chat" ? {} : { kind: req.kind, prototype: req.prototype },
      })
      .select("id")
      .single();
    if (error) {
      console.error("[chat] could not create session", error);
      return unavailable(500);
    }
    sessionId = data.id;
  }

  const userText =
    req.kind === "chat"
      ? req.question
      : req.kind === "reflection"
        ? req.reasoning
        : `Dispatcher: propose a consolidation (candidates: ${req.candidateIds.join(", ")})`;
  const logUser = db.from("chat_messages").insert({ session_id: sessionId, role: "user", content: userText });

  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      send({ type: "session", sessionId: sessionId! });

      let answer = "";
      try {
        const [{ error: logError }, chunks, profile] = await Promise.all([
          logUser,
          req.kind === "chat" ? retrieve(req.question, request.signal) : Promise.resolve([]),
          getProfile(),
        ]);
        if (logError) console.error("[chat] could not log question", logError);
        const ownerName = profile?.full_name ?? "the portfolio owner";

        // Dispatcher: one structured proposal, not a stream of prose.
        if (req.kind === "dispatcher") {
          const message = await proposeConsolidation({ snapshot: req.snapshot, candidateIds: req.candidateIds, signal: request.signal });
          const text = message.content.find((b) => b.type === "text")?.text ?? "";
          let proposal: { candidate?: unknown; reasoning?: unknown } = {};
          try {
            proposal = JSON.parse(text);
          } catch {
            // handled below
          }
          const { candidate, reasoning } = proposal;
          if (typeof candidate !== "string" || !req.candidateIds.includes(candidate) || typeof reasoning !== "string" || !reasoning.trim()) {
            console.error("[chat] dispatcher returned an invalid proposal", message.stop_reason, text.slice(0, 200));
            send({ type: "error", message: AI_MESSAGES.unavailable, kind: "unavailable" });
            return;
          }
          answer = reasoning.trim().slice(0, 400);
          send({ type: "proposal", candidate, reasoning: answer });
          send({ type: "done" });
          const { error } = await db.from("chat_messages").insert({
            session_id: sessionId!,
            role: "assistant",
            content: `${candidate}: ${answer}`,
            model: message.model ?? DISPATCHER_MODEL,
            input_tokens: message.usage.input_tokens,
            output_tokens: message.usage.output_tokens,
            latency_ms: Date.now() - started,
          });
          if (error) console.error("[chat] could not log proposal", error);
          return;
        }

        // Nothing in the portfolio matched: say so plainly rather than let the model answer without evidence.
        if (req.kind === "chat" && !chunks.length) {
          answer = AI_MESSAGES.noEvidence;
          send({ type: "text", text: answer });
          send({ type: "sources", sources: [] });
          send({ type: "done" });
          const { error } = await db.from("chat_messages").insert({
            session_id: sessionId!,
            role: "assistant",
            content: answer,
            latency_ms: Date.now() - started,
          });
          if (error) console.error("[chat] could not log answer", error);
          return;
        }

        const response =
          req.kind === "chat"
            ? streamAnswer({ ownerName, history, question: req.question, chunks, signal: request.signal })
            : streamReflection({ ownerName, facts: facts!, reasoning: req.reasoning, signal: request.signal });

        // Sources are the documents Claude actually cited, in citation order (chat only).
        const cited: typeof chunks = [];
        for await (const event of response) {
          if (event.type !== "content_block_delta") continue;
          if (event.delta.type === "text_delta") {
            answer += event.delta.text;
            send({ type: "text", text: event.delta.text });
          } else if (event.delta.type === "citations_delta" && "document_index" in event.delta.citation) {
            const chunk = chunks[event.delta.citation.document_index];
            if (chunk && !cited.includes(chunk)) cited.push(chunk);
          }
        }
        const final = await response.finalMessage();

        if (final.stop_reason === "refusal" && !answer.trim()) {
          answer =
            req.kind === "chat"
              ? "Sorry, I can't help with that. Try asking about the work, skills or projects on this site."
              : "Sorry, I can't analyse that. Try describing what you would protect or pause, and why.";
          send({ type: "text", text: answer });
        }
        const sources = uniqueSources(cited).slice(0, 4);
        send({ type: "sources", sources });
        send({ type: "done" });

        const { error } = await db.from("chat_messages").insert({
          session_id: sessionId!,
          role: "assistant",
          content: answer,
          sources,
          model: final.model ?? CHAT_MODEL,
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          latency_ms: Date.now() - started,
        });
        if (error) console.error("[chat] could not log answer", error);
      } catch (err) {
        if (request.signal.aborted) return; // visitor closed the page or stopped the answer
        console.error("[chat] failed", err);
        send({ type: "error", message: AI_MESSAGES.unavailable, kind: "unavailable" });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by an abort
        }
      }
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

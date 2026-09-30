"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Markdown } from "@/components/ui/markdown";
import { AnswerSkeleton } from "@/components/ui/answer-skeleton";
import { ExploreCaseStudies } from "@/components/rag/explore-case-studies";
import { AI_MESSAGES } from "@/lib/ai/messages";
import { LIMITS, type ChatEvent, type ChatRequest, type ChatSource } from "@/lib/rag/protocol";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
  /** The assistant failed: shows AI_MESSAGES.unavailable with a link to the case studies. */
  unavailable?: boolean;
};

/** An input problem reported by the API (validation, rate limit), shown as is. */
class InputError extends Error {}

/**
 * The answer renders token by token as it streams from /api/chat (the real
 * stream, not a typewriter effect). With prefers-reduced-motion, tokens are
 * buffered and the complete answer appears at once.
 */
export function Chat({ suggestions }: { suggestions: string[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const reduceMotion = useReducedMotion();
  const sessionId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => () => abort.current?.abort(), []);

  const updateLast = (fn: (m: Message) => Message) =>
    setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    // Earlier turns aren't sent: the server loads the conversation from this session's own log.
    setMessages((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, question: q } satisfies ChatRequest),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as ChatEvent | null;
        if (body?.type === "error" && !body.kind) throw new InputError(body.message);
        throw new Error("unavailable");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let held = ""; // reduced motion: tokens held until the answer is complete
      let completed = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ChatEvent;
          if (event.type === "session") sessionId.current = event.sessionId;
          else if (event.type === "sources") updateLast((m) => ({ ...m, sources: event.sources }));
          else if (event.type === "text") {
            if (reduceMotion) held += event.text;
            else updateLast((m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === "done") completed = true;
          else if (event.type === "error") throw event.kind ? new Error("unavailable") : new InputError(event.message);
        }
      }
      // A stream cut off before "done" (dropped connection, server crash) means the assistant failed.
      if (!completed) throw new Error("unavailable");
      if (held) updateLast((m) => ({ ...m, content: m.content + held }));
    } catch (err) {
      if (controller.signal.aborted) {
        updateLast((m) => (m.content ? m : { ...m, content: "Stopped.", error: true }));
      } else if (err instanceof InputError) {
        updateLast((m) => ({ ...m, content: err.message, error: true, sources: undefined }));
      } else {
        // Anything else (server failure, network error, broken stream): the assistant is unavailable.
        updateLast((m) => ({ ...m, content: AI_MESSAGES.unavailable, error: true, unavailable: true, sources: undefined }));
      }
    } finally {
      setBusy(false);
      abort.current = null;
      inputRef.current?.focus();
    }
  }

  return (
    <div className="mt-8 flex flex-col rounded-lg border border-rule bg-panel">
      <div role="log" aria-live="polite" aria-label="Conversation" className="min-h-[18rem] space-y-6 p-4 sm:p-6">
        {messages.length === 0 ? (
          <div>
            <p className="text-sm text-text-faint">Try asking</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => ask(s)}
                    className="rounded-md border border-rule px-3 py-1.5 text-left text-sm text-text-dim transition-colors hover:bg-panel-2 hover:text-text"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            return m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-panel-2 px-4 py-2 text-sm text-text">{m.content}</p>
              </div>
            ) : (
              <div key={i} className="max-w-full">
                {m.error ? (
                  <div role="alert" className="rounded-md border border-signal-amber px-3 py-2 text-sm text-text">
                    <p>{m.content}</p>
                    {m.unavailable && <ExploreCaseStudies />}
                  </div>
                ) : m.content ? (
                  <Markdown className="prose-sm">{m.content}</Markdown>
                ) : (
                  isLast && busy && <AnswerSkeleton label="Searching the portfolio…" />
                )}
                {!!m.sources?.length && !m.error && m.content && (!busy || !isLast) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-text-faint">Sources</span>
                    {m.sources.map((s) =>
                      s.url ? (
                        <Link
                          key={s.url}
                          href={s.url}
                          className="rounded-md border border-rule px-2 py-0.5 text-text-dim transition-colors hover:text-text"
                        >
                          {s.title}
                        </Link>
                      ) : (
                        <span key={s.title} className="rounded-md border border-rule px-2 py-0.5 text-text-dim">
                          {s.title}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-end gap-2 border-t border-rule p-3"
      >
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          rows={1}
          value={input}
          maxLength={LIMITS.questionChars}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder="Ask about projects, skills or experience…"
          className="max-h-40 min-h-[2.5rem] flex-1 resize-y rounded-md border border-rule bg-ink px-3 py-2 text-sm text-text placeholder:text-text-faint"
        />
        {/* Distinct keys: if React reused one element, Stop would turn back into a submit
            button before the click's default action and immediately resend. */}
        {busy ? (
          <button
            key="stop"
            type="button"
            onClick={() => abort.current?.abort()}
            className="h-10 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2"
          >
            Stop
          </button>
        ) : (
          <button
            key="submit"
            type="submit"
            disabled={!input.trim()}
            className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        )}
      </form>
    </div>
  );
}

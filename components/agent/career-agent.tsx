"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Markdown } from "@/components/ui/markdown";
import { AnswerSkeleton } from "@/components/ui/answer-skeleton";
import { AGENT_LIMITS, AGENT_STEPS, type AgentEvent, type AgentStepId, type Requirement } from "@/lib/agent/protocol";
import type { ChatSource } from "@/lib/rag/protocol";
import { AI_MESSAGES } from "@/lib/ai/messages";

type StepState = "pending" | "active" | "done" | "failed";

/** An error message from /api/agent, already worded for visitors. */
class ServerMessage extends Error {}

type Run = {
  steps: Record<AgentStepId, StepState>;
  roleTitle: string | null;
  requirements: Requirement[];
  report: string;
  sources: ChatSource[];
  error: string | null;
};

const freshRun = (): Run => ({
  steps: { parse: "pending", extract: "pending", search: "pending", map: "pending" },
  roleTitle: null,
  requirements: [],
  report: "",
  sources: [],
  error: null,
});

const SAMPLE = `Senior Business Analyst, Digital Transformation

We're looking for a Senior Business Analyst to lead requirements for enterprise platform rollouts.

Responsibilities
- Gather and document business requirements with stakeholders across business and IT
- Translate requirements into user stories and acceptance criteria for agile delivery teams
- Analyse data to identify process improvements and measure outcomes

Requirements
- 5+ years as a business analyst on ERP or CRM implementations (SAP preferred)
- Strong stakeholder management and communication skills
- Experience with SQL and data analysis

Nice to have
- Exposure to generative AI or automation (RPA) projects
- Agile certification`;

/**
 * Job description in, evidence map out. The checklist is driven only by step
 * events from /api/agent, sent as each stage really finishes server-side.
 * With prefers-reduced-motion: checks appear without animation, and the
 * report is shown whole once complete instead of streaming.
 */
export function CareerAgent() {
  const [input, setInput] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const reduceMotion = useReducedMotion();
  const abort = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const update = (fn: (r: Run) => Run) => setRun((r) => (r ? fn(r) : r));
  const setStep = (step: AgentStepId, state: StepState) => update((r) => ({ ...r, steps: { ...r.steps, [step]: state } }));

  async function analyse() {
    const text = input.trim();
    if (!text || busy) return;
    setRun(freshRun());
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }));

    const fail = (message: string) =>
      update((r) => ({
        ...r,
        error: message,
        steps: Object.fromEntries(
          Object.entries(r.steps).map(([k, v]) => [k, v === "active" ? "failed" : v])
        ) as Run["steps"],
      }));

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as AgentEvent | null;
        throw body?.type === "error" ? new ServerMessage(body.message) : new Error("Agent request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let held = ""; // reduced motion: report held until complete
      let completed = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AgentEvent;
          if (event.type === "step") setStep(event.step, event.status);
          else if (event.type === "role") update((r) => ({ ...r, roleTitle: event.title }));
          else if (event.type === "requirements") update((r) => ({ ...r, requirements: event.requirements }));
          else if (event.type === "sources") update((r) => ({ ...r, sources: event.sources }));
          else if (event.type === "text") {
            if (reduceMotion) held += event.text;
            else update((r) => ({ ...r, report: r.report + event.text }));
          } else if (event.type === "done") completed = true;
          else if (event.type === "error") throw new ServerMessage(event.message);
        }
      }
      // A stream cut off before "done" (dropped connection, server crash) is a failed analysis.
      if (!completed) throw new Error("Agent stream ended early");
      if (held) update((r) => ({ ...r, report: r.report + held }));
    } catch (err) {
      // Server messages are already visitor-facing; anything else (network, broken stream) is a failed analysis.
      fail(controller.signal.aborted ? "Stopped." : err instanceof ServerMessage ? err.message : AI_MESSAGES.agentFailed);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  const tooShort = input.trim().length < AGENT_LIMITS.minChars;
  const mapping = run?.steps.map === "active";

  return (
    <div className="mt-8 space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          analyse();
        }}
        className="rounded-lg border border-rule bg-panel p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="job-description" className="text-sm font-medium text-text">
            Job description
          </label>
          <button
            type="button"
            onClick={() => setInput(SAMPLE)}
            disabled={busy}
            className="rounded-md text-sm text-text-dim hover:text-text disabled:opacity-40"
          >
            Use a sample
          </button>
        </div>
        <textarea
          id="job-description"
          value={input}
          maxLength={AGENT_LIMITS.maxChars}
          onChange={(e) => setInput(e.target.value)}
          readOnly={busy}
          rows={10}
          aria-describedby="job-description-hint"
          placeholder="Paste the role's responsibilities and requirements…"
          className="mt-2 w-full resize-y rounded-md border border-rule bg-ink px-3 py-2 text-sm text-text placeholder:text-text-faint"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p id="job-description-hint" className="text-xs text-text-faint">
            <span className="font-mono tabular-nums">
              {input.length.toLocaleString("en")} / {AGENT_LIMITS.maxChars.toLocaleString("en")}
            </span>{" "}
            characters{tooShort && input.trim() ? `, at least ${AGENT_LIMITS.minChars} needed` : ""}
          </p>
          {/* Distinct keys: if React reused one element, Stop would turn back into a submit
              button before the click's default action and immediately start a new run. */}
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
              disabled={tooShort}
              className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Map to portfolio
            </button>
          )}
        </div>
      </form>

      {run && (
        <div ref={resultRef} className="grid scroll-mt-24 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="space-y-6">
            <Checklist steps={run.steps} />
            {run.requirements.length > 0 && <Requirements title={run.roleTitle} requirements={run.requirements} />}
          </aside>

          <section aria-labelledby="evidence-title" className="min-w-0 rounded-lg border border-rule bg-panel p-4 sm:p-6">
            <h2 id="evidence-title" className="text-xl">
              Evidence map
            </h2>
            <div className="mt-4" aria-live="polite" aria-busy={busy}>
              {run.report ? (
                <Markdown className="prose-sm">{run.report}</Markdown>
              ) : mapping ? (
                <AnswerSkeleton label="Mapping evidence…" />
              ) : !run.error ? (
                <p className="text-sm text-text-faint">The report appears here once the portfolio has been searched.</p>
              ) : null}
              {run.error && (
                <p role="alert" className={`rounded-md border border-signal-amber px-3 py-2 text-sm text-text ${run.report ? "mt-4" : ""}`}>
                  {run.error}
                </p>
              )}
            </div>
            {run.sources.length > 0 && !busy && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-rule pt-4 text-xs">
                <span className="text-text-faint">Sources</span>
                {run.sources.map((s) =>
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
          </section>
        </div>
      )}
    </div>
  );
}

function Checklist({ steps }: { steps: Run["steps"] }) {
  const done = AGENT_STEPS.filter((s) => steps[s.id] === "done");
  const latest = done[done.length - 1];
  return (
    <div>
      <h2 className="text-sm font-medium text-text">Agent activity</h2>
      <ol className="mt-3 space-y-2.5">
        {AGENT_STEPS.map((s) => {
          const state = steps[s.id];
          return (
            <li key={s.id} className="flex items-center gap-2.5 text-sm">
              <StepIcon state={state} />
              <span className={state === "done" ? "text-text" : state === "active" ? "text-text" : "text-text-faint"}>
                {s.label}
              </span>
              <span className="sr-only">
                {state === "done" ? "(done)" : state === "active" ? "(in progress)" : state === "failed" ? "(failed)" : "(waiting)"}
              </span>
            </li>
          );
        })}
      </ol>
      {/* Announce each completed step once, as it happens. */}
      <p className="sr-only" role="status">
        {latest ? `${latest.label}.` : ""}
      </p>
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  return (
    <span aria-hidden className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <AnimatePresence initial={false} mode="wait">
        {state === "done" ? (
          <motion.svg
            key="done"
            viewBox="0 0 16 16"
            className="h-4 w-4 text-signal-teal"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <circle cx="8" cy="8" r="7" strokeWidth="1.25" />
            <motion.path
              d="M4.75 8.25 7 10.5l4.25-4.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.22, delay: 0.05, ease: [0.2, 0, 0, 1] }}
            />
          </motion.svg>
        ) : state === "failed" ? (
          <svg key="failed" viewBox="0 0 16 16" className="h-4 w-4 text-signal-red" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="7" strokeWidth="1.25" />
            <path d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5" strokeLinecap="round" />
          </svg>
        ) : state === "active" ? (
          <span key="active" className="flex h-4 w-4 items-center justify-center rounded-full border border-signal-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-teal motion-safe:animate-status-pulse" />
          </span>
        ) : (
          <span key="pending" className="h-4 w-4 rounded-full border border-rule" />
        )}
      </AnimatePresence>
    </span>
  );
}

function Requirements({ title, requirements }: { title: string | null; requirements: Requirement[] }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-text">Requirements found</h2>
      {title && <p className="mt-1 text-xs text-text-faint">{title}</p>}
      <ul className="mt-3 space-y-2">
        {requirements.map((r) => (
          <li key={r.requirement} className="text-sm text-text-dim">
            {r.requirement}
            {r.kind === "nice" && <span className="ml-1.5 text-xs text-text-faint">nice to have</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

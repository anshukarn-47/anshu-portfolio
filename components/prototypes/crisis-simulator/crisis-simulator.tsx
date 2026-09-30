"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import type { CanvasProps } from "@/components/prototypes/canvases";
import { AnswerSkeleton } from "@/components/ui/answer-skeleton";
import { streamChat } from "@/lib/rag/client";
import { LIMITS } from "@/lib/rag/protocol";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { StatusPill } from "@/components/ui/status-pill";
import { dotClass, statusLabel, statusText, type Status } from "@/components/prototypes/engine/status";
import {
  BASELINE_TRAFFIC,
  CAPACITY,
  CAPACITY_TOTAL,
  DATA_REQUEST_SECONDS,
  ROUND_TIME_SECONDS,
  anyCritical,
  timeLeft,
  QUESTIONS,
  QUESTION_SLOTS,
  UNKNOWN_LABELS,
  bookingSuccessRate,
  unknownValue,
  type QuestionId,
  type UnknownSignal,
  DECISIONS,
  DECK_ACTIONS,
  deckPreview,
  targetLabel,
  type DeckAction,
  type DeckTarget,
  FUNCTION_DISPLAY,
  FUNCTION_LABELS,
  HEALTH_LABELS,
  INITIAL_STATE,
  METERS,
  NORTH_STAR,
  PRODUCT_PRINCIPLE,
  COMMS,
  QUALITY_LABELS,
  type CommsOptionId,
  type QualityKey,
  type QualityLevel,
  comparePaths,
  STAKEHOLDER_DISPLAY,
  STAKEHOLDER_LABELS,
  formatClock,
  healthStatus,
  reducer,
  severity,
  type CrisisState,
  type FunctionKey,
  type HealthKey,
  type MeterKey,
  type StakeholderKey,
} from "./model";

const nf = new Intl.NumberFormat("en");
const NO_RUSH_KEY = "crisis-simulator:no-rush";

const barFill: Record<Status, string> = {
  stable: "bg-signal-teal",
  warning: "bg-signal-amber",
  critical: "bg-signal-red",
  info: "bg-signal-blue",
  inactive: "bg-text-faint",
};

/**
 * Crisis simulator canvas: an opening briefing, the war room (calls arrive in
 * the decision queue; every choice moves the dashboard), then a debrief. All
 * logic lives in the reducer in ./model.ts.
 */
export function CrisisSimulator({ caseStudy, onComplete }: CanvasProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Reaching the end unlocks the viewer's case study and lens trade-offs.
  useEffect(() => {
    if (state.phase === "debrief") onComplete();
  }, [state.phase, onComplete]);

  // "No rush" is remembered for the visit (sessionStorage; storage can be unavailable, so it's best-effort).
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(NO_RUSH_KEY) === "1") dispatch({ type: "setNoRush", noRush: true });
    } catch {
      // private mode or blocked storage: the toggle still works for this page
    }
  }, []);
  const setNoRush = (noRush: boolean) => {
    dispatch({ type: "setNoRush", noRush });
    try {
      window.sessionStorage.setItem(NO_RUSH_KEY, noRush ? "1" : "0");
    } catch {
      // ignore
    }
  };

  // One clock drives everything while the war room is open.
  useEffect(() => {
    if (state.phase !== "war-room") return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(id);
  }, [state.phase]);

  if (state.phase === "briefing") return <Briefing onEnter={() => dispatch({ type: "enter" })} />;
  if (state.phase === "debrief") return <EndScreen state={state} caseStudy={caseStudy} onRestart={() => dispatch({ type: "reset" })} />;
  return (
    <WarRoom
      key={state.run}
      state={state}
      onChoose={(optionId) => dispatch({ type: "choose", optionId })}
      onAct={(action, target) => dispatch({ type: "act", action, target })}
      onDismiss={() => dispatch({ type: "dismiss" })}
      onRespondComms={(optionId) => dispatch({ type: "respondComms", optionId })}
      onRequestData={(signal) => dispatch({ type: "requestData", signal })}
      onAsk={(question) => dispatch({ type: "ask", question })}
      onDraft={(draft) => dispatch({ type: "draft", draft })}
      onNoRush={setNoRush}
    />
  );
}

// --- Opening screen ------------------------------------------------------------

function Briefing({ onEnter }: { onEnter: () => void }) {
  return (
    <section aria-labelledby="crisis-briefing-title" className="flex min-h-[36rem] flex-col items-center justify-center px-6 py-16 text-center">
      <StatusPill tone="critical">Live incident</StatusPill>
      <h2 id="crisis-briefing-title" className="mt-5 text-3xl sm:text-4xl">
        Platform operations war room
      </h2>
      <p className="mt-3 max-w-md text-text-dim">
        A sudden 4–5x demand surge just hit, with no warning. Every system is under load. You&apos;ll make three decisions,
        each against the clock.
      </p>

      <dl className="mt-10 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        <Surge label="IVRS" from={10_000} to={40_000} unit="req/sec" />
        <Surge label="Mobile / portal" from={3_000} to={18_000} unit="req/sec" />
        <div className="rounded-lg border border-rule bg-panel px-4 py-3 text-left">
          <dt className="text-xs text-text-faint">Users at risk</dt>
          <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-text">130M+</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onEnter}
        className="mt-10 h-11 rounded-md bg-text px-6 text-sm font-medium text-ink transition-opacity hover:opacity-90"
      >
        Enter war room
      </button>
    </section>
  );
}

function Surge({ label, from, to, unit }: { label: string; from: number; to: number; unit: string }) {
  const k = (n: number) => `${n / 1000}K`;
  return (
    <div className="rounded-lg border border-rule bg-panel px-4 py-3 text-left">
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className="mt-1 font-mono tabular-nums text-text">
        <span className="text-text-dim">{k(from)}</span>
        <span aria-hidden className="mx-1.5 text-text-faint">
          →
        </span>
        <span className="sr-only"> to </span>
        <span className="text-2xl font-medium">{k(to)}</span>
        <span className="ml-1 text-xs text-text-faint">{unit}</span>
      </dd>
    </div>
  );
}

// --- War room --------------------------------------------------------------------

const SEVERITY = {
  critical: { tone: "critical", label: "Incident: critical" },
  stabilising: { tone: "alert", label: "Incident: stabilising" },
  resolved: { tone: "ok", label: "Incident: resolved" },
} as const;

function WarRoom({
  state,
  onChoose,
  onAct,
  onDismiss,
  onRespondComms,
  onRequestData,
  onAsk,
  onDraft,
  onNoRush,
}: {
  state: CrisisState;
  onChoose: (optionId: string) => void;
  onAct: (action: DeckAction, target: DeckTarget) => void;
  onDismiss: () => void;
  onRespondComms: (id: CommsOptionId) => void;
  onRequestData: (signal: UnknownSignal) => void;
  onAsk: (question: QuestionId) => void;
  onDraft: (draft: CrisisState["draft"]) => void;
  onNoRush: (on: boolean) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const sev = SEVERITY[severity(state)];
  const lastLog = state.log.at(-1);

  // Decision Deck (event rounds). The action/target selection lives in simulator
  // state (draft), so it's applied if time runs out.
  const [deckOpen, setDeckOpen] = useState(false);
  const deckAction = state.draft.action ?? null;
  const deckTarget = state.draft.target ?? null;
  const eventPending = state.pendingSince !== null && DECISIONS[state.decisionIndex]?.kind === "event";
  const respondRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // A new round (or a resolved one) closes the deck.
    setDeckOpen(false);
  }, [state.decisionIndex]);
  const highlight = deckOpen ? deckTarget : null;

  return (
    <section aria-labelledby="war-room-title" className="p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <h2 id="war-room-title" ref={headingRef} tabIndex={-1} className="text-xl">
          War room
        </h2>
        <div className="flex items-center gap-3">
          <StatusPill tone={sev.tone}>{sev.label}</StatusPill>
          <span className="font-mono text-sm tabular-nums text-text-dim">
            <span className="sr-only">Elapsed time: </span>T+ {formatClock(state.seconds)}
          </span>
        </div>
      </header>

      {/* Screen readers hear each new call and each consequence as it happens. */}
      <p className="sr-only" role="status" aria-live="polite">
        {lastLog?.text}
      </p>

      {deckOpen && eventPending && (
        <DecisionDeck
          state={state}
          action={deckAction}
          target={deckTarget}
          onAction={(a) => onDraft({ action: a, target: deckTarget ?? undefined })}
          onTarget={(t) => onDraft({ action: deckAction ?? undefined, target: t })}
          onCancel={() => onDraft({})}
          onClose={() => {
            setDeckOpen(false);
            onDraft({});
            requestAnimationFrame(() => respondRef.current?.focus());
          }}
          onConfirm={() => deckAction && deckTarget && onAct(deckAction, deckTarget)}
        />
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Quadrant title="System health">
              <ul className="space-y-3">
                {(Object.keys(HEALTH_LABELS) as HealthKey[]).map((k) =>
                  k === "db" && !state.revealed.includes("dbSaturation") ? (
                    <UnknownBar key={k} label={HEALTH_LABELS[k]} />
                  ) : (
                    <HealthBar key={k} label={HEALTH_LABELS[k]} value={state.health[k]} />
                  )
                )}
              </ul>
            </Quadrant>

            <Quadrant title="Traffic">
              <dl className="space-y-3">
                <Traffic label="IVRS" value={state.traffic.ivrs} baseline={BASELINE_TRAFFIC.ivrs} highlighted={highlight === "ivrs"} />
                <Traffic label="Mobile / portal" value={state.traffic.mobile} baseline={BASELINE_TRAFFIC.mobile} highlighted={highlight === "mobile"} />
              </dl>
            </Quadrant>

            <Quadrant title="Customer functions">
              <ul className="space-y-2">
                {(Object.keys(FUNCTION_LABELS) as FunctionKey[]).map((k) => {
                  const d = FUNCTION_DISPLAY[state.functions[k]];
                  return (
                    <StatusRow
                      key={k}
                      label={FUNCTION_LABELS[k]}
                      status={d.status}
                      text={state.locked.includes(k) ? `${d.text} · locked` : d.text}
                      highlighted={highlight === k}
                    />
                  );
                })}
              </ul>
            </Quadrant>

            <Quadrant title="Stakeholders">
              <ul className="space-y-2">
                {(Object.keys(STAKEHOLDER_LABELS) as StakeholderKey[]).map((k) => {
                  const first = state.interruptions[0];
                  const calling = first?.who === k && !(first.kind === "comms" && state.commsChoice);
                  const d = STAKEHOLDER_DISPLAY[state.stakeholders[k]];
                  return (
                    <StatusRow
                      key={k}
                      label={STAKEHOLDER_LABELS[k]}
                      status={calling ? "info" : d.status}
                      text={calling ? "Calling" : d.text}
                      pulse={calling}
                    />
                  );
                })}
              </ul>
              {state.phase === "war-room" &&
                state.interruptions[0] &&
                (state.interruptions[0].kind === "comms" ? (
                  <CommsCard
                    question={state.interruptions[0].message}
                    choice={state.commsChoice}
                    queued={state.interruptions.length - 1}
                    onRespond={onRespondComms}
                    onDone={onDismiss}
                  />
                ) : (
                  <Interruption
                    key={state.interruptionsFired - state.interruptions.filter((i) => !i.kind).length}
                    who={state.interruptions[0].who}
                    message={state.interruptions[0].message}
                    queued={state.interruptions.length - 1}
                    onDismiss={onDismiss}
                  />
                ))}
            </Quadrant>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SignalsPanel state={state} onRequest={onRequestData} />
            <AskEngineering state={state} onAsk={onAsk} />
          </div>

          <CapacityPanel capacity={state.capacity} />
          <IncidentLog log={state.log} />
        </div>

        <div className="space-y-4">
          <Mission meters={state.meters} />
          {state.phase === "war-room" && (
            <DecisionQueue
              state={state}
              onChoose={onChoose}
              onDraft={onDraft}
              onNoRush={onNoRush}
              deckOpen={deckOpen}
              onRespond={() => setDeckOpen(true)}
              respondRef={respondRef}
            />
          )}
          <DecisionLog entries={state.decisionLog} />
        </div>
      </div>
    </section>
  );
}

function DecisionQueue({
  state,
  onChoose,
  onDraft,
  onNoRush,
  deckOpen,
  onRespond,
  respondRef,
}: {
  state: CrisisState;
  onChoose: (optionId: string) => void;
  onDraft: (draft: CrisisState["draft"]) => void;
  onNoRush: (on: boolean) => void;
  deckOpen: boolean;
  onRespond: () => void;
  respondRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const decision = state.pendingSince !== null ? DECISIONS[state.decisionIndex] : null;
  const pressure = !!decision && !state.noRush && timeLeft(state) <= 15;
  const applied = !decision ? state.lastApplied : null;
  const roundNumber = Math.min(state.decisionIndex + (decision ? 1 : 0), DECISIONS.length);

  return (
    <section
      aria-labelledby="decision-queue-title"
      className={`rounded-lg border p-4 ${
        decision ? (pressure ? "border-signal-amber bg-panel" : "border-signal-blue bg-panel") : applied ? "border-rule bg-panel" : "border-dashed border-rule"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="decision-queue-title" className="text-sm font-medium text-text">
          Decision queue
        </h3>
        <span className="font-mono text-xs tabular-nums text-text-faint">
          {roundNumber > 0 ? `Round ${roundNumber} of ${DECISIONS.length}` : `${DECISIONS.length} rounds`}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {decision ? (
          <motion.div
            key={decision.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <RoundTimer state={state} onNoRush={onNoRush} />
            {decision.kind === "event" ? (
              <SignalAlert state={state} deckOpen={deckOpen} onRespond={onRespond} respondRef={respondRef} />
            ) : (
              <RoundForm
                decision={decision}
                selected={state.draft.optionId ?? null}
                onSelect={(optionId) => onDraft({ optionId })}
                onChoose={onChoose}
              />
            )}
          </motion.div>
        ) : applied ? (
          <motion.div key={`applied-${state.decisionIndex}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <Applied
              applied={applied}
              next={
                state.decisionIndex >= DECISIONS.length
                  ? "No more rounds. Closing the incident…"
                  : DECISIONS[state.decisionIndex].requires === "stable" && anyCritical(state)
                    ? "Recovery starts once no customer function is critical."
                    : "Next round arriving shortly…"
              }
            />
          </motion.div>
        ) : (
          <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-sm text-text-faint">
            Round 1 incoming…
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

/** One round: pick an option (radio group), then confirm with "Make decision". */
function RoundForm({
  decision,
  selected,
  onSelect,
  onChoose,
}: {
  decision: (typeof DECISIONS)[number];
  /** Kept in simulator state, so it's applied if time runs out. */
  selected: string | null;
  onSelect: (optionId: string) => void;
  onChoose: (optionId: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // If focus was on the previous reveal (now removed), bring it to this round's first option.
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) {
      formRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    }
  }, []);
  return (
    <form
      ref={formRef}
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) onChoose(selected);
      }}
    >
      <fieldset>
        <legend className="text-sm font-medium text-text">{decision.title}</legend>
        {decision.context && <p className="mt-1 text-sm text-text-dim">{decision.context}</p>}
        <div className="mt-3 space-y-2">
          {decision.options.map((o) => {
            const checked = selected === o.id;
            return (
              <label
                key={o.id}
                className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 transition-colors ${
                  checked ? "border-signal-blue bg-panel-2" : "border-rule bg-ink hover:border-text-faint hover:bg-panel-2"
                }`}
              >
                <input
                  type="radio"
                  name={`round-${decision.id}`}
                  value={o.id}
                  checked={checked}
                  onChange={() => onSelect(o.id)}
                  className="mt-1 accent-[var(--signal-blue)]"
                />
                <span>
                  <span className="block text-sm text-text">{o.label}</span>
                  <span className="mt-0.5 block text-xs text-text-dim">{o.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={!selected}
        className="mt-3 h-10 w-full rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Make decision
      </button>
    </form>
  );
}

/**
 * Round countdown: a depleting bar with the time left in monospace, and the
 * "No rush" toggle that stops it. At zero the round auto-advances.
 */
function RoundTimer({ state, onNoRush }: { state: CrisisState; onNoRush: (on: boolean) => void }) {
  const left = timeLeft(state);
  const pct = (left / ROUND_TIME_SECONDS) * 100;
  const status: Status = state.noRush ? "inactive" : left <= 15 ? "critical" : left <= 30 ? "warning" : "info";
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`font-mono text-sm tabular-nums ${state.noRush ? "text-text-faint" : statusText[status]}`}>
          <span className="sr-only">Time left in this round: </span>
          {formatClock(left)}
          {state.noRush && <span className="ml-2 font-sans text-xs">paused</span>}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={state.noRush}
          onClick={() => onNoRush(!state.noRush)}
          className="flex items-center gap-2 text-xs text-text-dim hover:text-text"
        >
          <span
            aria-hidden
            className={`relative inline-flex h-4 w-7 rounded-full border motion-safe:transition-colors ${
              state.noRush ? "border-signal-blue bg-signal-blue" : "border-rule bg-panel-2"
            }`}
          >
            <span
              className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-text motion-safe:transition-[left] ${state.noRush ? "left-3.5" : "left-0.5"}`}
            />
          </span>
          No rush
        </button>
      </div>
      <div
        role="progressbar"
        aria-label="Round time left"
        aria-valuemin={0}
        aria-valuemax={ROUND_TIME_SECONDS}
        aria-valuenow={left}
        aria-valuetext={state.noRush ? "Timer paused" : `${left} seconds left`}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-panel-2"
      >
        <div
          className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear ${barFill[status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** The decision log as a visible timeline: time label and description for each decision. */
function DecisionLog({ entries }: { entries: CrisisState["decisionLog"] }) {
  return (
    <section aria-labelledby="decision-log-title" className="rounded-lg border border-rule bg-panel p-4">
      <h3 id="decision-log-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
        Decision log
      </h3>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-text-faint">No decisions yet.</p>
      ) : (
        <ol className="mt-3">
          {entries.map((e, i) => (
            <li key={`${e.time}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Timeline rail: a dot per entry, joined by a line. */}
              <span aria-hidden className="relative flex w-2 shrink-0 justify-center">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-signal-blue" />
                {i < entries.length - 1 && <span className="absolute bottom-[-0.25rem] top-4 w-px bg-rule" />}
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-xs tabular-nums text-text-faint">{e.time}</span>
                <span className="block text-sm text-text">{e.description}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The consequence reveal: what changed after the last decision. Takes focus so keyboard users land on it. */
function Applied({ applied, next }: { applied: NonNullable<CrisisState["lastApplied"]>; next: string }) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const { before, after } = applied;
  // The actual API change from this decision (e.g. "API utilization 91% → 84%"), not a canned number.
  const healthChanges = before.api !== after.api ? [`API utilization ${before.api}% → ${after.api}%`] : [];
  return (
    <div className="mt-3">
      <p ref={headingRef} tabIndex={-1} className={`flex items-center gap-2 text-sm font-medium ${statusText[applied.tone]}`}>
        <span aria-hidden className={dotClass(applied.tone)} />
        Decision applied
      </p>
      <p className="mt-1 text-sm text-text">{applied.label}</p>
      <ul className="mt-2 space-y-1 text-sm text-text-dim">
        {[...applied.changes, ...healthChanges].map((c) => (
          <li key={c} className="flex gap-2">
            <span aria-hidden className="text-text-faint">
              →
            </span>
            {c}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-faint">{next}</p>
    </div>
  );
}

const k1 = (n: number) => `${Math.round(n / 100) / 10}K`;

/** Event round: the "New signal" alert, with Respond opening the Decision Deck. */
function SignalAlert({
  state,
  deckOpen,
  onRespond,
  respondRef,
}: {
  state: CrisisState;
  deckOpen: boolean;
  onRespond: () => void;
  respondRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const signal = state.signal;
  return (
    <div role="alert" className="mt-3">
      <p className="flex items-center gap-2 text-sm font-medium text-signal-amber">
        <span aria-hidden className={dotClass("warning")} />
        New signal
      </p>
      {signal && (
        <p className="mt-2 text-sm text-text">
          Mobile traffic has increased another 18%. Current: {k1(signal.from)} req/sec. New: {k1(signal.to)} req/sec. Your current
          capacity is insufficient.
        </p>
      )}
      {deckOpen ? (
        <p className="mt-3 text-sm text-text-dim">Decision Deck open: pick an action and a target.</p>
      ) : (
        <button
          ref={respondRef}
          type="button"
          onClick={onRespond}
          className="mt-3 h-10 w-full rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
        >
          Respond
        </button>
      )}
    </div>
  );
}

const LEVEL_TONE = { Low: "ok", Medium: "alert", Critical: "critical" } as const;

/**
 * Decision Deck: pick an action card, then a target from Customer functions or
 * Traffic. A "System impact" preview (fixed lookup, see DECK_IMPACT) shows
 * before confirming; Cancel clears the selection.
 */
function DecisionDeck({
  state,
  action,
  target,
  onAction,
  onTarget,
  onCancel,
  onClose,
  onConfirm,
}: {
  state: CrisisState;
  action: DeckAction | null;
  target: DeckTarget | null;
  onAction: (a: DeckAction) => void;
  onTarget: (t: DeckTarget) => void;
  onCancel: () => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstCardRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  useEffect(() => {
    if (action && target) previewRef.current?.focus();
  }, [action, target]);
  const preview = action && target ? deckPreview(state, action, target) : null;

  const cardClass = (on: boolean) =>
    `rounded-md border px-3 py-2 text-left transition-colors ${on ? "border-signal-blue bg-panel-2" : "border-rule bg-ink hover:border-text-faint hover:bg-panel-2"}`;

  return (
    <section aria-labelledby="deck-title" className="mt-5 rounded-lg border border-signal-blue bg-panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id="deck-title" ref={headingRef} tabIndex={-1} className="text-lg">
          Decision Deck
        </h3>
        <button type="button" onClick={onClose} className="rounded-md border border-rule px-2 py-1 text-xs text-text-dim hover:text-text">
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div role="group" aria-labelledby="deck-actions-label">
            <p id="deck-actions-label" className="font-mono text-xs uppercase tracking-wider text-text-faint">
              1 · Action
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {DECK_ACTIONS.map((a, i) => (
                <button
                  key={a.key}
                  ref={i === 0 ? firstCardRef : undefined}
                  type="button"
                  aria-pressed={action === a.key}
                  onClick={() => onAction(a.key)}
                  className={cardClass(action === a.key)}
                >
                  <span className="block text-sm font-medium text-text">{a.label}</span>
                  <span className="mt-0.5 block text-xs text-text-dim">{a.summary}</span>
                </button>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby="deck-targets-label">
            <p id="deck-targets-label" className="font-mono text-xs uppercase tracking-wider text-text-faint">
              2 · Target{!action && <span className="normal-case tracking-normal"> (pick an action first)</span>}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Customer functions", Object.keys(FUNCTION_LABELS) as DeckTarget[]],
                  ["Traffic", ["ivrs", "mobile"] as DeckTarget[]],
                ] as const
              ).map(([group, targets]) => (
                <div key={group}>
                  <p className="text-xs text-text-dim">{group}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {targets.map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={!action}
                        aria-pressed={target === t}
                        onClick={() => onTarget(t)}
                        className={`${cardClass(target === t)} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        <span className="text-sm text-text">{targetLabel(t)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          ref={previewRef}
          tabIndex={-1}
          aria-labelledby="impact-title"
          role="region"
          className={`rounded-md border p-4 ${preview ? "border-rule bg-ink" : "border-dashed border-rule"}`}
        >
          <p id="impact-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
            System impact
          </p>
          {preview ? (
            <>
              <p className="mt-2 text-sm font-medium text-text">
                {DECK_ACTIONS.find((a) => a.key === action)!.label} → {targetLabel(target!)}
              </p>
              <p className="mt-1 text-sm text-text-dim">{preview.impact.changes.join(". ")}.</p>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div>
                  <dt className="text-xs text-text-faint">Platform load</dt>
                  <dd className={`font-mono tabular-nums ${statusText[healthStatus(preview.apiAfter)]}`}>
                    API {preview.apiBefore}% → {preview.apiAfter}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-faint">Customer impact</dt>
                  <dd className="mt-0.5">
                    <StatusPill tone={LEVEL_TONE[preview.level]}>{preview.level}</StatusPill>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-faint">Stakeholder impact</dt>
                  <dd className="text-text-dim">{preview.stakeholders.length ? preview.stakeholders.join(" · ") : "No change"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onConfirm}
                  className="h-9 flex-1 rounded-md bg-text px-3 text-sm font-medium text-ink transition-opacity hover:opacity-90"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCancel();
                    requestAnimationFrame(() => firstCardRef.current?.focus());
                  }}
                  className="h-9 rounded-md border border-rule px-3 text-sm text-text-dim hover:text-text"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-faint">Pick an action and a target to see the impact before you commit.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** A stakeholder's interruption card. Acknowledge and Respond both dismiss it for now. */
function Interruption({
  who,
  message,
  queued,
  onDismiss,
}: {
  who: StakeholderKey;
  message: string;
  queued: number;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-3 rounded-md border border-signal-blue bg-ink p-3"
    >
      <p className="text-xs font-medium text-signal-blue">{STAKEHOLDER_LABELS[who]}</p>
      <p className="mt-1 text-sm text-text">“{message}”</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onDismiss} className="h-8 rounded-md border border-rule px-3 text-xs text-text-dim hover:bg-panel-2 hover:text-text">
          Acknowledge
        </button>
        <button type="button" onClick={onDismiss} className="h-8 rounded-md bg-text px-3 text-xs font-medium text-ink transition-opacity hover:opacity-90">
          Respond
        </button>
      </div>
      {queued > 0 && <p className="mt-2 text-xs text-text-faint">{queued} more waiting</p>}
    </motion.div>
  );
}

const LEVEL_WIDTH: Record<QualityLevel, string> = { Low: "w-1/4", Medium: "w-3/5", High: "w-full" };

/**
 * Leadership's question (the communication mini-game): three possible answers,
 * then "What this response communicates" across four fixed meters. Described in
 * words and bars, never scored.
 */
function CommsCard({
  question,
  choice,
  queued,
  onRespond,
  onDone,
}: {
  question: string;
  choice: CommsOptionId | null;
  queued: number;
  onRespond: (id: CommsOptionId) => void;
  onDone: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const chosen = COMMS.options.find((o) => o.id === choice);
  useEffect(() => {
    if (chosen) panelRef.current?.focus();
  }, [chosen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-3 rounded-md border border-signal-blue bg-ink p-3"
    >
      <p className="text-xs font-medium text-signal-blue">{STAKEHOLDER_LABELS.leadership}</p>
      <p className="mt-1 text-sm text-text">“{question}”</p>

      {!chosen ? (
        <div role="group" aria-label="Your response" className="mt-3 space-y-1.5">
          {COMMS.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onRespond(o.id)}
              className="flex w-full gap-2 rounded-md border border-rule bg-panel px-2.5 py-2 text-left text-sm text-text-dim transition-colors hover:border-text-faint hover:bg-panel-2 hover:text-text"
            >
              <span aria-hidden className="font-mono text-xs uppercase text-text-faint">
                {o.id}
              </span>
              <span>“{o.text}”</span>
            </button>
          ))}
        </div>
      ) : (
        <div ref={panelRef} tabIndex={-1} role="region" aria-labelledby="message-quality-title" className="mt-3">
          <p className="text-xs text-text-faint">You said</p>
          <p className="mt-0.5 text-sm text-text">“{chosen.text}”</p>

          <div className="mt-3 rounded-md border border-rule bg-panel p-3">
            <p id="message-quality-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
              Message quality
            </p>
            <p className="mt-0.5 text-xs text-text-dim">What this response communicates</p>
            <dl className="mt-2.5 space-y-2">
              {(Object.keys(QUALITY_LABELS) as QualityKey[]).map((k) => {
                const level = chosen.quality[k];
                return (
                  <div key={k}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <dt className="text-text-dim">{QUALITY_LABELS[k]}</dt>
                      <dd className="text-text">{level}</dd>
                    </div>
                    <div aria-hidden className="mt-1 h-1 overflow-hidden rounded-full bg-panel-2">
                      <div className={`h-full rounded-full bg-signal-blue motion-safe:transition-[width] ${LEVEL_WIDTH[level]}`} />
                    </div>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 text-xs text-text-dim">{chosen.reading}</p>
          </div>

          <button type="button" onClick={onDone} className="mt-3 h-8 rounded-md border border-rule px-3 text-xs text-text-dim hover:bg-panel-2 hover:text-text">
            Done
          </button>
          {queued > 0 && <p className="mt-2 text-xs text-text-faint">{queued} more waiting</p>}
        </div>
      )}
    </motion.div>
  );
}

/** Limited information: what you can see, and what you can't until you spend time on it (or ask Engineering). */
function SignalsPanel({ state, onRequest }: { state: CrisisState; onRequest: (s: UnknownSignal) => void }) {
  const known: { label: string; value: string }[] = [
    { label: "API utilization", value: `${state.health.api}%` },
    { label: "Traffic", value: `IVRS ${k1(state.traffic.ivrs)} · Mobile ${k1(state.traffic.mobile)} req/sec` },
    { label: "Booking success rate", value: `${bookingSuccessRate(state)}%` },
  ];
  return (
    <section aria-labelledby="signals-title" className="rounded-lg border border-rule bg-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="signals-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
          Available signals
        </h3>
        <span className="text-xs text-text-faint">Each request costs {DATA_REQUEST_SECONDS}s of round time</span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        {known.map((k) => (
          <div key={k.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-text-dim">{k.label}</dt>
            <dd className="text-right font-mono text-xs tabular-nums text-text">{k.value}</dd>
          </div>
        ))}
      </dl>

      <h4 className="mt-4 border-t border-rule pt-3 font-mono text-xs uppercase tracking-wider text-text-faint">Unknown</h4>
      <dl className="mt-2 space-y-2.5 text-sm">
        {(Object.keys(UNKNOWN_LABELS) as UnknownSignal[]).map((k) => {
          const revealed = state.revealed.includes(k);
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-dim">{UNKNOWN_LABELS[k]}</dt>
                <dd className={`font-mono text-xs tabular-nums ${revealed ? "text-text" : "text-text-faint"}`}>
                  {revealed ? (k === "dbSaturation" ? unknownValue(state, k) : "Revealed") : <span aria-label="unknown">?</span>}
                </dd>
              </div>
              {revealed ? (
                k !== "dbSaturation" && <p className="mt-0.5 text-xs text-text-dim">{unknownValue(state, k)}</p>
              ) : (
                <button
                  type="button"
                  disabled={state.phase !== "war-room"}
                  onClick={() => onRequest(k)}
                  className="mt-1 rounded border border-rule px-2 py-0.5 text-xs text-text-dim transition-colors hover:bg-panel-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Request more data <span className="font-mono">(+{DATA_REQUEST_SECONDS}s)</span>
                  <span className="sr-only"> for {UNKNOWN_LABELS[k]}</span>
                </button>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** Ask Engineering: two question slots from four, each with a fixed answer that reveals a signal for free. */
function AskEngineering({ state, onAsk }: { state: CrisisState; onAsk: (q: QuestionId) => void }) {
  const slotsLeft = QUESTION_SLOTS - state.asked.length;
  return (
    <section aria-labelledby="ask-eng-title" className="rounded-lg border border-rule bg-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="ask-eng-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
          Ask Engineering
        </h3>
        <span className="font-mono text-xs tabular-nums text-text-faint">
          {slotsLeft} of {QUESTION_SLOTS} questions left
        </span>
      </div>

      {state.asked.length > 0 && (
        <ol className="mt-3 space-y-3">
          {state.asked.map((id) => {
            const q = QUESTIONS.find((x) => x.id === id)!;
            return (
              <li key={id} className="text-sm">
                <p className="text-text-dim">{q.question}</p>
                <p className="mt-1 border-l-2 border-signal-blue pl-2 text-text">{q.answer}</p>
                <p className="mt-1 text-xs text-text-faint">Revealed: {UNKNOWN_LABELS[q.reveals]}</p>
              </li>
            );
          })}
        </ol>
      )}

      {slotsLeft > 0 ? (
        <ul className={`${state.asked.length ? "mt-4 border-t border-rule pt-3" : "mt-3"} space-y-1.5`}>
          {QUESTIONS.filter((q) => !state.asked.includes(q.id)).map((q) => (
            <li key={q.id}>
              <button
                type="button"
                disabled={state.phase !== "war-room"}
                onClick={() => onAsk(q.id)}
                className="w-full rounded-md border border-rule bg-ink px-3 py-1.5 text-left text-sm text-text-dim transition-colors hover:border-text-faint hover:bg-panel-2 hover:text-text disabled:opacity-40"
              >
                {q.question}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-text-faint">No questions left. Engineering is heads-down on the incident.</p>
      )}
    </section>
  );
}

/** A health bar for a signal you can't see yet. */
function UnknownBar({ label }: { label: string }) {
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-text">
          <span aria-hidden className={dotClass("inactive")} />
          {label}
        </span>
        <span className="font-mono text-text-faint">
          ?<span className="sr-only">, unknown</span>
        </span>
      </div>
      <div aria-hidden className="mt-1.5 h-1.5 rounded-full border border-dashed border-rule" />
    </li>
  );
}

/** Capacity budget: 100 points across the work competing for the platform (context for now; not editable yet). */
function CapacityPanel({ capacity }: { capacity: CrisisState["capacity"] }) {
  return (
    <section aria-labelledby="capacity-title" className="rounded-lg border border-rule bg-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="capacity-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
          Capacity allocation
        </h3>
        <span className="font-mono text-xs tabular-nums text-text-faint">
          {CAPACITY.reduce((sum, c) => sum + capacity[c.key], 0)} / {CAPACITY_TOTAL} points
        </span>
      </div>
      {/* Combined bar: protected work in teal, the rest neutral. */}
      <div aria-hidden className="mt-3 flex h-2.5 gap-px overflow-hidden rounded-full bg-panel-2">
        {CAPACITY.map((c) => (
          <div
            key={c.key}
            title={`${c.label}: ${capacity[c.key]}`}
            className={`h-full motion-safe:transition-[width] motion-safe:duration-700 ${c.critical ? "bg-signal-teal" : "bg-text-faint"} ${
              c.key === "emergency" || c.key === "analytics" || c.key === "newFeatures" ? "opacity-70" : ""
            }`}
            style={{ width: `${(capacity[c.key] / CAPACITY_TOTAL) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
        {CAPACITY.map((c) => (
          <li key={c.key} className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2 text-text-dim">
              <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${c.critical ? "bg-signal-teal" : "bg-text-faint"}`} />
              {c.label}
            </span>
            <span className="font-mono tabular-nums text-text">{capacity[c.key]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IncidentLog({ log }: { log: CrisisState["log"] }) {
  return (
    <section aria-labelledby="incident-log-title" className="rounded-lg border border-rule bg-panel p-4">
      <h3 id="incident-log-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
        Incident log
      </h3>
      {log.length === 0 ? (
        <p className="mt-3 text-sm text-text-faint">Nothing yet.</p>
      ) : (
        <ol className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-sm">
          {[...log].reverse().map((e, i) => (
            <li key={`${e.at}-${log.length - i}`} className="flex gap-3">
              <span className="shrink-0 font-mono text-xs tabular-nums leading-5 text-text-faint">T+ {formatClock(e.at)}</span>
              <span className="flex min-w-0 items-start gap-2">
                <span aria-hidden className={`mt-2 ${dotClass(e.tone)}`} />
                <span className={e.tone === "critical" ? "text-signal-red" : "text-text-dim"}>{e.text}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * End screen: "Incident resolved" (never a win/lose message), final customer
 * functions, key decisions from the decision log, and the product principle.
 * Below it, the real-world reveal (only ever shown here) and a neutral
 * comparison with the documented approach. No grade, no score.
 */
function EndScreen({ state, caseStudy, onRestart }: { state: CrisisState; caseStudy: PrototypeCaseStudy | null; onRestart: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const recovered = state.choices.some((c) => DECISIONS.find((d) => d.id === c.decisionId)?.requires === "stable");

  return (
    <section aria-labelledby="end-title" className="p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <h2 id="end-title" ref={headingRef} tabIndex={-1} className="text-2xl">
          {recovered ? "Incident resolved" : "Incident closed"}
        </h2>
        <span className="font-mono text-sm tabular-nums text-text-dim">
          <span className="sr-only">Total time: </span>T+ {formatClock(state.seconds)}
        </span>
      </header>
      {!recovered && (
        <p className="mt-3 max-w-prose text-sm text-text-dim">The platform didn&apos;t stabilise in time for a recovery round.</p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="final-functions-title" className="rounded-lg border border-rule bg-panel p-4">
          <h3 id="final-functions-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
            Customer functions
          </h3>
          <ul className="mt-3 space-y-2">
            {(Object.keys(FUNCTION_LABELS) as FunctionKey[]).map((k) => {
              const d = FUNCTION_DISPLAY[state.functions[k]];
              return <StatusRow key={k} label={FUNCTION_LABELS[k]} status={d.status} text={state.locked.includes(k) ? `${d.text} · locked` : d.text} />;
            })}
          </ul>
        </section>

        <section aria-labelledby="key-decisions-title" className="rounded-lg border border-rule bg-panel p-4">
          <h3 id="key-decisions-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
            Key decisions
          </h3>
          {state.decisionLog.length ? (
            <ol className="mt-3 space-y-2 text-sm">
              {state.decisionLog.map((e, i) => (
                <li key={`${e.time}-${i}`} className="flex gap-3">
                  <span className="shrink-0 font-mono text-xs tabular-nums leading-5 text-text-faint">{e.time}</span>
                  <span className="text-text">{e.description}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-text-faint">No decisions were made.</p>
          )}
        </section>
      </div>

      <aside aria-label="Product principle" className="mt-4 rounded-lg border border-signal-blue bg-panel p-4">
        <p className="font-mono text-xs uppercase tracking-wider text-signal-blue">Product principle</p>
        <p className="mt-2 text-base text-text">{PRODUCT_PRINCIPLE}</p>
      </aside>

      <RealWorldReveal state={state} caseStudy={caseStudy} />
      <Reflection onReplay={onRestart} />
      <PortfolioBridge caseStudySlug={caseStudy?.slug ?? null} />
    </section>
  );
}

const PROTOTYPE_SLUG = "crisis-simulator";
const REFLECTION_FALLBACK =
  "The analysis isn't available right now. Your reasoning still stands: compare it with the real approach above.";

/**
 * "What would you do differently?": Replay, plus a free-text reflection that
 * the same AI setup as Ask Anshu (/api/chat, reflection mode) compares with the
 * documented approach. Streams in with a loading placeholder; any failure shows
 * a quiet fallback and never blocks the rest of the page.
 */
function Reflection({ onReplay }: { onReplay: () => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [analysis, setAnalysis] = useState("");
  const reduceMotion = useReducedMotion();
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function analyze() {
    const reasoning = text.trim();
    if (!reasoning || status === "loading") return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStatus("loading");
    setAnalysis("");
    let held = ""; // reduced motion: show the whole answer at once
    try {
      await streamChat(
        { reflection: { prototype: PROTOTYPE_SLUG, reasoning } },
        (e) => {
          if (e.type !== "text") return;
          if (reduceMotion) held += e.text;
          else setAnalysis((a) => a + e.text);
        },
        controller.signal
      );
      if (held) setAnalysis(held);
      setStatus("done");
    } catch {
      if (controller.signal.aborted) return;
      setStatus("failed");
    }
  }

  return (
    <section aria-labelledby="reflect-title" className="mt-10 border-t border-rule pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="reflect-title" className="text-xl">
          What would you do differently?
        </h3>
        <button
          type="button"
          onClick={onReplay}
          className="h-9 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2"
        >
          Replay
        </button>
      </div>

      <form
        className="mt-4 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          analyze();
        }}
      >
        <label htmlFor="reflection-text" className="sr-only">
          What you would do differently, and why
        </label>
        <textarea
          id="reflection-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.reflectionChars}
          rows={4}
          placeholder="I would protect X because..."
          className="w-full resize-y rounded-md border border-rule bg-ink px-3 py-2 text-sm text-text placeholder:text-text-faint"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-xs tabular-nums text-text-faint">
            {text.length} / {LIMITS.reflectionChars}
          </span>
          <button
            type="submit"
            disabled={!text.trim() || status === "loading"}
            className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "loading" ? "Analyzing…" : "Analyze my reasoning"}
          </button>
        </div>
      </form>

      {status !== "idle" && (
        <div aria-live="polite" aria-busy={status === "loading"} className="mt-4 max-w-2xl rounded-lg border border-rule bg-panel p-4">
          {status === "failed" ? (
            <p className="text-sm text-text-dim">{REFLECTION_FALLBACK}</p>
          ) : analysis ? (
            <>
              <p className="text-sm text-text">{analysis}</p>
              {status === "done" && <p className="mt-3 text-xs text-text-faint">AI analysis of your reasoning against the case study. It can be wrong.</p>}
            </>
          ) : (
            <AnswerSkeleton label="Analyzing your reasoning…" />
          )}
        </div>
      )}
    </section>
  );
}

/** Closing links back into the portfolio. */
function PortfolioBridge({ caseStudySlug }: { caseStudySlug: string | null }) {
  const links = [
    { href: caseStudySlug ? `/work/${caseStudySlug}` : "/work", label: "Explore the real case study", note: "The full story behind this simulation" },
    { href: "/prototype-lab", label: "Explore my other prototypes", note: "More product decisions to try" },
    { href: "/ai-lab", label: "Ask my AI about this experience", note: "Questions answered from the portfolio" },
  ];
  return (
    <nav aria-label="Keep exploring" className="mt-10 border-t border-rule pt-8">
      <ul className="grid gap-3 sm:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex h-full flex-col rounded-lg border border-rule bg-panel p-4 transition-colors hover:bg-panel-2">
              <span className="text-sm font-medium text-text">{l.label} →</span>
              <span className="mt-1 text-xs text-text-dim">{l.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The real incident, from the work record in Supabase, and a neutral comparison with the player's path. */
function RealWorldReveal({ state, caseStudy }: { state: CrisisState; caseStudy: PrototypeCaseStudy | null }) {
  if (!caseStudy) {
    return (
      <section aria-labelledby="real-title" className="mt-10 border-t border-rule pt-8">
        <h3 id="real-title" className="text-xl">
          What happened in the real situation?
        </h3>
        <p className="mt-3 text-sm text-text-dim">The real case study isn&apos;t available right now.</p>
      </section>
    );
  }
  const decision = caseStudy.decisions[0];
  const protectText = [decision?.title, caseStudy.approach].filter(Boolean).join(" ");
  const deprioritiseText = [decision?.choice, caseStudy.approach].filter(Boolean).join(" ");
  const compare = comparePaths(state, { protectText, deprioritiseText });

  return (
    <section aria-labelledby="real-title" className="mt-10 border-t border-rule pt-8">
      <h3 id="real-title" className="text-xl">
        What happened in the real situation?
      </h3>
      {caseStudy.problem && <p className="mt-3 max-w-prose text-text-dim">{caseStudy.problem}</p>}

      {caseStudy.metrics.length > 0 && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {caseStudy.metrics.map((m) => (
            <div key={m.label} className="rounded-md border border-rule bg-panel px-3 py-2">
              <dt className="text-xs text-text-faint">{m.label}</dt>
              <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{m.value}</dd>
              {m.context && <dd className="text-xs text-text-dim">{m.context}</dd>}
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {(caseStudy.approach || decision) && (
          <div>
            <h4 className="text-sm font-medium text-text">The decision</h4>
            {caseStudy.approach && <p className="mt-1 text-sm text-text-dim">{caseStudy.approach}</p>}
            {decision?.tradeoffs && <p className="mt-2 text-sm text-text-dim">{decision.tradeoffs}</p>}
          </div>
        )}
        {caseStudy.outcome && (
          <div>
            <h4 className="text-sm font-medium text-text">The outcome</h4>
            <p className="mt-1 text-sm text-text">{caseStudy.outcome}</p>
          </div>
        )}
      </div>

      <section aria-labelledby="compare-title" className="mt-8 rounded-lg border border-rule bg-panel p-4">
        <h4 id="compare-title" className="text-base">
          Compare your decision
        </h4>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-text-faint">Your path</p>
            <dl className="mt-2 space-y-2 text-sm">
              <div>
                <dt className="text-text-dim">Protected</dt>
                <dd className="text-text">{compare.playerProtected.length ? compare.playerProtected.join(", ") : "Nothing"}</dd>
              </div>
              <div>
                <dt className="text-text-dim">Deprioritised</dt>
                <dd className="text-text">{compare.playerDeprioritised.length ? compare.playerDeprioritised.join(", ") : "Nothing"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-text-faint">The real incident</p>
            <dl className="mt-2 space-y-2 text-sm">
              {decision?.title && (
                <div>
                  <dt className="text-text-dim">Protected</dt>
                  <dd className="text-text">{decision.title}</dd>
                </div>
              )}
              {decision?.choice && (
                <div>
                  <dt className="text-text-dim">Deprioritised</dt>
                  <dd className="text-text">{decision.choice}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        <p className="mt-4 border-t border-rule pt-3 text-sm text-text">{compare.line}</p>
      </section>
    </section>
  );
}

// --- Dashboard pieces ------------------------------------------------------------------

function Quadrant({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-rule bg-panel p-4" aria-label={title}>
      <h3 className="font-mono text-xs uppercase tracking-wider text-text-faint">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  const status = healthStatus(value);
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-text">
          <span aria-hidden className={dotClass(status)} />
          {label}
        </span>
        <span className={`font-mono tabular-nums ${statusText[status]}`}>
          {value}%<span className="sr-only">, {statusLabel[status].toLowerCase()}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} load`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}%, ${statusLabel[status].toLowerCase()}`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2"
      >
        <div className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 ${barFill[status]}`} style={{ width: `${value}%` }} />
      </div>
    </li>
  );
}

/** Ring shown on a dashboard item while it's the Decision Deck's selected target. */
const TARGET_RING = "rounded-md outline outline-2 outline-offset-4 outline-signal-blue";

function Traffic({ label, value, baseline, highlighted = false }: { label: string; value: number; baseline: number; highlighted?: boolean }) {
  return (
    <div className={highlighted ? TARGET_RING : ""}>
      <dt className="text-sm text-text-dim">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-2xl font-medium tabular-nums text-text">{nf.format(value)}</span>
        <span className="text-xs text-text-faint">req/sec</span>
        <span className="font-mono text-xs tabular-nums text-text-faint">{Math.round((value / baseline) * 10) / 10}x baseline</span>
      </dd>
    </div>
  );
}

function StatusRow({
  label,
  status,
  text,
  highlighted = false,
  pulse = false,
}: {
  label: string;
  status: Status;
  text: string;
  highlighted?: boolean;
  /** The soft pulse (motion-safe), e.g. a stakeholder who's calling. */
  pulse?: boolean;
}) {
  return (
    <li className={`flex items-center justify-between gap-3 text-sm ${highlighted ? TARGET_RING : ""}`}>
      <span className="flex items-center gap-2 text-text">
        <span
          aria-hidden
          className={`${dotClass(status)} ${pulse ? "motion-safe:animate-status-pulse [--pulse-color:var(--signal-blue)]" : ""}`}
        />
        {label}
      </span>
      <span className={statusText[status]}>{text}</span>
    </li>
  );
}

function Mission({ meters }: { meters: CrisisState["meters"] }) {
  return (
    <section aria-labelledby="mission-title" className="rounded-lg border border-rule bg-panel p-4">
      <h3 id="mission-title" className="font-mono text-xs uppercase tracking-wider text-signal-blue">
        Mission
      </h3>
      <p className="mt-2 text-sm text-text">Protect critical customer functions:</p>
      <ul className="mt-1 space-y-0.5 text-sm text-text-dim">
        {NORTH_STAR.map((n) => (
          <li key={n} className="flex items-center gap-2">
            <span aria-hidden className={dotClass("info")} />
            {n}
          </li>
        ))}
      </ul>

      <ul className="mt-4 space-y-3 border-t border-rule pt-4">
        {(Object.keys(METERS) as MeterKey[]).map((k) => (
          <Meter key={k} meterKey={k} value={meters[k]} />
        ))}
      </ul>
    </section>
  );
}

function Meter({ meterKey, value }: { meterKey: MeterKey; value: number }) {
  const m = METERS[meterKey];
  const status = m.status(value);
  const shown = meterKey === "availability" ? value.toFixed(1) : String(Math.round(value));
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-text-dim">
          {m.label}
          <span className="sr-only">{m.higherIsBetter ? " (higher is better)" : " (lower is better)"}</span>
        </span>
        <span className={`font-mono tabular-nums ${statusText[status]}`}>{shown}%</span>
      </div>
      <div
        role="meter"
        aria-label={m.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${shown}%, ${statusLabel[status].toLowerCase()}`}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-panel-2"
      >
        <div className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 ${barFill[status]}`} style={{ width: `${value}%` }} />
      </div>
    </li>
  );
}

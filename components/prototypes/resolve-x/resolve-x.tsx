"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { StatusPill } from "@/components/ui/status-pill";
import { dotClass, type Status, statusText } from "@/components/prototypes/engine/status";
import {
  BRIEFING,
  DISCLAIMER,
  ENTERPRISE,
  INCIDENTS,
  METRIC_FORMULAS,
  METRIC_STATE_LABEL,
  METRIC_TARGETS,
  SHIFT_START_MINUTES,
  SIM_MINUTES_PER_REAL_SECOND,
  SLA_LABEL,
  TEAMS,
  applyAction,
  breachEntry,
  computeMetrics,
  counters,
  formatSimTime,
  isOpen,
  metricState,
  minutesLeft,
  openCount,
  queueState,
  routeIncident,
  teamById,
  triageDecisions,
  ARRIVAL_INTERVAL_MS,
  CONTINUE_ARRIVALS,
  PATTERN_START,
  RELIEF_HOLD_MS,
  WORKAROUND,
  patternChoiceEntry,
  patternDetectedEntry,
  patternOpenCount,
  problemEntry,
  repeatCount,
  reopenEntry,
  knowledgeAcceptEntries,
  knowledgeRejectEntry,
  finalRuleEntry,
  parentResolvedEntries,
  type PatternChoice,
  type PatternState,
  type ActionId,
  type DecisionLogEntry,
  type MetricKey,
  type MetricState,
  type Placement,
  type RoutedIncident,
  type SlaState,
  type Team,
  type Triage,
} from "./model";
import { CountdownRing, InfoTip, ResolveStage } from "./resolve";
import { PatternEvent } from "./pattern";
import { CaseFlow } from "./case";
import { KnowledgeSuggestion } from "./knowledge";
import { AutomationStudio } from "./automation";
import { ShiftSummary } from "./summary";
import type { CanvasProps } from "@/components/prototypes/canvases";
import { PRIORITY_STYLE, TriageStage, incidentLayoutId } from "./triage";

/** SLA states on the Flight Deck signals: teal healthy, amber at risk, red breached. */
const SLA_STATUS: Record<SlaState, Status> = {
  healthy: "stable",
  "at-risk": "warning",
  breached: "critical",
};
const SLA_FILL: Record<SlaState, string> = {
  healthy: "bg-signal-teal",
  "at-risk": "bg-signal-amber",
  breached: "bg-signal-red",
};

/**
 * RESOLVE//X canvas: the shift briefing, then the service operations shell:
 * clock, counters, team queues, the stage (triage, then resolution, three
 * incidents arriving one at a time) and metrics computed from the decision
 * log. Every outcome comes from the lookup tables in model.ts.
 */
export function ResolveX({ caseStudy, onComplete }: CanvasProps) {
  const [phase, setPhase] = useState<"briefing" | "shell">("briefing");
  return (
    <div>
      {phase === "briefing" ? <Briefing onEnter={() => setPhase("shell")} /> : <Shell caseStudySlug={caseStudy?.slug ?? null} onComplete={onComplete} />}
      {/* On every screen of the prototype. */}
      <p className="border-t border-rule px-4 py-3 text-xs text-text-faint sm:px-6">{DISCLAIMER}</p>
    </div>
  );
}

// --- Briefing ----------------------------------------------------------------------------------

function Briefing({ onEnter }: { onEnter: () => void }) {
  return (
    <section aria-labelledby="resolve-briefing-title" className="flex min-h-[34rem] flex-col items-center justify-center px-6 py-14 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-signal-blue">{ENTERPRISE} · fictional</p>
      <h2 id="resolve-briefing-title" className="mt-3 text-3xl sm:text-4xl">
        {BRIEFING.title}
      </h2>
      <p className="mt-3 max-w-md text-text-dim">{BRIEFING.intro}</p>

      <dl className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {BRIEFING.stats.map((s) => (
          <div key={s.label} className="flex flex-col rounded-lg border border-rule bg-panel px-4 py-3 text-left">
            <dt className="text-xs text-text-faint">{s.label}</dt>
            <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-text">{s.value}</dd>
            <dd className="mt-auto pt-1 font-mono text-[0.6875rem] text-text-faint">Simulated</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 w-full max-w-2xl rounded-lg border border-rule bg-panel px-4 py-3 text-left">
        <p className="font-mono text-xs uppercase tracking-wider text-text-faint">Objective</p>
        <p className="mt-1 text-sm text-text">{BRIEFING.objective}</p>
      </div>

      <button type="button" onClick={onEnter} className="mt-10 h-11 rounded-md bg-text px-6 text-sm font-medium text-ink transition-opacity hover:opacity-90">
        Enter service operations
      </button>
    </section>
  );
}

// --- Shell -----------------------------------------------------------------------------------------

const NO_RUSH_KEY = "resolve-x:no-rush";

/** "No rush" pauses the clock; remembered for this browser tab (sessionStorage), off by default. */
function useNoRush() {
  const [noRush, setNoRush] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(NO_RUSH_KEY) === "1") setNoRush(true);
    } catch {
      // storage unavailable (private mode, blocked): the toggle still works for this visit
    }
  }, []);
  const toggle = () =>
    setNoRush((on) => {
      try {
        sessionStorage.setItem(NO_RUSH_KEY, on ? "0" : "1");
      } catch {
        // ignore, as above
      }
      return !on;
    });
  return [noRush, toggle] as const;
}

/** Simulated clock: SIM_MINUTES_PER_REAL_SECOND simulated minutes per real second, paused under No rush. */
function useSimClock(paused: boolean) {
  const [minutes, setMinutes] = useState(SHIFT_START_MINUTES);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setMinutes((m) => m + SIM_MINUTES_PER_REAL_SECOND), 1000);
    return () => window.clearInterval(id);
  }, [paused]);
  return minutes;
}

/** How long a reassigned incident sits in the chosen queue before moving to the best-fit team. */
const REASSIGN_MOVE_MS = 1200;

type View = { kind: "triage" } | { kind: "routed"; id: string } | { kind: "resolve"; id: string };

function Shell({ caseStudySlug, onComplete }: { caseStudySlug: string | null; onComplete: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const [noRush, toggleNoRush] = useNoRush();
  const minutes = useSimClock(noRush);
  const reduce = useReducedMotion();

  // Incidents arrive one at a time; the next arrives when the player asks for it.
  const [arrivedAt, setArrivedAt] = useState<Record<number, number>>({
    0: SHIFT_START_MINUTES,
  });
  const [view, setView] = useState<View>({ kind: "triage" });
  const [routed, setRouted] = useState<RoutedIncident[]>([]);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  // Reassigned incidents show in the chosen queue first, then move to the best fit.
  const [moved, setMoved] = useState<string[]>([]);
  const place: Placement = (r) => (r.team !== r.chosenTeam && !moved.includes(r.incident.id) ? r.chosenTeam : r.team);

  const incoming = routed.length < INCIDENTS.length ? INCIDENTS[routed.length] : null;
  const byId = (id: string) => routed.find((r) => r.incident.id === id)!;

  const onSubmit = (triage: Triage) => {
    const r = routeIncident(INCIDENTS[routed.length], triage, minutes);
    setRouted((list) => [...list, r]);
    setDecisionLog((log) => [...log, ...triageDecisions(r)]);
    setView({ kind: "routed", id: r.incident.id });
    if (r.team !== r.chosenTeam) {
      if (reduce) setMoved((m) => [...m, r.incident.id]);
      else window.setTimeout(() => setMoved((m) => [...m, r.incident.id]), REASSIGN_MOVE_MS);
    }
  };
  const onNextIncident = () => {
    setArrivedAt((a) => ({ ...a, [routed.length]: minutes }));
    setView({ kind: "triage" });
  };
  const onAction = (id: string, action: ActionId) => {
    const r = byId(id);
    const out = applyAction(r, action, minutes);
    setRouted((list) => list.map((x) => (x.incident.id === id ? { ...x, work: out.work } : x)));
    setDecisionLog((log) => [...log, ...out.entries]);
  };

  // A countdown reaching zero is logged once; the incident stays open and the player carries on.
  const breachLogged = useRef(new Set<string>());
  useEffect(() => {
    const newly = routed.filter((r) => isOpen(r) && minutesLeft(r, minutes) <= 0 && !breachLogged.current.has(r.incident.id));
    if (!newly.length) return;
    newly.forEach((r) => breachLogged.current.add(r.incident.id));
    setDecisionLog((log) => [...log, ...newly.map((r) => breachEntry(r, minutes))]);
  }, [minutes, routed]);

  // The pattern event: triggered once, when the third incident is resolved. Every path ends in the problem record.
  const [pattern, setPattern] = useState<PatternState | null>(null);
  const [patternBusy, setPatternBusy] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (ms: number, fn: () => void) => {
    if (reduce || ms === 0) fn();
    else timers.current.push(window.setTimeout(fn, ms));
  };
  const allResolved = routed.length === INCIDENTS.length && routed.every((r) => !isOpen(r));
  useEffect(() => {
    if (!allResolved || pattern) return;
    setPattern(PATTERN_START);
    setDecisionLog((log) => [...log, patternDetectedEntry(minutes)]);
  }, [allResolved, pattern, minutes]);

  // The linked customer case: linking to the problem reopens the parent incident; resolving it updates the case.
  const [parent, setParent] = useState<"reopened" | "resolved" | null>(null);
  const [caseOpen, setCaseOpen] = useState(false);
  // The automation studio unlocks after the knowledge suggestion; the kept rule is logged.
  const [ruleKept, setRuleKept] = useState(false);
  // The end of the shift: the summary and the real-world reveal (which unlocks the case study and lens trade-offs).
  const [ended, setEnded] = useState(false);
  const endShift = () => {
    setEnded(true);
    onComplete();
  };
  const onResolveParent = () => {
    setParent("resolved");
    setDecisionLog((log) => [...log, ...parentResolvedEntries(minutes)]);
  };

  // The knowledge suggestion, while the related payment incidents are still open. Both answers are logged.
  const onKnowledge = (choice: "accepted" | "rejected") => {
    setPattern((p) => p && { ...p, knowledge: choice });
    setDecisionLog((log) => [...log, ...(choice === "accepted" ? knowledgeAcceptEntries(minutes) : [knowledgeRejectEntry(minutes)])]);
  };

  const onPatternChoose = (choice: PatternChoice) => {
    if (!pattern) return;
    const choices = [...pattern.choices, choice];
    if (choice === "link") {
      const after = { ...pattern, choices, problemOpen: true };
      setPattern(after);
      setDecisionLog((log) => [...log, patternChoiceEntry("link", after, minutes), problemEntry(after, minutes), reopenEntry(minutes)]);
      setParent("reopened");
      return;
    }
    // Continue / workaround: the consequence plays out (arrivals, relief), then the link option comes back.
    const arrivals = choice === "continue" ? CONTINUE_ARRIVALS : WORKAROUND.arrivals;
    const final = {
      ...pattern,
      choices,
      arrived: [...pattern.arrived, ...arrivals],
      relief: pattern.relief + (choice === "workaround" ? WORKAROUND.relief : 0),
      workaroundPublished: pattern.workaroundPublished || choice === "workaround",
    };
    setDecisionLog((log) => [...log, patternChoiceEntry(choice, final, minutes)]);
    setPatternBusy(true);
    setPattern(
      (p) =>
        p && {
          ...p,
          choices,
          relief: final.relief,
          workaroundPublished: final.workaroundPublished,
        },
    );
    const start = choice === "workaround" ? RELIEF_HOLD_MS : ARRIVAL_INTERVAL_MS;
    arrivals.forEach((a, i) => later(start + i * ARRIVAL_INTERVAL_MS, () => setPattern((p) => p && { ...p, arrived: [...p.arrived, a] })));
    later(start + arrivals.length * ARRIVAL_INTERVAL_MS, () => setPatternBusy(false));
  };

  const base = counters(TEAMS, routed, minutes);
  const live = {
    ...base,
    open: base.open + (pattern ? patternOpenCount(pattern) : 0) + (parent === "reopened" ? 1 : 0),
  };
  const openOthers = (except?: string) => routed.filter((r) => isOpen(r) && r.incident.id !== except);

  /** Where the player can go next: the next incoming incident, or another open one. */
  const nextSteps = (except?: string) => {
    const others = openOthers(except);
    if (!incoming && !others.length) return <p className="text-sm text-text-dim">All three incidents are resolved.</p>;
    return (
      <div className="flex flex-wrap gap-2">
        {incoming && (
          <button
            type="button"
            onClick={onNextIncident}
            className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            Next incident
          </button>
        )}
        {others.map((r) => (
          <button
            key={r.incident.id}
            type="button"
            onClick={() => setView({ kind: "resolve", id: r.incident.id })}
            className="h-10 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2"
          >
            Resolve {r.incident.id}
          </button>
        ))}
      </div>
    );
  };

  const stageTitle =
    view.kind === "triage" && incoming
      ? `Incoming incident · ${routed.length + 1} of ${INCIDENTS.length}`
      : view.kind === "resolve"
        ? `Resolving ${view.id}`
        : "Routed";

  return (
    <section aria-labelledby="resolve-shell-title" className="p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="resolve-shell-title" ref={headingRef} tabIndex={-1} className="text-xl">
            Service operations
          </h2>
          <StatusPill tone={noRush ? "idle" : "live"}>{noRush ? "Paused" : `${ENTERPRISE} · live`}</StatusPill>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-2">
              <dt className="text-xs text-text-faint">Simulated time</dt>
              <dd className="font-mono text-sm tabular-nums text-text">{formatSimTime(minutes)}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-xs text-text-faint">Open incidents</dt>
              <dd className="font-mono text-sm tabular-nums text-text">{live.open}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="flex items-center gap-1.5 text-xs text-text-faint">
                {live.slaAtRisk > 0 && <span aria-hidden className={dotClass("warning")} />}
                SLA at risk
              </dt>
              <dd className={`font-mono text-sm tabular-nums ${live.slaAtRisk > 0 ? statusText.warning : "text-text"}`}>{live.slaAtRisk}</dd>
            </div>
            {pattern && (
              <div className="flex items-baseline gap-2">
                <dt className="text-xs text-text-faint">Repeat incidents</dt>
                <dd className="font-mono text-sm tabular-nums text-signal-amber">{repeatCount(pattern)}</dd>
              </div>
            )}
          </dl>
          <button
            type="button"
            role="switch"
            aria-checked={noRush}
            onClick={toggleNoRush}
            className="flex items-center gap-2 rounded-md border border-rule px-2.5 py-1 text-sm text-text-dim transition-colors hover:bg-panel-2 hover:text-text"
          >
            <span
              aria-hidden
              className={`relative h-4 w-7 rounded-full border border-rule motion-safe:transition-colors ${noRush ? "bg-signal-blue" : "bg-panel-2"}`}
            >
              <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-text motion-safe:transition-[left] ${noRush ? "left-[0.875rem]" : "left-0.5"}`} />
            </span>
            No rush
          </button>
        </div>
      </header>
      {noRush && <p className="mt-2 text-xs text-text-faint">The clock is paused. Take your time; nothing breaches while you think.</p>}

      {/* One layout group: the incident card on the stage and its chip in a queue share a layoutId. */}
      <LayoutGroup>
        <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_17rem]">
          <TeamQueues routed={routed} now={minutes} place={place} onOpen={(id) => setView({ kind: "resolve", id })} />

          <section aria-labelledby="stage-title" className="flex min-h-[20rem] min-w-0 flex-col gap-3">
            <h3 id="stage-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
              {stageTitle}
            </h3>
            {view.kind === "triage" && incoming ? (
              <TriageStage key={incoming.id} incident={incoming} arrivedAt={arrivedAt[routed.length] ?? minutes} routed={routed} onSubmit={onSubmit} />
            ) : view.kind === "routed" ? (
              <Routed routed={byId(view.id)} now={minutes}>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView({ kind: "resolve", id: view.id })}
                    className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
                  >
                    Resolve {view.id} now
                  </button>
                  {incoming && (
                    <button
                      type="button"
                      onClick={onNextIncident}
                      className="h-10 rounded-md border border-rule px-4 text-sm text-text transition-colors hover:bg-panel-2"
                    >
                      Next incident
                    </button>
                  )}
                </div>
              </Routed>
            ) : view.kind === "resolve" ? (
              <ResolveStage
                key={view.id}
                routed={byId(view.id)}
                now={minutes}
                lastEntry={[...decisionLog].reverse().find((e) => e.incidentId === view.id && e.kind === "action")}
                onAction={(a) => onAction(view.id, a)}
                next={nextSteps(view.id)}
              />
            ) : (
              nextSteps()
            )}
            {pattern && (
              <PatternEvent
                pattern={pattern}
                busy={patternBusy}
                onChoose={onPatternChoose}
                after={
                  <>
                    <KnowledgeSuggestion decision={pattern.knowledge} onAccept={() => onKnowledge("accepted")} onReject={() => onKnowledge("rejected")} />
                    {pattern.knowledge && (
                      <AutomationStudio
                        repeatBefore={repeatCount(pattern)}
                        kept={ruleKept}
                        onKeep={(rule, result, runs) => {
                          setRuleKept(true);
                          setDecisionLog((log) => [...log, finalRuleEntry(rule, result, runs, minutes)]);
                        }}
                      />
                    )}
                    {ruleKept && !caseOpen && (
                      <button
                        type="button"
                        onClick={() => setCaseOpen(true)}
                        className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
                      >
                        See the customer&rsquo;s side
                      </button>
                    )}
                  </>
                }
              />
            )}
            {caseOpen && (
              <CaseFlow
                now={minutes}
                parentResolved={parent === "resolved"}
                onLog={(entries) => setDecisionLog((log) => [...log, ...entries])}
                onResolveParent={onResolveParent}
              />
            )}
            {parent === "resolved" && !ended && (
              <button
                type="button"
                onClick={endShift}
                className="h-10 self-start rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
              >
                End the shift
              </button>
            )}
          </section>

          <ServiceMetrics log={decisionLog} />
        </div>
      </LayoutGroup>

      {ended && <ShiftSummary log={decisionLog} caseStudySlug={caseStudySlug} />}

      <DecisionLog entries={decisionLog} />
    </section>
  );
}

/** What happened to the incident just routed. A reassignment is a neutral cost, never "wrong". */
function Routed({ routed: r, now, children }: { routed: RoutedIncident; now: number; children: React.ReactNode }) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <div role="status" className="rounded-lg border border-rule bg-panel p-4 sm:p-5">
      <p ref={headingRef} tabIndex={-1} className="text-base text-text">
        {r.incident.id} routed to {teamById(r.chosenTeam).name}
      </p>
      <dl className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-text-faint">Priority</dt>
          <dd className={`mt-0.5 inline-flex rounded-md border px-2 py-0.5 font-mono text-sm ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-faint">SLA resolution target</dt>
          <dd className="mt-0.5 font-mono tabular-nums text-text">{r.target} simulated min</dd>
        </div>
        <div>
          <dt className="text-xs text-text-faint">Time left</dt>
          <dd className="mt-0.5 flex items-center gap-2 font-mono tabular-nums text-text">
            <CountdownRing routed={r} now={now} size={24} />
            {Math.max(0, minutesLeft(r, now))} min
          </dd>
        </div>
      </dl>
      {r.hops > 0 && (
        <p className="mt-3 rounded-md border border-rule bg-ink px-3 py-2 text-sm text-text-dim">
          Reassigned: +{r.hops} hop, {r.penaltyMinutes} simulated minutes used. Now with {teamById(r.team).name}.
        </p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function TeamQueues({ routed, now, place, onOpen }: { routed: RoutedIncident[]; now: number; place: Placement; onOpen: (id: string) => void }) {
  const resolved = routed.filter((r) => r.work.resolution);
  return (
    <section aria-labelledby="queues-title" className="rounded-lg border border-rule bg-panel p-4">
      <h3 id="queues-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
        Team queues
      </h3>
      <ul className="mt-3 space-y-4">
        {TEAMS.map((t: Team) => {
          const open = openCount(t, routed, place);
          const state = queueState(t, routed, now, place);
          const here = routed.filter((r) => isOpen(r) && place(r) === t.id);
          return (
            <li key={t.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-text">{t.name}</span>
                <span className="font-mono text-xs tabular-nums text-text-dim">
                  {open} / {t.capacity}
                  <span className="sr-only"> open incidents of capacity</span>
                </span>
              </div>
              <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel-2">
                <div
                  className={`h-full rounded-full ${SLA_FILL[state]} motion-safe:transition-[width,background-color] motion-safe:duration-500`}
                  style={{
                    width: `${Math.min(100, (open / t.capacity) * 100)}%`,
                  }}
                />
              </div>
              <p className={`mt-1 flex items-center gap-1.5 text-xs ${statusText[SLA_STATUS[state]]}`}>
                <span aria-hidden className={dotClass(SLA_STATUS[state])} />
                {SLA_LABEL[state]}
              </p>
              {here.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {here.map((r) => {
                    const left = minutesLeft(r, now);
                    return (
                      <motion.li
                        key={r.incident.id}
                        layoutId={incidentLayoutId(r.incident.id)}
                        transition={{
                          type: "spring",
                          stiffness: 260,
                          damping: 30,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onOpen(r.incident.id)}
                          aria-label={`Resolve ${r.incident.id}, ${r.priority}, ${left > 0 ? `${left} minutes left` : "SLA breached"}`}
                          className="flex w-full items-center gap-2 rounded-md border border-rule bg-ink px-2 py-1 text-left text-xs transition-colors hover:bg-panel-2"
                        >
                          <CountdownRing routed={r} now={now} size={18} />
                          <span className="font-mono text-text">{r.incident.id}</span>
                          <span className={`rounded border px-1 font-mono ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</span>
                          <span className="ml-auto font-mono tabular-nums text-text-dim">{left > 0 ? `${left} min` : "Breached"}</span>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {resolved.length > 0 && (
        <div className="mt-5 border-t border-rule pt-3">
          <h4 className="text-xs text-text-faint">Resolved this shift</h4>
          <ul className="mt-1.5 space-y-1">
            {resolved.map((r) => (
              <li key={r.incident.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-text-dim">{r.incident.id}</span>
                <span className={`font-mono tabular-nums ${r.work.resolution!.withinTarget ? "text-signal-teal" : "text-text-dim"}`}>
                  {r.work.resolution!.minutes} min
                  {r.work.resolution!.withinTarget ? "" : " · breached"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const METRIC_ROWS: {
  key: MetricKey;
  label: string;
  format: (v: number) => string;
}[] = [
  { key: "sla", label: "SLA compliance", format: (v) => `${v}%` },
  { key: "fcr", label: "First-contact resolution", format: (v) => `${v}%` },
  { key: "time", label: "Average resolution time", format: (v) => `${v} min` },
  { key: "csat", label: "CSAT", format: (v) => `${v.toFixed(1)} / 5` },
];
const METRIC_STATUS: Record<MetricState, Status> = {
  "on-target": "stable",
  "near-target": "warning",
  "below-target": "critical",
};

/** Metrics from the decision log's resolutions (formulas in model.ts), recomputed as the shift goes. */
function ServiceMetrics({ log }: { log: DecisionLogEntry[] }) {
  const values = computeMetrics(log);
  return (
    <section aria-labelledby="metrics-title" className="rounded-lg border border-rule bg-panel p-4">
      <h3 id="metrics-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
        Service metrics
      </h3>
      {!values && <p className="mt-2 text-xs text-text-faint">These fill in as incidents are resolved.</p>}
      <dl className="mt-3 space-y-4">
        {METRIC_ROWS.map((m) => {
          const v = values?.[m.key];
          const state = v === undefined ? null : metricState(m.key, v);
          return (
            <div key={m.key}>
              <dt className="flex items-center justify-between gap-2 text-xs text-text-dim">
                <span className="flex items-center gap-1.5">
                  {m.label} <InfoTip label={`How ${m.label} is calculated`} text={METRIC_FORMULAS[m.key]} />
                </span>
                <span className="font-mono text-[0.6875rem] text-text-faint">Simulated</span>
              </dt>
              <dd className="mt-0.5 font-mono text-xl font-medium tabular-nums text-text">
                {/* A changed value fades in: a subtle cue, instant under reduced motion. */}
                <motion.span key={v ?? "none"} initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }} className="inline-block">
                  {v === undefined ? "—" : m.format(v)}
                </motion.span>
              </dd>
              <dd className={`mt-0.5 flex items-center gap-1.5 text-xs ${state ? statusText[METRIC_STATUS[state]] : "text-text-faint"}`}>
                {state && <span aria-hidden className={dotClass(METRIC_STATUS[state])} />}
                {state ? METRIC_STATE_LABEL[state] : "No resolved incidents yet"}
                <span className="text-text-faint">· {METRIC_TARGETS[m.key].label}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** Every decision, oldest first, with its consequence. */
function DecisionLog({ entries }: { entries: DecisionLogEntry[] }) {
  return (
    <details open className="mt-4 rounded-lg border border-rule bg-panel p-4">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-text-faint">Decision log ({entries.length})</summary>
      {entries.length ? (
        <ol className="mt-3 space-y-1.5 text-sm">
          {entries.map((e, i) => (
            <li key={i} className="grid grid-cols-[3.25rem_5rem_minmax(0,1fr)] gap-x-3">
              <span className="font-mono tabular-nums text-text-faint">{e.time}</span>
              <span className="font-mono text-text-dim">{e.incidentId}</span>
              <span className="min-w-0 text-text">
                {e.decision} <span className="text-text-dim">· {e.consequence}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-text-faint">Decisions appear here as you triage and resolve.</p>
      )}
    </details>
  );
}

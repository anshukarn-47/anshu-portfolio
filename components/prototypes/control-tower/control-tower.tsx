"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasProps } from "@/components/prototypes/canvases";
import { StatusPill } from "@/components/ui/status-pill";
import { dotClass, statusText } from "@/components/prototypes/engine/status";
import {
  EXCEPTION,
  INCOMING,
  INITIAL,
  M2_CHOICES,
  MISSION,
  formatClock,
  inr,
  reassignTruck,
  investigationMinutes,
  balanceChanges,
  balanceFrom,
  M3_CHOICES,
  QUALITY_SCORE_START,
  QUALITY_SHIPMENT,
  type IntegrityCheck,
  type IntegrityConclusion,
  type M3Choice,
  type DecisionLogEntry,
  type InvestigationId,
  type M2Choice,
} from "./model";
import { MissionSaveNetwork, M2_START, type M2State } from "./mission-save-network";
import { NetworkBalance } from "./network-balance";
import { MissionQuality, M3_START, type M3State } from "./mission-quality";
import type { LiveNumbers } from "./integration-view";
import type { MapOverlay } from "./network-map";
import { MissionFillTruck, type DispatchResult } from "./mission-fill-truck";
import { NetworkMap } from "./network-map";
import { DEFAULT_RULE, StrategyMode } from "./strategy-mode";
import { approvalBalance, currentQueue, ruleEffect, type Candidate, type DispatcherState, type Rule, type RuleEffect } from "./strategy";
import {
  approvedEntry,
  dispatchEntry,
  exceptionEntry,
  integrityCheckEntry,
  integrityConclusionEntry,
  investigateEntry,
  policyEntry,
  policyOffEntry,
  qualityEntry,
  rejectedEntry,
} from "./ending";
import { ShiftEnd } from "./shift-end";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";

/**
 * TOWER // 24 canvas: the mission briefing, then the control tower (status
 * bar, network map, dashboard panels, Missions 01–03 and Strategy Mode), then
 * the end-of-shift summary once the player ends the shift.
 */
export function ControlTower({ caseStudy, onComplete }: CanvasProps) {
  const [phase, setPhase] = useState<"briefing" | "tower">("briefing");
  return phase === "briefing" ? <Briefing onEnter={() => setPhase("tower")} /> : <Tower caseStudy={caseStudy} onComplete={onComplete} />;
}

// --- Mission briefing -------------------------------------------------------------

function Briefing({ onEnter }: { onEnter: () => void }) {
  return (
    <section aria-labelledby="tower-briefing-title" className="flex min-h-[36rem] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-signal-blue">Mission {MISSION.number}</p>
      <h2 id="tower-briefing-title" className="mt-3 text-3xl sm:text-4xl">
        Mission {MISSION.number} — {MISSION.name}
      </h2>
      <p className="mt-3 max-w-md text-text-dim">
        <span className="font-mono text-text">{MISSION.startClock}.</span> Your distribution network has {MISSION.hours} hours to
        fulfill today&apos;s demand.
      </p>

      <dl className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {MISSION.resources.map((r) => (
          <div key={r.label} className="rounded-lg border border-rule bg-panel px-4 py-3 text-left">
            <dt className="text-xs text-text-faint">{r.label}</dt>
            <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-text">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 w-full max-w-2xl rounded-lg border border-rule bg-panel px-4 py-3 text-left">
        <p className="font-mono text-xs uppercase tracking-wider text-text-faint">Objective</p>
        <p className="mt-1 text-sm text-text">{MISSION.objective}.</p>
      </div>

      <button
        type="button"
        onClick={onEnter}
        className="mt-10 h-11 rounded-md bg-text px-6 text-sm font-medium text-ink transition-opacity hover:opacity-90"
      >
        Enter control tower
      </button>
    </section>
  );
}

// --- Control tower shell --------------------------------------------------------------

function Tower({ caseStudy, onComplete }: { caseStudy: PrototypeCaseStudy | null; onComplete: () => void }) {
  const caseOutcome = caseStudy?.outcome ?? null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  // One clock for the tower (the status bar and decision-log time labels).
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  // The decision log: every decision, structured for the ending (summary, operating style, Decision Replay).
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  const logEntry = (e: Omit<DecisionLogEntry, "time">) => setDecisionLog((log) => [...log, { time: `T+${formatClock(seconds)}`, ...e }]);

  // Mission 01 result.
  const [dispatch, setDispatch] = useState<DispatchResult | null>(null);
  const onDispatch = (r: DispatchResult) => {
    setDispatch(r);
    logEntry(dispatchEntry(r.impact, r.loaded));
  };
  const m1Truck = dispatch?.impact.truck.id ?? null;

  // Mission 02: started on demand after Mission 01, then one choice.
  const [m2, setM2] = useState<M2State>(M2_START);
  const onStartM2 = () => setM2({ ...M2_START, started: true });
  const onInvestigate = (id: InvestigationId) => {
    if (m2.investigated.includes(id)) return;
    setM2((s) => ({ ...s, investigated: [...s.investigated, id] }));
    logEntry(investigateEntry(id, m1Truck));
  };
  const onDecideM2 = () => setM2((s) => ({ ...s, deciding: true }));
  const onChooseM2 = (choice: M2Choice) => {
    setM2((s) => ({ ...s, choice }));
    logEntry(exceptionEntry(choice, m1Truck));
  };
  const investigatingMinutes = investigationMinutes(m2.investigated);

  // Mission 03: started on demand after Mission 02; the shipment hits the density exception on arrival.
  const [m3, setM3] = useState<M3State>(M3_START);
  const onStartM3 = () => setM3({ ...M3_START, started: true, phase: "transit" });
  const onArriveM3 = useCallback(() => setM3((s) => (s.phase === "transit" ? { ...s, phase: "exception" } : s)), []);
  const onChooseM3 = (choice: M3Choice) => {
    setM3((s) => ({ ...s, phase: "resolved", choice }));
    logEntry(qualityEntry(choice));
  };
  const onOpenIntegrity = () => setM3((s) => ({ ...s, integrity: { ...s.integrity, open: true } }));
  const onCheckIntegrity = (id: IntegrityCheck) => {
    if (m3.integrity.checked.includes(id)) return;
    setM3((s) => ({ ...s, integrity: { ...s.integrity, checked: [...s.integrity.checked, id] } }));
    logEntry(integrityCheckEntry(id));
  };
  const onConcludeIntegrity = (conclusion: IntegrityConclusion) => {
    setM3((s) => ({ ...s, integrity: { ...s.integrity, conclusion } }));
    logEntry(integrityConclusionEntry(conclusion));
  };

  // Strategy Mode (after Mission 02): a control policy frozen at activation, and the copilot's approved / rejected consolidations.
  const [rules, setRules] = useState<Rule[]>([DEFAULT_RULE]);
  const [policy, setPolicy] = useState<RuleEffect[] | null>(null);
  const [approved, setApproved] = useState<Candidate[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const consolidated = approved.flatMap((c) => [c.a.id, c.b.id]);
  const queue = currentQueue({ m1Loaded: dispatch?.loaded ?? null, consolidated });
  const dispatcherState: DispatcherState = {
    m1Loaded: dispatch?.loaded ?? null,
    m2: m2.choice,
    rules: policy ? policy.map((e) => e.rule) : [],
    consolidated,
    rejected,
  };
  const onActivatePolicy = () => {
    const effects = rules.map((r) => ruleEffect(r, queue, m2.choice));
    setPolicy(effects);
    for (const e of effects) logEntry(policyEntry(e, queue));
  };
  const onRevisePolicy = () => {
    setRules(policy!.map((e) => e.rule));
    setPolicy(null);
    // Reverse the tallies of the rules activated since the last switch-off.
    const active: DecisionLogEntry[] = [];
    for (let i = decisionLog.length - 1; i >= 0 && decisionLog[i].kind !== "policy-off"; i--) if (decisionLog[i].kind === "policy") active.push(decisionLog[i]);
    logEntry(policyOffEntry(active));
  };
  const onApprove = (c: Candidate) => {
    setApproved((a) => [...a, c]);
    logEntry(approvedEntry(c));
  };
  const onReject = (c: Candidate) => {
    setRejected((r) => [...r, c.id]);
    logEntry(rejectedEntry(c));
  };
  const policyCost = policy?.reduce((s, e) => s + e.cost, 0) ?? 0;
  const policySla = policy?.reduce((s, e) => s + e.slaDelta, 0) ?? 0;
  const reserved = policy?.reduce((s, e) => s + e.fleetReserved, 0) ?? 0;
  const saved = approved.reduce((s, c) => s + c.saving, 0);

  // Everything on the dashboard derives from the starting values plus each mission's outcome.
  const impact = dispatch?.impact;
  const m2Open = m2.started && !m2.choice; // the exception is live
  const m2Result = m2.choice ? M2_CHOICES[m2.choice] : null;
  const m3Open = m3.phase === "exception";
  const m3Result = m3.choice ? M3_CHOICES[m3.choice] : null;
  const stats = {
    networkHealth: INITIAL.networkHealth + (impact?.healthDelta ?? 0) + (m2Result?.healthDelta ?? 0) + (m3Result?.healthDelta ?? 0),
    cost: INITIAL.cost + (impact?.consolidatedCost ?? 0) + (m2Result?.cost ?? 0) + (m3Result?.cost ?? 0) + policyCost - saved,
    sla: Math.min(100, INITIAL.sla + (impact?.slaDelta ?? 0) + (m2Result?.slaDelta ?? 0) + (m3Result?.slaDelta ?? 0) + policySla),
    quality: m3.started ? QUALITY_SCORE_START + (m3Result?.qualityDelta ?? 0) : null,
  };
  const exceptions = {
    unresolved:
      INITIAL.exceptions.unresolved + (impact?.newExceptions ?? 0) + (m2Open ? 1 : (m2Result?.exceptions.unresolved ?? 0)) + (m3Open ? 1 : 0),
    critical: INITIAL.exceptions.critical + (impact?.newCritical ?? 0) + (m2Open ? 1 : (m2Result?.exceptions.critical ?? 0)),
  };
  // Reassign puts a spare truck on the road, so one more truck leaves a depot. A Reserve Fleet rule holds one back;
  // each approved consolidation frees the truck the second run would have used.
  const extraOut = (impact ? 1 : 0) + (m2.choice === "reassign" ? 1 : 0);
  const fleet = { available: INITIAL.fleet.available - extraOut - reserved + approved.length, inTransit: INITIAL.fleet.inTransit + extraOut };
  const lastEntry = decisionLog.at(-1);
  const changes = [
    ...balanceChanges(impact ?? null, m2.choice, m3.choice),
    ...(policy ?? []).flatMap((e) => (e.balance ? [e.balance] : [])),
    ...approved.map(approvalBalance),
  ];
  const balance = balanceFrom(changes);

  // What the map shows. Mission 02: TR-104 stalled while open (and on Hold), moving once rerouted, the spare truck
  // if reassigned. Mission 03: TK-31 stopped at the D2 gauge during the quality exception, and after a Hold.
  const m2Stalled = m2Open || m2.choice === "hold";
  const m3Stalled = m3Open || m3.choice === "hold";
  const overlay: MapOverlay = {
    routeRisk: m2Open ? { [`${EXCEPTION.route[0]}-${EXCEPTION.route[1]}`]: EXCEPTION.riskValue } : (m2Result?.routeRisk ?? {}),
    stalled: [
      ...(m2Stalled ? [{ id: EXCEPTION.truck, route: EXCEPTION.route }] : []),
      ...(m3Stalled ? [{ id: QUALITY_SHIPMENT.truck, route: [QUALITY_SHIPMENT.from, QUALITY_SHIPMENT.to] as [string, string] }] : []),
    ],
    trucks:
      m2.choice === "reroute"
        ? [{ id: EXCEPTION.truck, path: [...EXCEPTION.route], phase: 0 }]
        : m2.choice === "reassign"
          ? [{ id: reassignTruck(impact?.truck.id ?? null), path: [...EXCEPTION.route], phase: 0 }]
          : [],
  };

  // Mock live data for the Integration View reads the same numbers as the dashboard.
  const live: LiveNumbers = {
    exceptionsUnresolved: exceptions.unresolved,
    exceptionsCritical: exceptions.critical,
    fleetAvailable: fleet.available,
    fleetInTransit: fleet.inTransit,
    vehicleAlert: m3Open ? `${QUALITY_SHIPMENT.truck}: density variance at D2` : m2Stalled ? `${EXCEPTION.truck}: coolant leak` : null,
  };

  // End of the shift: the ending replaces the tower, and Case study mode unlocks.
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const onEndShift = () => {
    setEndedAt(seconds);
    onComplete();
  };
  if (endedAt !== null) return <ShiftEnd seconds={endedAt} log={decisionLog} stats={stats} caseStudy={caseStudy} />;

  return (
    <section aria-labelledby="tower-title" className="p-4 sm:p-6">
      <StatusBar headingRef={headingRef} seconds={seconds} stats={stats} investigatingMinutes={investigatingMinutes} />
      <NetworkMap dispatchedTruck={impact?.truck.id ?? null} overlay={overlay} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="Shipments">
          <Counts items={[{ label: "Active", value: INITIAL.shipments.active }, { label: "Urgent", value: INITIAL.shipments.urgent, tone: "warning" }]} />
        </Panel>
        <Panel title="Exceptions">
          <Counts
            items={[
              { label: "Unresolved", value: exceptions.unresolved, tone: "warning" },
              { label: "Critical", value: exceptions.critical, tone: "critical" },
            ]}
          />
        </Panel>
        <Panel title="Fleet">
          <Counts items={[{ label: "Available", value: fleet.available }, { label: "In transit", value: fleet.inTransit }]} />
        </Panel>
        <section aria-labelledby="console-title" className="rounded-lg border border-rule bg-panel p-4">
          <h3 id="console-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
            Decision console
          </h3>
          {m3Open ? (
            <p className="mt-3 text-sm text-signal-red">
              <a href="#mission-03" className="underline decoration-rule underline-offset-4">
                Quality exception
              </a>{" "}
              on shipment #{QUALITY_SHIPMENT.id} at D2.
            </p>
          ) : m2Open ? (
            <p className="mt-3 text-sm text-signal-red">
              <a href="#mission-02" className="underline decoration-rule underline-offset-4">
                Exception: {EXCEPTION.truck} delayed
              </a>
              , two orders at SLA risk.
            </p>
          ) : lastEntry ? (
            <p className="mt-3 text-sm text-text-dim">
              <span className="font-mono text-xs tabular-nums text-text-faint">{lastEntry.time}</span>{" "}
              {lastEntry.description.replace(/^Mission \d+: /, "")}
            </p>
          ) : (
            <p className="mt-3 text-sm text-text-dim">
              <a href="#mission" className="text-text underline decoration-rule underline-offset-4 hover:decoration-signal-teal">
                Mission 01: order #{INCOMING.id}
              </a>{" "}
              is waiting for a truck.
            </p>
          )}
        </section>
      </div>

      <NetworkBalance balance={balance} changes={changes} />

      <section id="mission" aria-labelledby="mission-title" className="mt-6 scroll-mt-24">
        <h3 id="mission-title" className="text-lg">
          Mission 01 — Fill the Truck
        </h3>
        <div className="mt-3">
          <MissionFillTruck result={dispatch} onDispatch={onDispatch} />
        </div>
      </section>

      {dispatch && (
        <section id="mission-02" aria-labelledby="mission-02-title" className="mt-8 scroll-mt-24">
          <h3 id="mission-02-title" className="text-lg">
            Mission 02 — Save the Network
          </h3>
          <div className="mt-3">
            <MissionSaveNetwork
              state={m2}
              m1Truck={impact?.truck.id ?? null}
              onStart={onStartM2}
              onInvestigate={onInvestigate}
              onDecide={onDecideM2}
              onChoose={onChooseM2}
            />
          </div>
        </section>
      )}

      {m2.choice && (
        <section id="mission-03" aria-labelledby="mission-03-title" className="mt-8 scroll-mt-24">
          <h3 id="mission-03-title" className="text-lg">
            Mission 03 — Quality and Integrity
          </h3>
          <div className="mt-3">
            <MissionQuality
              state={m3}
              live={live}
              caseOutcome={caseOutcome}
              onStart={onStartM3}
              onArrive={onArriveM3}
              onChoose={onChooseM3}
              onOpenIntegrity={onOpenIntegrity}
              onCheck={onCheckIntegrity}
              onConclude={onConcludeIntegrity}
            />
          </div>
        </section>
      )}

      {m2.choice && (
        <section id="strategy" aria-labelledby="strategy-title" className="mt-8 scroll-mt-24">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="strategy-title" className="text-lg">
              Strategy Mode
            </h3>
            <StatusPill tone="live">Unlocked</StatusPill>
          </div>
          <div className="mt-3">
            <StrategyMode
              queue={queue}
              m2={m2.choice}
              rules={rules}
              onRulesChange={setRules}
              policy={policy}
              onActivate={onActivatePolicy}
              onRevise={onRevisePolicy}
              dispatcherState={dispatcherState}
              consolidatedCount={consolidated.length}
              onApprove={onApprove}
              onReject={onReject}
            />
          </div>
        </section>
      )}

      {m3.choice && (
        <section aria-labelledby="end-shift-title" className="mt-8 rounded-lg border border-rule bg-panel p-4 sm:p-5">
          <h3 id="end-shift-title" className="text-lg">
            Close out the shift
          </h3>
          <p className="mt-1 max-w-prose text-sm text-text-dim">
            Missions 01 to 03 are resolved. Strategy Mode is optional: set a policy or try the AI Dispatcher first if you like. Ending the shift
            shows your 24-hour operating summary and the real product behind TOWER // 24.
          </p>
          <button
            type="button"
            onClick={onEndShift}
            className="mt-3 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            End shift
          </button>
        </section>
      )}
    </section>
  );
}

/** Incident-style header: elapsed time, network health, cost and SLA. */
function StatusBar({
  headingRef,
  seconds,
  stats: s,
  investigatingMinutes,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  seconds: number;
  stats: { networkHealth: number; cost: number; sla: number; quality: number | null };
  /** Decision time spent investigating (a stat until there's a mission clock). */
  investigatingMinutes: number;
}) {
  const stats = [
    { label: "Network health", value: `${s.networkHealth}%`, changed: s.networkHealth !== INITIAL.networkHealth },
    { label: "Cost", value: inr.format(s.cost), changed: s.cost !== INITIAL.cost },
    { label: "SLA", value: `${s.sla}%`, changed: s.sla !== INITIAL.sla },
    ...(investigatingMinutes ? [{ label: "Investigating", value: `${investigatingMinutes} min`, changed: true }] : []),
    ...(s.quality !== null ? [{ label: "Quality", value: String(s.quality), changed: s.quality !== QUALITY_SCORE_START }] : []),
  ];

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="tower-title" ref={headingRef} tabIndex={-1} className="text-xl">
          Control tower
        </h2>
        <StatusPill tone="live">
          Mission {MISSION.number} · {MISSION.name}
        </StatusPill>
      </div>
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2">
          <dt className="sr-only">Elapsed time</dt>
          <dd className="font-mono text-sm tabular-nums text-text-dim">T+{formatClock(seconds)}</dd>
        </div>
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <dt className="text-xs text-text-faint">{s.label}</dt>
            <dd className={`font-mono text-sm tabular-nums ${s.changed ? "text-signal-blue" : "text-text"}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

// --- Panels -----------------------------------------------------------------------------

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border border-rule bg-panel p-4">
      <h3 className="font-mono text-xs uppercase tracking-wider text-text-faint">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Counts({ items }: { items: { label: string; value: number; tone?: "warning" | "critical" }[] }) {
  return (
    <dl className="flex gap-6">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="flex items-center gap-1.5 text-xs text-text-dim">
            {i.tone && <span aria-hidden className={dotClass(i.tone)} />}
            {i.label}
          </dt>
          <dd className={`mt-0.5 font-mono text-2xl font-medium tabular-nums ${i.tone && i.value > 0 ? statusText[i.tone] : "text-text"}`}>
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

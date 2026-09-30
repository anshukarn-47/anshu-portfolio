"use client";

import { useEffect, useRef } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { dotClass } from "@/components/prototypes/engine/status";
import {
  CUSTOMER_TYPES,
  EXCEPTION,
  M2_CHOICES,
  NODE_CUSTOMERS,
  breachesSla,
  customerImpactSentence,
  inr,
  m2Text,
  INVESTIGATIONS,
  investigationMinutes,
  type CustomerType,
  type InvestigationId,
  type M2Choice,
} from "./model";

/** Mission 02 progress: started, investigations run so far, whether the choices are showing, and the choice. */
export type M2State = { started: boolean; investigated: InvestigationId[]; deciding: boolean; choice: M2Choice | null };
export const M2_START: M2State = { started: false, investigated: [], deciding: false, choice: null };

const TYPE_TONE: Record<CustomerType, "critical" | "alert" | "idle"> = { critical: "critical", standard: "idle", flexible: "idle" };

/**
 * Mission 02 — Save the Network. Starts on demand after Mission 01; an
 * exception on TR-104 puts two orders at SLA risk. First an Investigate step
 * (each check reveals context and costs decision time), then one of three
 * choices with fixed consequences (M2_CHOICES). Afterwards, the Customer Impact
 * panel shows who was protected and who was affected.
 */
export function MissionSaveNetwork({
  state,
  m1Truck,
  onStart,
  onInvestigate,
  onDecide,
  onChoose,
}: {
  state: M2State;
  /** The truck Mission 01 dispatched (decides which truck Reassign uses). */
  m1Truck: string | null;
  onStart: () => void;
  onInvestigate: (id: InvestigationId) => void;
  onDecide: () => void;
  onChoose: (c: M2Choice) => void;
}) {
  if (!state.started) {
    return (
      <div className="rounded-lg border border-dashed border-rule p-4">
        <p className="text-sm text-text-dim">The network is moving again. Something will go wrong soon; it always does.</p>
        <button
          type="button"
          onClick={onStart}
          className="mt-3 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
        >
          Start Mission 02
        </button>
      </div>
    );
  }
  if (state.choice) return <CustomerImpact choice={state.choice} minutes={investigationMinutes(state.investigated)} />;
  return (
    <div className="space-y-4">
      <ExceptionAlert />
      <Investigate state={state} m1Truck={m1Truck} onInvestigate={onInvestigate} onDecide={onDecide} />
      {state.deciding && <Choices m1Truck={m1Truck} onChoose={onChoose} />}
    </div>
  );
}

function ExceptionAlert() {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => alertRef.current?.focus(), []);
  return (
    <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-lg border border-signal-red bg-panel p-4">
      <p className="text-sm font-medium text-signal-red">
        <span aria-hidden>⚠ </span>Exception detected.
      </p>
      <p className="mt-1 text-sm text-text">
        Truck {EXCEPTION.truck} has reported a delivery delay. Two orders are now at SLA risk.
      </p>
      <ul className="mt-3 space-y-2">
        {EXCEPTION.orders.map((o) => {
          const c = NODE_CUSTOMERS[o.customer];
          const t = CUSTOMER_TYPES[c.type];
          return (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule bg-ink px-3 py-2 text-sm">
              <span>
                <span className="font-mono text-text">#{o.id}</span> <span className="text-text-dim">{c.name}</span>
                <span className="block text-xs text-text-faint">
                  {t.label} · tolerates about {t.toleranceMinutes >= 60 ? `${t.toleranceMinutes / 60} hours` : `${t.toleranceMinutes} minutes`}
                </span>
              </span>
              <StatusPill tone={TYPE_TONE[c.type]}>{t.sla} SLA</StatusPill>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Investigate first: each check once, revealing one more piece of context for some decision time. */
function Investigate({
  state,
  m1Truck,
  onInvestigate,
  onDecide,
}: {
  state: M2State;
  m1Truck: string | null;
  onInvestigate: (id: InvestigationId) => void;
  onDecide: () => void;
}) {
  const minutes = investigationMinutes(state.investigated);
  const findings = INVESTIGATIONS.filter((i) => state.investigated.includes(i.id)).sort(
    (a, b) => state.investigated.indexOf(a.id) - state.investigated.indexOf(b.id)
  );
  return (
    <section aria-labelledby="investigate-title" className="rounded-lg border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 id="investigate-title" className="text-base">
          Investigate
        </h4>
        <span className="font-mono text-xs tabular-nums text-text-dim">
          Time spent investigating: <span className="text-text">{minutes} min</span>
        </span>
      </div>
      {!state.deciding && (
        <>
          <p className="mt-1 text-sm text-text-dim">Each check tells you more, and takes time. Investigate as much as you think you need, then make the call.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {INVESTIGATIONS.map((i) => {
              const done = state.investigated.includes(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  disabled={done}
                  onClick={() => onInvestigate(i.id)}
                  className="flex items-center justify-between gap-3 rounded-md border border-rule bg-ink px-3 py-2 text-left text-sm text-text transition-colors hover:border-text-faint hover:bg-panel-2 disabled:cursor-default disabled:text-text-faint disabled:hover:border-rule disabled:hover:bg-ink"
                >
                  <span>
                    {done && <span className="sr-only">Done: </span>}
                    {i.label}
                  </span>
                  <span className="font-mono text-xs text-text-faint">{done ? "✓" : `+${i.minutes} min`}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {findings.length > 0 && (
        <ol aria-live="polite" className="mt-3 space-y-2">
          {findings.map((f) => (
            <li key={f.id} className="border-l-2 border-signal-blue pl-3 text-sm">
              <span className="block text-xs text-text-faint">{f.label}</span>
              <span className="text-text">{m2Text(f.finding, m1Truck)}</span>
            </li>
          ))}
        </ol>
      )}

      {!state.deciding && (
        <button
          type="button"
          onClick={onDecide}
          className="mt-4 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
        >
          {state.investigated.length ? "Make the call" : "Skip investigating and decide"}
        </button>
      )}
    </section>
  );
}

function Choices({ m1Truck, onChoose }: { m1Truck: string | null; onChoose: (c: M2Choice) => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section aria-labelledby="choices-title">
      <h4 id="choices-title" ref={headingRef} tabIndex={-1} className="text-base">
        Your response
      </h4>
      <div role="group" aria-labelledby="choices-title" className="mt-2 grid gap-3 sm:grid-cols-3">
        {(Object.keys(M2_CHOICES) as M2Choice[]).map((k) => {
          const c = M2_CHOICES[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChoose(k)}
              className="flex flex-col rounded-lg border border-rule bg-panel p-4 text-left transition-colors hover:border-text-faint hover:bg-panel-2"
            >
              <span className="text-base font-medium text-text">{c.label}</span>
              <span className="mt-0.5 text-xs text-signal-blue">{c.summary}</span>
              <span className="mt-2 text-sm text-text-dim">{m2Text(c.hint, m1Truck)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Who this decision protected and who it affected, by customer segment. */
function CustomerImpact({ choice, minutes }: { choice: M2Choice; minutes: number }) {
  const c = M2_CHOICES[choice];
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const protectedList = c.customers.filter((e) => e.outcome === "protected");
  const affected = c.customers.filter((e) => e.outcome === "delayed");

  return (
    <section aria-labelledby="customer-impact-title" className="rounded-lg border border-rule bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 id="customer-impact-title" ref={headingRef} tabIndex={-1} className="text-lg">
          Customer impact
        </h4>
        <span className="text-sm text-text-dim">
          You chose <span className="text-text">{c.label}</span> · {c.cost ? `+${inr.format(c.cost)}` : "no extra cost"} · {minutes} min investigating
        </span>
      </div>
      <p className="mt-2 text-base text-text">{customerImpactSentence(choice)}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Segment title="Protected" empty="No one was protected by this decision." items={protectedList} />
        <Segment title="Affected" empty="No customer was affected." items={affected} />
      </div>
      <p className="mt-4 text-xs text-text-faint">Mission 02 complete. Mission 03 and Strategy Mode are below.</p>
    </section>
  );
}

function Segment({ title, empty, items }: { title: string; empty: string; items: { customer: string; outcome: string; minutes?: number }[] }) {
  return (
    <div>
      <h5 className="font-mono text-xs uppercase tracking-wider text-text-faint">{title}</h5>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-faint">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((e) => {
            const cust = NODE_CUSTOMERS[e.customer];
            const t = CUSTOMER_TYPES[cust.type];
            const breach = e.outcome === "delayed" && breachesSla(e.customer, e.minutes);
            const status = e.outcome === "protected" ? "stable" : breach ? "critical" : "warning";
            return (
              <li key={e.customer} className="rounded-md border border-rule bg-ink px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-text">
                  <span aria-hidden className={dotClass(status)} />
                  {cust.name}
                </span>
                <span className="mt-0.5 block text-xs text-text-dim">
                  {t.label} · {t.sla} SLA, {t.impact.toLowerCase()} business impact
                </span>
                <span className={`mt-1 block text-xs ${status === "stable" ? "text-signal-teal" : status === "critical" ? "text-signal-red" : "text-signal-amber"}`}>
                  {e.outcome === "protected"
                    ? "On time"
                    : `${e.minutes} minutes late · ${breach ? "SLA breached" : "within its tolerance"}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BACK_OFFICE,
  CASE_CALLOUT,
  CASE_STATUS_LABEL,
  CHIPS,
  CHIP_ORDER,
  CUSTOMER_CASE,
  INTEGRATION_HOP_MS,
  MESSAGE_GREETING,
  MESSAGE_SIGNOFF,
  PARENT_INCIDENT,
  PROBLEM,
  backOfficeEntry,
  caseCreatedEntry,
  csatChange,
  formatChange,
  messageChips,
  messageEntry,
  type CaseStatus,
  type ChipId,
  type DecisionLogEntry,
} from "./model";

const CASE_STATUS_DOT: Record<CaseStatus, string> = {
  new: "bg-signal-blue",
  "in-progress": "bg-signal-blue",
  "awaiting-fix": "bg-signal-amber",
  resolved: "bg-signal-teal",
};

/**
 * The linked customer case, after the problem record: the customer reports the
 * failure in the portal, CASE-3307 is created, a back-office check runs
 * through the proposed integration, the player writes the customer update,
 * then resolving the parent incident updates the case automatically.
 */
export function CaseFlow({
  now,
  parentResolved,
  onLog,
  onResolveParent,
}: {
  now: number;
  parentResolved: boolean;
  onLog: (entries: DecisionLogEntry[]) => void;
  onResolveParent: () => void;
}) {
  const [created, setCreated] = useState(false);
  const [check, setCheck] = useState<"needed" | "running" | "done">("needed");
  const [selected, setSelected] = useState<ChipId[]>([]);
  const [sent, setSent] = useState(false);
  const status: CaseStatus = !created ? "new" : !sent ? "in-progress" : parentResolved ? "resolved" : "awaiting-fix";

  const caseHeading = useRef<HTMLHeadingElement>(null);
  const linkedHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (created) caseHeading.current?.focus();
  }, [created]);
  useEffect(() => {
    if (sent) linkedHeading.current?.focus();
  }, [sent]);

  if (!created)
    return (
      <Portal
        onSubmit={() => {
          setCreated(true);
          onLog([caseCreatedEntry(now)]);
        }}
      />
    );

  return (
    <section aria-labelledby="case-title" className="space-y-3">
      <article className="rounded-lg border border-rule bg-panel p-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-text-faint">Customer service case</p>
            <h4 id="case-title" ref={caseHeading} tabIndex={-1} className="mt-0.5 font-mono text-lg">
              {CUSTOMER_CASE.id}
            </h4>
          </div>
          <CaseStatusBadge status={status} />
        </header>
        <p className="mt-2 text-sm text-text">&ldquo;{CUSTOMER_CASE.report}&rdquo;</p>
        <p className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-rule px-2 py-0.5 font-mono text-text-dim">
            {PARENT_INCIDENT} · {parentResolved ? "Resolved" : "Reopened"}
          </span>
          <span className="rounded-md border border-rule px-2 py-0.5 font-mono text-text-dim">{PROBLEM.id} · Root cause investigation</span>
        </p>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-faint">Customer</dt>
            <dd className="mt-0.5 text-text">
              {CUSTOMER_CASE.customer.name} · {CUSTOMER_CASE.customer.tier} tier
            </dd>
            <dd className="text-xs text-text-dim">{CUSTOMER_CASE.customer.since}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-faint">Case owner</dt>
            <dd className="mt-0.5 text-text">{CUSTOMER_CASE.owner}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-faint">Service commitment</dt>
            <dd className="mt-0.5 text-text">{CUSTOMER_CASE.commitment}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-faint">Case history</dt>
            {CUSTOMER_CASE.history.map((h) => (
              <dd key={h.id} className="mt-0.5 text-text">
                <span className="font-mono text-xs text-text-dim">{h.id}</span> {h.summary}
                <span className="text-text-dim"> · {h.outcome}</span>
              </dd>
            ))}
          </div>
        </dl>
      </article>

      <BackOfficeCheck
        state={check}
        onRun={() => setCheck("running")}
        onDone={() => {
          setCheck("done");
          onLog([backOfficeEntry(now)]);
        }}
      />

      {check === "done" && (
        <MessageBuilder
          selected={selected}
          sent={sent}
          onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
          onSend={() => {
            setSent(true);
            onLog([messageEntry(selected, now)]);
          }}
        />
      )}

      {sent && (
        <section aria-labelledby="linked-title" className="rounded-lg border border-rule bg-panel p-4">
          <h4 id="linked-title" ref={linkedHeading} tabIndex={-1} className="text-base">
            Linked status
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-rule bg-ink p-3">
              <p className="text-xs text-text-faint">Service view · incident</p>
              <p className="mt-1 font-mono text-sm text-text">{PARENT_INCIDENT}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text">
                <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${parentResolved ? "bg-signal-teal" : "bg-signal-amber"}`} />
                {parentResolved ? "Resolved: workaround applied" : "Reopened, in progress"}
              </p>
              {!parentResolved && (
                <button
                  type="button"
                  onClick={onResolveParent}
                  className="mt-3 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
                >
                  Apply the workaround and resolve {PARENT_INCIDENT}
                </button>
              )}
            </div>
            <div className="rounded-md border border-rule bg-ink p-3">
              <p className="text-xs text-text-faint">Customer view · case</p>
              <p className="mt-1 font-mono text-sm text-text">{CUSTOMER_CASE.id}</p>
              <div className="mt-1" aria-live="polite">
                <CaseStatusBadge status={status} />
              </div>
              {parentResolved && <p className="mt-2 text-xs text-text-dim">Updated automatically from {PARENT_INCIDENT}. It closes when the customer confirms.</p>}
            </div>
          </div>
          {parentResolved && <p className="mt-3 border-l-2 border-signal-blue pl-3 text-sm text-text">{CASE_CALLOUT}</p>}
        </section>
      )}
    </section>
  );
}

function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={status}
      initial={reduce ? false : { opacity: 0.3 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="inline-flex items-center gap-1.5 rounded-md border border-rule px-2 py-0.5 text-xs text-text"
    >
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${CASE_STATUS_DOT[status]}`} />
      {CASE_STATUS_LABEL[status]}
    </motion.span>
  );
}

/** A compact customer portal (mobile-width card, original design) where the customer reports the failure. */
function Portal({ onSubmit }: { onSubmit: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section aria-labelledby="portal-title" className="space-y-2">
      <p className="text-xs text-text-faint">Meanwhile, one of the affected customers gets in touch.</p>
      <div className="mx-auto w-full max-w-[22rem] overflow-hidden rounded-2xl border border-rule bg-ink shadow-lg">
        <div className="flex items-center justify-between border-b border-rule bg-panel px-4 py-2">
          <span className="text-sm font-medium text-text">Helio help</span>
          <span className="text-xs text-text-faint">{CUSTOMER_CASE.customer.name}</span>
        </div>
        <div className="space-y-3 p-4">
          <h4 id="portal-title" ref={headingRef} tabIndex={-1} className="text-base">
            Report a problem
          </h4>
          <div>
            <p className="text-xs text-text-faint">Topic</p>
            <p className="mt-0.5 rounded-md border border-rule bg-panel px-3 py-2 text-sm text-text">Payments</p>
          </div>
          <div>
            <p className="text-xs text-text-faint">What happened?</p>
            <p className="mt-0.5 rounded-md border border-rule bg-panel px-3 py-2 text-sm text-text">{CUSTOMER_CASE.report}</p>
          </div>
          <button type="button" onClick={onSubmit} className="h-10 w-full rounded-full bg-signal-blue text-sm font-medium text-ink transition-opacity hover:opacity-90">
            Send as the customer
          </button>
        </div>
      </div>
    </section>
  );
}

// --- Back-office check: the integration animation ----------------------------------------------------

/** Diagram positions (percent of the diagram box): top to bottom, so it fits a phone-width card. */
const NODE = { case: { x: 50, y: 13 }, middleware: { x: 50, y: 48 }, crm: { x: 26, y: 84 }, erp: { x: 74, y: 84 } } as const;
type Pos = { x: number; y: number };
/** Where the request (outbound) and the update (inbound) are at each hop. */
const HOPS: { packets: Pos[]; caption: string; inbound: boolean }[] = [
  { packets: [NODE.case], caption: "The case sends a request: customer tier and last payment", inbound: false },
  { packets: [NODE.middleware], caption: "Middleware routes it to the CRM and ERP", inbound: false },
  { packets: [NODE.crm, NODE.erp], caption: "The CRM and ERP look up the customer", inbound: true },
  { packets: [NODE.middleware, NODE.middleware], caption: "Middleware combines the update", inbound: true },
  { packets: [NODE.case, NODE.case], caption: "The update arrives on the case", inbound: true },
];

function BackOfficeCheck({ state, onRun, onDone }: { state: "needed" | "running" | "done"; onRun: () => void; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [hop, setHop] = useState(0);
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    if (state !== "running") return;
    if (reduce) return finish();
    const ids = HOPS.map((_, i) => window.setTimeout(() => setHop(i), i * INTEGRATION_HOP_MS));
    ids.push(window.setTimeout(finish, HOPS.length * INTEGRATION_HOP_MS));
    return () => ids.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per check
  }, [state, reduce]);

  const done = state === "done";
  const running = state === "running";
  const active = (n: keyof typeof NODE) =>
    running && HOPS[hop].packets.some((p) => p === NODE[n]) ? "border-signal-blue text-text" : "border-rule text-text-dim";
  const result = (from: string) => BACK_OFFICE.results.find((r) => r.from === from)!.line;

  const diagram = (
    <div className="relative h-60 w-full">
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {[
          [NODE.case, NODE.middleware],
          [NODE.middleware, NODE.crm],
          [NODE.middleware, NODE.erp],
        ].map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" className="stroke-rule" strokeWidth={1} />
        ))}
      </svg>
      {(
        [
          ["case", "CSM case"],
          ["middleware", "Middleware"],
          ["crm", "CRM"],
          ["erp", "ERP"],
        ] as const
      ).map(([n, label]) => (
        <span
          key={n}
          style={{ left: `${NODE[n].x}%`, top: `${NODE[n].y}%` }}
          className={`absolute z-10 flex w-[44%] max-w-[8rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-md border bg-panel px-2 py-1.5 text-center text-xs transition-colors ${active(n)}`}
        >
          {label}
          {done && (n === "crm" || n === "erp") && <span className="mt-0.5 font-mono text-[0.625rem] text-text-faint">{result(n.toUpperCase())}</span>}
        </span>
      ))}
      {running &&
        // Two packets throughout: together on the single hops, apart on the way to and from the CRM and ERP.
        // They pass behind the boxes, so they show in transit and the box lights up on arrival.
        [0, 1].map((i) => {
          const p = HOPS[hop].packets[i] ?? HOPS[hop].packets[0];
          return (
            <motion.span
              key={i}
              aria-hidden
              initial={false}
              animate={{ left: `${p.x}%`, top: `${p.y}%` }}
              transition={{ duration: INTEGRATION_HOP_MS / 1000 - 0.1, ease: "easeInOut" }}
              style={{ marginLeft: -6, marginTop: -6 }}
              className={`absolute h-3 w-3 rounded-full ${HOPS[hop].inbound ? "bg-signal-teal" : "bg-signal-blue"}`}
            />
          );
        })}
    </div>
  );

  return (
    <section aria-labelledby="backoffice-title" className="rounded-lg border border-rule bg-panel p-4">
      <h4 id="backoffice-title" className="text-base">
        Back-office check
      </h4>
      <p className="mt-1 text-sm text-text-dim">{BACK_OFFICE.need}</p>
      {state === "needed" && (
        <button type="button" onClick={onRun} className="mt-3 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
          Run the back-office check
        </button>
      )}
      {state !== "needed" && (
        <figure className="mt-3">
          {running ? (
            <button type="button" onClick={finish} aria-label="Skip animation and show the back-office result" className="block w-full rounded-md border border-dashed border-rule bg-ink">
              {diagram}
            </button>
          ) : (
            <div className="rounded-md border border-dashed border-rule bg-ink">{diagram}</div>
          )}
          <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-signal-amber">{BACK_OFFICE.label}</span>
            {running && <span className="text-text-faint">Click to skip</span>}
          </figcaption>
          <p aria-live="polite" className="mt-1 text-sm text-text-dim">
            {running ? HOPS[hop].caption : `Update on the case: ${BACK_OFFICE.results.map((r) => r.line).join(" · ")}`}
          </p>
        </figure>
      )}
    </section>
  );
}

// --- Message builder ---------------------------------------------------------------------------------

function MessageBuilder({
  selected,
  sent,
  onToggle,
  onSend,
}: {
  selected: ChipId[];
  sent: boolean;
  onToggle: (id: ChipId) => void;
  onSend: () => void;
}) {
  const chips = messageChips(selected);
  const change = csatChange(selected);
  return (
    <section aria-labelledby="message-title" className="rounded-lg border border-rule bg-panel p-4">
      <h4 id="message-title" className="text-base">
        Customer update
      </h4>
      <p className="mt-1 text-sm text-text-dim">Choose what the update says. The preview builds as you go.</p>

      <div role="group" aria-label="Message content" className="mt-3 flex flex-wrap gap-2">
        {CHIP_ORDER.map((id) => {
          const c = CHIPS.find((x) => x.id === id)!;
          const on = selected.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              disabled={sent}
              onClick={() => onToggle(id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                on ? "border-signal-blue bg-panel-2 text-text" : "border-rule bg-ink text-text-dim hover:border-text-faint hover:text-text"
              }`}
            >
              {on && <span aria-hidden>✓ </span>}
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="rounded-md border border-rule bg-ink p-3" aria-live="polite">
          <p className="text-xs text-text-faint">Preview</p>
          {chips.length ? (
            <div className="mt-1 space-y-2 text-sm text-text">
              <p>{MESSAGE_GREETING}</p>
              <p>{chips.map((c) => c.sentence).join(" ")}</p>
              <p className="text-text-dim">{MESSAGE_SIGNOFF}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-text-faint">Pick what the update should say.</p>
          )}
        </div>
        <div className="rounded-md border border-rule bg-ink p-3">
          <p className="flex items-baseline justify-between gap-2 text-xs text-text-faint">
            CSAT change <span className="font-mono text-[0.6875rem]">Simulated</span>
          </p>
          <p className={`mt-0.5 font-mono text-xl tabular-nums ${change > 0 ? "text-signal-teal" : change < 0 ? "text-signal-amber" : "text-text"}`}>{formatChange(change)}</p>
          <p className="mt-2 text-xs text-text-faint">What this message communicates</p>
          {chips.length ? (
            <ul className="mt-1 space-y-1 text-xs text-text-dim">
              {chips.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>{c.communicates}</span>
                  <span className="shrink-0 font-mono tabular-nums">{formatChange(c.weight)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-text-dim">Nothing yet.</p>
          )}
        </div>
      </div>

      {sent ? (
        <p className="mt-3 text-sm text-text-dim">Update sent to {CUSTOMER_CASE.customer.name}.</p>
      ) : (
        <button
          type="button"
          disabled={!chips.length}
          onClick={onSend}
          className="mt-3 h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send the update
        </button>
      )}
    </section>
  );
}

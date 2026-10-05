"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";
import { StatusPill } from "@/components/ui/status-pill";
import { BASELINE_UTILISATION, INITIAL, formatClock, inr, type DecisionKind, type DecisionLogEntry } from "./model";
import { DAY_PLAN_TRUCKS, FLEET_TOTAL, operatingStyle, principleOf, shiftSummary, type ShiftSummary } from "./ending";

/**
 * The end of Control tower: "Network shift complete" (never a win/lose
 * message), the 24-hour operating summary, operating-style observations, the
 * real product problem from the work record, Decision Replay, and the
 * portfolio bridge. Everything is derived from the decision log and the
 * tower's final stats.
 */
export function ShiftEnd({
  seconds,
  log,
  stats,
  caseStudy,
}: {
  seconds: number;
  log: DecisionLogEntry[];
  stats: { sla: number; cost: number };
  caseStudy: PrototypeCaseStudy | null;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const summary = shiftSummary(log, stats);
  const style = operatingStyle(log);

  return (
    <section aria-labelledby="shift-end-title" className="p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="shift-end-title" ref={headingRef} tabIndex={-1} className="text-2xl">
            Network shift complete
          </h2>
          <StatusPill tone="idle">24-hour operating summary</StatusPill>
        </div>
        <span className="font-mono text-sm tabular-nums text-text-dim">
          <span className="sr-only">Time on shift: </span>T+{formatClock(seconds)}
        </span>
      </header>

      <Summary s={summary} />

      <section aria-labelledby="style-title" className="mt-6 rounded-lg border border-rule bg-panel p-4 sm:p-5">
        <h3 id="style-title" className="text-lg">
          Your operating style
        </h3>
        {style.length ? (
          <ul className="mt-3 space-y-2">
            {style.map((s) => (
              <li key={s} className="border-l-2 border-signal-blue pl-3 text-sm text-text">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-dim">Too few decisions this shift to see a pattern.</p>
        )}
        <p className="mt-3 text-xs text-text-faint">Observations from the decisions you logged, not a score.</p>
      </section>

      <RealWorldReveal caseStudy={caseStudy} />
      <DecisionReplay log={log} />
      <PortfolioBridge caseStudySlug={caseStudy?.slug ?? null} />
    </section>
  );
}

// --- Summary -------------------------------------------------------------------------------------

function Summary({ s }: { s: ShiftSummary }) {
  const trucksWorking = Math.round((s.fleetUtilisation / 100) * FLEET_TOTAL);
  const cards = [
    { label: "Service level", value: `${s.serviceLevel}%`, note: `Start of day ${INITIAL.sla}%` },
    { label: "Fleet utilization", value: `${s.fleetUtilisation}%`, note: `${trucksWorking} of ${FLEET_TOTAL} trucks working (plan: ${DAY_PLAN_TRUCKS})` },
    { label: "SLA breaches", value: String(s.slaBreaches), note: "Customers past their SLA tolerance" },
    {
      label: "Load utilization",
      value: s.loadUtilisation === null ? "—" : `${s.loadUtilisation}%`,
      note: s.loadUtilisation === null ? "You loaded no runs" : `Runs you loaded (network ${BASELINE_UTILISATION}%)`,
    },
    { label: "Cost", value: inr.format(s.cost), note: `Start of day ${inr.format(INITIAL.cost)}` },
  ];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <div className="mt-5">
      {/* Five cards: on phones the last one (Cost, the longest figure) takes the full row. */}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="min-w-0 rounded-lg border border-rule bg-panel px-3 py-3 last:col-span-2 md:last:col-span-1">
            <dt className="text-xs text-text-faint">{c.label}</dt>
            <dd className="mt-1 font-mono text-xl font-medium tabular-nums text-text">{c.value}</dd>
            <dd className="mt-1 text-xs text-text-dim">{c.note}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-text-dim">
        {[
          plural(s.shipments, "shipment processed", "shipments processed"),
          plural(s.consolidated, "load consolidated", "loads consolidated"),
          plural(s.resolved, "exception resolved", "exceptions resolved"),
          plural(s.criticalProtected, "critical delivery protected", "critical deliveries protected"),
        ].join(" · ")}
      </p>
    </div>
  );
}

// --- Real-world reveal --------------------------------------------------------------------------------

/** Where each real decision shows up in the game, matched on its wording. */
const IN_THE_GAME: { match: RegExp; where: string }[] = [
  { match: /density|adulterat/i, where: "Mission 03's density exception" },
  { match: /consolidat/i, where: "Mission 01 and the AI Dispatcher" },
];

/** "Shipment tracking…" reads as "shipment tracking…" inside brackets; acronyms (SAP) stay as they are. */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function RealWorldReveal({ caseStudy: cs }: { caseStudy: PrototypeCaseStudy | null }) {
  if (!cs) {
    return (
      <section aria-labelledby="real-title" className="mt-10 border-t border-rule pt-8">
        <h3 id="real-title" className="text-xl">
          Now see the real product problem behind this prototype
        </h3>
        <p className="mt-3 text-sm text-text-dim">The real case study isn&apos;t available right now.</p>
      </section>
    );
  }
  const bullets = (cs.approach ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
  const scope = bullets.filter((b) => /cylinder|fuel|petrochemical/i.test(b));
  const roleLine = [cs.role, cs.company].filter(Boolean).join(", ");

  return (
    <section aria-labelledby="real-title" className="mt-10 border-t border-rule pt-8">
      <h3 id="real-title" className="text-xl">
        Now see the real product problem behind this prototype
      </h3>
      <p className="mt-2 text-sm text-text-faint">
        {cs.title}
        {roleLine && ` · ${roleLine}`}
      </p>

      {cs.metrics.length > 0 && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {cs.metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-signal-teal bg-panel px-4 py-3">
              <dt className="text-xs text-text-faint">{m.label}</dt>
              <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-text">{m.value}</dd>
              {m.context && <dd className="text-xs text-text-dim">{m.context}</dd>}
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-medium text-text">The problem</h4>
          {cs.problem && <p className="mt-1 text-sm text-text-dim">{cs.problem}</p>}
          {scope.length > 0 && (
            <>
              <h4 className="mt-4 text-sm font-medium text-text">Scope</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text-dim">
                {scope.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </>
          )}
          {cs.users && <p className="mt-2 text-sm text-text-dim">Users: {cs.users}</p>}
        </div>

        <div>
          <h4 className="text-sm font-medium text-text">What the real product did</h4>
          <ul className="mt-1 space-y-3">
            {cs.decisions.map((d, i) => {
              const game = IN_THE_GAME.find((g) => g.match.test(`${d.title ?? ""} ${d.choice ?? ""}`));
              return (
                <li key={i} className="text-sm">
                  {d.title && <p className="text-text">{d.title}</p>}
                  {d.choice && <p className="text-text-dim">{d.choice}</p>}
                  {game && <p className="mt-0.5 font-mono text-xs text-signal-blue">In the game: {game.where}</p>}
                </li>
              );
            })}
          </ul>
          {cs.architecture.components.length > 0 && (
            <p className="mt-3 text-sm text-text-dim">
              <span className="text-text">Built on: </span>
              {cs.architecture.components.map((c) => `${c.name}${c.description ? ` (${lowerFirst(c.description.replace(/\.$/, ""))})` : ""}`).join("; ")}.{" "}
              <span className="font-mono text-xs text-signal-blue">In the game: the Integration View</span>
            </p>
          )}
        </div>
      </div>

      {cs.outcome && (
        <aside aria-label="The real outcome" className="mt-6 rounded-lg border border-rule bg-panel p-4">
          <p className="font-mono text-xs uppercase tracking-wider text-text-faint">The outcome</p>
          <p className="mt-2 text-base text-text">{cs.outcome}</p>
        </aside>
      )}
    </section>
  );
}

/** Capitalise a log line once its "Mission 02: " style prefix is stripped. */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// --- Decision Replay ------------------------------------------------------------------------------------

const KIND_LABEL: Record<DecisionKind, string> = {
  dispatch: "Mission 01",
  investigate: "Mission 02 · investigate",
  exception: "Mission 02",
  quality: "Mission 03",
  "integrity-check": "Mission 03 · integrity",
  "integrity-conclusion": "Mission 03 · integrity",
  policy: "Strategy",
  "policy-off": "Strategy",
  "consolidation-approved": "AI Dispatcher",
  "consolidation-rejected": "AI Dispatcher",
};

/** The decision log as a vertical timeline; each entry expands to its impacts and a product principle. */
function DecisionReplay({ log }: { log: DecisionLogEntry[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section aria-labelledby="replay-title" className="mt-10 border-t border-rule pt-8">
      <h3 id="replay-title" className="text-xl">
        Decision Replay
      </h3>
      <p className="mt-1 text-sm text-text-dim">Every decision from your shift, in order. Select one to see what it did.</p>
      {log.length ? (
        <ol className="mt-5 border-l border-rule">
          {log.map((e, i) => {
            const expanded = open === i;
            return (
              <li key={i} className="relative pb-3 pl-5 last:pb-0">
                <span aria-hidden className={`absolute -left-[5px] top-3 h-2.5 w-2.5 rounded-full ${expanded ? "bg-signal-blue" : "bg-rule"}`} />
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`replay-${i}`}
                  onClick={() => setOpen(expanded ? null : i)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${expanded ? "border-signal-blue bg-panel-2" : "border-rule bg-panel hover:bg-panel-2"}`}
                >
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-mono text-xs tabular-nums text-text-faint">{e.time}</span>
                    <span className="font-mono text-xs text-signal-blue">{KIND_LABEL[e.kind]}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-text">{sentence(e.description.replace(/^(Mission \d+|Strategy|AI Dispatcher): /, ""))}</span>
                </button>
                {expanded && (
                  <dl id={`replay-${i}`} className="mt-2 space-y-2 rounded-md border border-rule bg-ink p-3 text-sm">
                    <div>
                      <dt className="text-xs text-text-faint">Decision</dt>
                      <dd className="text-text">{e.description}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-faint">Immediate impact</dt>
                      <dd className="text-text-dim">{e.impact}</dd>
                    </div>
                    {e.secondary && (
                      <div>
                        <dt className="text-xs text-text-faint">Secondary impact</dt>
                        <dd className="text-text-dim">{e.secondary}</dd>
                      </div>
                    )}
                    <div className="border-t border-rule pt-2">
                      <dt className="font-mono text-xs uppercase tracking-wider text-signal-blue">Product principle</dt>
                      <dd className="mt-0.5 text-text">{principleOf(e)}</dd>
                    </div>
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-text-faint">No decisions were logged.</p>
      )}
    </section>
  );
}

// --- Portfolio bridge -----------------------------------------------------------------------------------

function PortfolioBridge({ caseStudySlug }: { caseStudySlug: string | null }) {
  const links = [
    { href: caseStudySlug ? `/work/${caseStudySlug}` : "/work", label: "Read the logistics case study", note: "The real product behind the Control tower prototype" },
    { href: "/prototype-lab", label: "Explore my other prototypes", note: "More product decisions to try" },
    { href: "/ai-lab", label: "Ask Anshu about this work", note: "Questions answered from the portfolio" },
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

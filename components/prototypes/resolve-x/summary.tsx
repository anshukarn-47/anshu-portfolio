"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ENTERPRISE,
  METRIC_FORMULAS,
  SUMMARY_LABEL,
  WHAT_I_DID,
  computeMetrics,
  improvementsFromLog,
  repeatFromLog,
  type DecisionLogEntry,
} from "./model";
import { InfoTip } from "./resolve";

/**
 * The end of the shift: results computed from the decision log (described, not
 * scored), the improvements actually made, the real-world reveal in resume
 * wording only, and the portfolio bridge.
 */
export function ShiftSummary({ log, caseStudySlug }: { log: DecisionLogEntry[]; caseStudySlug: string | null }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const m = computeMetrics(log);
  const repeat = repeatFromLog(log);
  const results: { label: string; value: string; formula?: string }[] = [
    { label: "SLA compliance", value: m ? `${m.sla}%` : "—", formula: METRIC_FORMULAS.sla },
    { label: "First-contact resolution", value: m ? `${m.fcr}%` : "—", formula: METRIC_FORMULAS.fcr },
    { label: "Average resolution time", value: m ? `${m.time} min` : "—", formula: METRIC_FORMULAS.time },
    { label: "CSAT", value: m ? `${m.csat.toFixed(1)} / 5` : "—", formula: METRIC_FORMULAS.csat },
    { label: "Repeat incidents", value: repeat === null ? "—" : `${repeat}` },
  ];
  const improvements = improvementsFromLog(log);

  return (
    <section aria-labelledby="summary-title" className="mt-6 scroll-mt-4 rounded-lg border border-rule bg-panel p-4 sm:p-6">
      <h2 id="summary-title" ref={headingRef} tabIndex={-1} className="text-2xl">
        Shift complete
      </h2>
      <p className="mt-1 text-sm text-text-dim">{ENTERPRISE} handed over to the next shift.</p>

      <div className="mt-5">
        <h3 className="font-mono text-xs uppercase tracking-wider text-text-faint">{SUMMARY_LABEL}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {results.map((r) => (
            <div key={r.label} className="rounded-md border border-rule bg-ink p-3">
              <dt className="flex items-center gap-1.5 text-xs text-text-faint">
                {r.label}
                {r.formula && <InfoTip label={`How ${r.label} is calculated`} text={r.formula} />}
              </dt>
              <dd className="mt-1 font-mono text-xl tabular-nums text-text">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {improvements.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base">Service improvements you made this shift</h3>
          <ul className="mt-2 space-y-1.5">
            {improvements.map((i) => (
              <li key={i} className="flex gap-2 text-sm text-text">
                <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal-teal" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-md border border-signal-blue bg-ink p-4">
        <h3 className="text-base">What I actually did</h3>
        <ul className="mt-2 space-y-2 text-sm text-text">
          {WHAT_I_DID.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-text-faint">The shift you just ran is fictional; this is the real work behind it.</p>
      </div>

      <PortfolioBridge caseStudySlug={caseStudySlug} />
    </section>
  );
}

function PortfolioBridge({ caseStudySlug }: { caseStudySlug: string | null }) {
  const links = [
    { href: caseStudySlug ? `/work/${caseStudySlug}` : "/work", label: "Read the service-management case study", note: "The real POC behind RESOLVE//X" },
    { href: "/prototype-lab", label: "Explore my other prototypes", note: "More product decisions to try" },
    { href: "/ai-lab", label: "Ask Anshu about this work", note: "Questions answered from the portfolio" },
  ];
  return (
    <nav aria-label="Keep exploring" className="mt-6 border-t border-rule pt-6">
      <ul className="grid gap-3 sm:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex h-full flex-col rounded-lg border border-rule bg-ink p-4 transition-colors hover:bg-panel-2">
              <span className="text-sm font-medium text-text">{l.label} →</span>
              <span className="mt-1 text-xs text-text-dim">{l.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

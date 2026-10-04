"use client";

import Link from "next/link";
import type { ArcadeEntry } from "@/lib/arcade/registry";
import { PUBLISHED_GAMES } from "@/lib/arcade/registry";
import { PROTOTYPES } from "@/lib/prototypes/registry";
import type { PrototypeCaseStudy } from "@/components/prototypes/engine/case-study-view";
import { trackEvent } from "@/components/analytics/tracker";
import type { GameDefinition, GameResult } from "./types";

/** Debrief: what the game demonstrates and the simulated results. Described, never graded. */
export function Debrief({ game, result }: { game: GameDefinition; result: GameResult }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="demonstrates-title">
        <h3 id="demonstrates-title" className="text-lg">
          What this demonstrates
        </h3>
        <ul className="mt-2 space-y-1.5">
          {game.demonstrates.map((d) => (
            <li key={d} className="flex gap-2 text-sm text-text">
              <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal-teal" />
              {d}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="results-title" className="rounded-md border border-rule bg-ink p-4">
        <h3 id="results-title" className="flex items-baseline justify-between gap-3 text-base">
          Your run <span className="font-mono text-xs font-normal text-text-faint">Simulated</span>
        </h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3 rounded-md border border-rule bg-panel px-3 py-2">
            <dt className="text-xs text-text-faint">Decision score</dt>
            <dd className="font-mono tabular-nums text-text">
              {result.maxScore === undefined ? result.score : `${result.score} / ${result.maxScore}`}
            </dd>
          </div>
          {result.lines.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between gap-3 rounded-md border border-rule bg-panel px-3 py-2">
              <dt className="text-xs text-text-faint">{l.label}</dt>
              <dd className="font-mono tabular-nums text-text">{l.value}</dd>
            </div>
          ))}
        </dl>
        {result.table && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[16rem] text-left text-sm">
              <caption className="mb-2 text-left text-xs text-text-faint">{result.table.caption}</caption>
              <thead>
                <tr className="border-b border-rule text-xs text-text-faint">
                  {result.table.columns.map((c) => (
                    <th key={c} scope="col" className="py-1.5 pr-3 font-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-rule last:border-0">
                    {r.map((cell, j) =>
                      j === 0 ? (
                        <th key={j} scope="row" className="py-1.5 pr-3 font-normal text-text">
                          {cell}
                        </th>
                      ) : (
                        <td key={j} className="py-1.5 pr-3 font-mono tabular-nums text-text-dim">
                          {cell}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-text-dim">
          <span className="text-text">What the score rewards:</span> {game.scoreRewards}
        </p>
      </section>
    </div>
  );
}

/**
 * The Real-world case: the related work records, each shown only as the record
 * has it (no added numbers), then where to go next.
 */
export function RealCase({ entry, cases, focus }: { entry: ArcadeEntry; cases: PrototypeCaseStudy[]; focus?: RegExp }) {
  const simulation = entry.relatedSimulation ? PROTOTYPES.find((p) => p.slug === entry.relatedSimulation) : undefined;
  // The next published game after this one, wrapping round.
  const order = PUBLISHED_GAMES.map((g) => g.slug);
  const next = PUBLISHED_GAMES.length > 1 ? PUBLISHED_GAMES[(order.indexOf(entry.slug) + 1) % PUBLISHED_GAMES.length] : undefined;

  const links: { href: string; label: string; note: string; caseStudy?: boolean }[] = [
    ...cases.map((cs) => ({ href: `/work/${cs.slug}`, label: "Read the full case study", note: cs.title, caseStudy: true })),
    ...(simulation ? [{ href: `/prototype-lab/${simulation.slug}`, label: `Try ${simulation.title}`, note: "The longer decision simulation" }] : []),
    next && next.slug !== entry.slug
      ? { href: `/arcade/${next.slug}`, label: "Play another game", note: next.title }
      : { href: "/arcade", label: "See the other games", note: "More quick games are on their way" },
    { href: "/ai-lab", label: "Ask Anshu about this work", note: "Questions answered from the portfolio" },
  ];

  return (
    <div className="space-y-6">
      {cases.length ? (
        cases.map((cs, i) => <CaseArticle key={cs.slug} cs={cs} focus={focus} index={i} />)
      ) : (
        <p className="rounded-md border border-dashed border-rule bg-ink p-4 text-sm text-text-dim">The case study behind this game isn&apos;t published yet.</p>
      )}

      <nav aria-label="Keep exploring" className="border-t border-rule pt-5">
        <ul className="grid gap-3 sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={l.caseStudy ? () => trackEvent("arcade_case_study_open", entry.slug) : undefined}
                className="flex h-full flex-col rounded-lg border border-rule bg-ink p-4 transition-colors hover:bg-panel-2"
              >
                <span className="text-sm font-medium text-text">{l.label} →</span>
                <span className="mt-1 text-xs text-text-dim">{l.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** One work record, as the record has it. */
function CaseArticle({ cs, focus, index }: { cs: PrototypeCaseStudy; focus?: RegExp; index: number }) {
  // The record's own approach lines that match the game, word for word.
  const focusLines =
    cs.approach && focus
      ? cs.approach
          .split(/\r?\n/)
          .map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+/, "").trim())
          .filter((l) => l && focus.test(l))
      : [];
  const roleLine = [cs.role, cs.company].filter(Boolean).join(", ");
  const titleId = `real-case-title-${index}`;
  return (
    <article aria-labelledby={titleId} className={index > 0 ? "border-t border-rule pt-6" : ""}>
      <p className="font-mono text-xs uppercase tracking-wider text-text-faint">{index === 0 ? "Based on" : "Also based on"}</p>
      <h3 id={titleId} className="mt-1 text-xl">
        {cs.title}
      </h3>
      {cs.metrics.length > 0 && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {cs.metrics.map((m) => (
            <div key={m.label} className="rounded-md border border-rule bg-ink px-3 py-2">
              <dt className="text-xs text-text-faint">{m.label}</dt>
              <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {focusLines.length > 0 && (
        <section className="mt-5 rounded-md border-l-2 border-signal-teal pl-3">
          <h4 className="text-base">Most relevant to this game</h4>
          <ul className="mt-1 space-y-1">
            {focusLines.map((l) => (
              <li key={l} className="text-sm text-text">
                {l}
              </li>
            ))}
          </ul>
        </section>
      )}
      <CaseSection title="Problem" text={cs.problem} />
      {roleLine && <CaseSection title="Role" text={roleLine} />}
      {cs.decisions.some((x) => x.title || x.choice) && (
        <section className="mt-5">
          <h4 className="text-base">Decisions</h4>
          <ul className="mt-1 space-y-2">
            {cs.decisions.map((x, i) => (
              <li key={i} className="text-sm text-text-dim">
                {x.title && <p className="text-text">{x.title}</p>}
                {x.choice && <p>{x.choice}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <CaseSection title="Outcome" text={cs.outcome} />
    </article>
  );
}

function CaseSection({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <section className="mt-5">
      <h4 className="text-base">{title}</h4>
      <p className="mt-1 max-w-prose text-sm text-text-dim">{text}</p>
    </section>
  );
}

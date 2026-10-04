"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import {
  ANSWERS,
  BOARD,
  BUDGET,
  EVIDENCE_SLOTS,
  PRODUCT,
  QUESTION,
  RELEVANCE_LABEL,
  SIZE,
  docAt,
  docById,
  initialMaze,
  mazeReducer,
  scoreMaze,
  seenSet,
  type Doc,
  type MazeAction,
  type MazeState,
} from "@/lib/arcade/games/knowledge-maze";
import type { GameDefinition, PlayProps } from "../types";

const DIRS: { key: string; dx: number; dy: number; label: string; arrow: string }[] = [
  { key: "ArrowUp", dx: 0, dy: -1, label: "North", arrow: "↑" },
  { key: "ArrowRight", dx: 1, dy: 0, label: "East", arrow: "→" },
  { key: "ArrowDown", dx: 0, dy: 1, label: "South", arrow: "↓" },
  { key: "ArrowLeft", dx: -1, dy: 0, label: "West", arrow: "←" },
];
const RELEVANCE_MARK = { high: "✓✓", partial: "✓", none: "–" } as const;
const KIND_LABEL = { grounded: "Grounded in current evidence", outdated: "Cites an outdated document", unsupported: "Cites nothing" } as const;

const facts = (d: Doc) => `${d.source} · ${d.freshness}`;

function KnowledgeMazePlay({ relaxed, paused, onFinish }: PlayProps) {
  // The reducer needs relaxed mode (no move budget); keep it in a ref so a toggle mid-run applies to the next move.
  const relaxedRef = useRef(relaxed);
  relaxedRef.current = relaxed;
  const [s, dispatch] = useReducer((st: MazeState, a: MazeAction) => mazeReducer(st, a, relaxedRef.current), undefined, initialMaze);
  const [chosen, setChosen] = useState<string | null>(null);
  const seen = seenSet(s);
  const here = docAt(s.pos.x, s.pos.y);
  const inEvidence = s.evidence.includes(here.id);
  const slotsFull = s.evidence.length >= EVIDENCE_SLOTS;

  const act = (a: MazeAction) => !paused && dispatch(a);
  const actRef = useRef(act);
  actRef.current = act;

  // Keyboard: arrows move, C collects, S runs semantic search, A goes to the answer; 1–3 choose an answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const dir = DIRS.find((d) => d.key === e.key);
      if (s.phase === "search") {
        if (dir) actRef.current({ type: "move", dx: dir.dx, dy: dir.dy });
        else if (e.key === "c" || e.key === "C") actRef.current({ type: "collect" });
        else if (e.key === "s" || e.key === "S") actRef.current({ type: "search" });
        else if (e.key === "a" || e.key === "A") actRef.current({ type: "to-answer" });
        else return;
        e.preventDefault();
      } else if (["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        choose(ANSWERS[Number(e.key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const choose = (id: string) => {
    if (paused || chosen) return;
    setChosen(id);
    const r = scoreMaze(s, id);
    const answer = ANSWERS.find((a) => a.id === id)!;
    onFinish({
      score: r.score,
      maxScore: r.maxScore,
      lines: [
        { label: "Relevant, current evidence", value: `${r.relevantCurrent} of ${EVIDENCE_SLOTS} slots` },
        { label: "Outdated documents in evidence", value: `${r.outdatedInEvidence}` },
        { label: "Answer chosen", value: KIND_LABEL[r.answer] },
        { label: "Backed by your evidence", value: r.answer === "grounded" ? (r.backed ? "Yes" : "Partly or not") : "Not applicable" },
        { label: "Moves used", value: relaxed ? `${s.movesUsed} (relaxed, no limit)` : `${s.movesUsed} of ${BUDGET.moves}` },
      ],
      table: {
        caption: `Your evidence, and what the chosen answer cites ("${answer.text.slice(0, 48)}…")`,
        columns: ["Document", "Freshness", "Relevance", "Cited"],
        rows: [
          ...s.evidence.map((id) => {
            const d = docById(id);
            return [`${d.title} (${d.source})`, d.freshness, RELEVANCE_LABEL[d.relevance], answer.cites.includes(id) ? "Yes" : "No"];
          }),
          ...answer.cites
            .filter((id) => !s.evidence.includes(id))
            .map((id) => {
              const d = docById(id);
              return [`${d.title} (${d.source}), not collected`, d.freshness, RELEVANCE_LABEL[d.relevance], "Yes"];
            }),
        ],
      },
    });
  };

  const neighbours = DIRS.map((d) => {
    const x = s.pos.x + d.dx;
    const y = s.pos.y + d.dy;
    const inside = x >= 0 && y >= 0 && x < SIZE && y < SIZE;
    return { ...d, doc: inside ? docAt(x, y) : null };
  });

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-rule bg-ink p-3">
        <p className="text-xs text-text-faint">Customer question · {PRODUCT} (fictional)</p>
        <p className="mt-0.5 text-base text-text">&ldquo;{QUESTION}&rdquo;</p>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Moves</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">
            {s.movesUsed}
            {!relaxed && <span className="text-xs text-text-faint"> / {BUDGET.moves}</span>}
          </dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Evidence</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">
            {s.evidence.length}
            <span className="text-xs text-text-faint"> / {EVIDENCE_SLOTS}</span>
          </dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Semantic search</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{s.searchesLeft} left</dd>
        </div>
      </dl>

      {/* The map. Fog until a node is next to somewhere visited; relevance shows once visited. */}
      <div
        role="group"
        aria-label={`Knowledge map, ${SIZE} by ${SIZE}. You are at ${here.title}.`}
        aria-describedby="maze-keys"
        className="relative mx-auto grid w-full max-w-[22rem] grid-cols-7 gap-1"
      >
        {BOARD.flat().map((d, n) => {
          const x = n % SIZE;
          const y = Math.floor(n / SIZE);
          const visited = s.visited.includes(d.id);
          const isSeen = seen.has(d.id);
          const adjacent = Math.abs(x - s.pos.x) + Math.abs(y - s.pos.y) === 1;
          const lit = s.highlighted.includes(d.id);
          const ev = s.evidence.includes(d.id);
          const label = !isSeen
            ? `Unexplored${lit ? ", highlighted by search" : ""}`
            : `${d.title}, ${facts(d)}${visited ? `, ${RELEVANCE_LABEL[d.relevance].toLowerCase()}` : ""}${ev ? ", in evidence" : ""}${lit ? ", highlighted by search" : ""}`;
          return (
            <button
              key={d.id}
              type="button"
              tabIndex={-1}
              disabled={s.phase !== "search" || !adjacent}
              onClick={() => act({ type: "move", dx: x - s.pos.x, dy: y - s.pos.y })}
              aria-label={label}
              title={isSeen ? `${d.title} · ${facts(d)}` : undefined}
              className={`relative flex aspect-square items-center justify-center rounded border font-mono text-[0.625rem] ${
                !isSeen
                  ? "border-transparent bg-ink"
                  : visited
                    ? `bg-panel-2 ${d.freshness === "outdated" ? "border-signal-amber" : d.relevance === "high" ? "border-signal-teal" : "border-rule"}`
                    : `bg-panel ${d.freshness === "outdated" ? "border-signal-amber" : "border-rule"}`
              } ${lit ? "outline outline-2 outline-offset-1 outline-dashed outline-signal-teal" : ""} ${adjacent && s.phase === "search" ? "hover:bg-panel-2" : ""}`}
            >
              {isSeen && (visited ? <span className="text-text-dim">{RELEVANCE_MARK[d.relevance]}</span> : <span className="text-text-faint">{d.freshness === "outdated" ? "old" : "·"}</span>)}
              {ev && <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-sm bg-signal-blue" />}
            </button>
          );
        })}
        {/* The cursor: a plain square marker over the current node. */}
        <span
          aria-hidden
          className="pointer-events-none absolute rounded border-2 border-signal-blue motion-safe:transition-[left,top] motion-safe:duration-150"
          style={{
            width: `calc((100% - ${(SIZE - 1) * 0.25}rem) / ${SIZE})`,
            aspectRatio: "1 / 1",
            left: `calc(${s.pos.x} * ((100% - ${(SIZE - 1) * 0.25}rem) / ${SIZE} + 0.25rem))`,
            top: `calc(${s.pos.y} * ((100% - ${(SIZE - 1) * 0.25}rem) / ${SIZE} + 0.25rem))`,
          }}
        />
      </div>
      <p className="text-center text-[0.6875rem] text-text-faint">✓✓ highly relevant · ✓ partly · – not relevant · old: outdated · dashed: search result</p>

      {s.phase === "search" ? (
        <>
          <div className="rounded-md border border-rule bg-ink p-3">
            <p className="text-xs text-text-faint">You&apos;re at</p>
            <p className="mt-0.5 text-sm text-text">
              <span className="font-mono text-xs text-text-dim">{here.id}</span> {here.title}
            </p>
            <p className="text-xs text-text-dim">
              {facts(here)} · {RELEVANCE_LABEL[here.relevance]}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" aria-keyshortcuts="C" disabled={inEvidence || slotsFull} onClick={() => act({ type: "collect" })} className={primary}>
                {inEvidence ? "In evidence" : slotsFull ? "Evidence full" : "Collect as evidence"} <Key k="C" />
              </button>
              <button type="button" aria-keyshortcuts="S" disabled={!s.searchesLeft} onClick={() => act({ type: "search" })} className={secondary}>
                Semantic search <Key k="S" />
              </button>
              <button type="button" aria-keyshortcuts="A" onClick={() => act({ type: "to-answer" })} className={secondary}>
                Write the answer <Key k="A" />
              </button>
            </div>
          </div>

          <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Neighbouring documents">
            {neighbours.map((nb) => (
              <li key={nb.key}>
                <button
                  type="button"
                  disabled={!nb.doc}
                  onClick={() => act({ type: "move", dx: nb.dx, dy: nb.dy })}
                  aria-keyshortcuts={nb.key}
                  className="flex w-full items-baseline gap-2 rounded-md border border-rule bg-ink px-2.5 py-2 text-left hover:bg-panel-2 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-ink"
                >
                  <span aria-hidden className="font-mono text-text-dim">
                    {nb.arrow}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-text-faint">{nb.label}</span>
                    {nb.doc ? (
                      <>
                        <span className="block truncate text-sm text-text">{nb.doc.title}</span>
                        <span className="block text-xs text-text-dim">
                          {facts(nb.doc)}
                          {s.visited.includes(nb.doc.id) ? ` · ${RELEVANCE_LABEL[nb.doc.relevance].toLowerCase()}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="block text-sm text-text-faint">Edge of the map</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section aria-labelledby="answer-title" className="space-y-2">
          <h3 id="answer-title" className="text-base">
            Choose the answer to send
          </h3>
          {ANSWERS.map((a, i) => {
            return (
              <button
                key={a.id}
                type="button"
                disabled={!!chosen}
                onClick={() => choose(a.id)}
                aria-keyshortcuts={String(i + 1)}
                className={`block w-full rounded-md border bg-ink p-3 text-left hover:bg-panel-2 disabled:cursor-default ${chosen === a.id ? "border-signal-blue" : "border-rule"}`}
              >
                <span className="flex items-baseline justify-between gap-2 text-xs text-text-faint">
                  Answer {i + 1} <Key k={String(i + 1)} />
                </span>
                <span className="mt-1 block text-sm text-text">{a.text}</span>
                <span className="mt-2 block text-xs text-text-dim">
                  Cites:{" "}
                  {a.cites.length
                    ? a.cites
                        .map((id) => {
                          const d = docById(id);
                          return `${d.title} (${d.source}, ${d.freshness})${s.evidence.includes(id) ? ", in your evidence" : ""}`;
                        })
                        .join("; ")
                    : "nothing"}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <div className="rounded-md border border-rule bg-ink p-2">
        <p className="text-xs text-text-faint">Evidence</p>
        <ol className="mt-1 grid gap-1 sm:grid-cols-3">
          {Array.from({ length: EVIDENCE_SLOTS }, (_, i) => {
            const id = s.evidence[i];
            const d = id ? docById(id) : null;
            return (
              <li key={i} className={`rounded border px-2 py-1 text-xs ${d ? "border-rule bg-panel text-text" : "border-dashed border-rule text-text-faint"}`}>
                {d ? (
                  <>
                    <span className="block truncate">{d.title}</span>
                    <span className="text-text-dim">
                      {d.freshness} · {RELEVANCE_LABEL[d.relevance].toLowerCase()}
                    </span>
                  </>
                ) : (
                  `Slot ${i + 1}: empty`
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <p id="maze-keys" className="text-xs text-text-faint">
        Move with the arrow keys, the neighbour buttons, or by tapping a square next to you. C collects, S searches, A answers. P pauses.
      </p>
      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-text-dim">
        {s.note}
      </p>
    </div>
  );
}

function Key({ k }: { k: string }) {
  return <span className="ml-1 rounded border border-current px-1 font-mono text-[0.625rem] opacity-60">{k}</span>;
}

const primary = "h-10 rounded-md bg-text px-3 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "h-10 rounded-md border border-rule px-3 text-sm text-text transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40";

export const knowledgeMaze: GameDefinition = {
  tutorial: [
    {
      title: "One question, one knowledge base",
      body: `A customer asks "${QUESTION}" The ${PRODUCT} knowledge base is laid out as a 7 by 7 map of documents, mostly hidden.`,
    },
    {
      title: "Explore",
      body: "Move with the arrow keys, the neighbour buttons, or by tapping a square next to you. Documents next to you show their title, source and freshness; you learn how relevant one is by visiting it.",
    },
    {
      title: "Collect up to three",
      body: "Collect documents as evidence (C). Outdated documents take longer to read, and every slot you fill with an outdated or off-topic document is one you can't use for a good one. Semantic search (S) highlights the most relevant documents nearby, twice.",
    },
    {
      title: "Then answer",
      body: "Choose one of three answers to send. Each shows what it cites. You have a limited number of moves; relaxed mode removes the limit.",
    },
  ],
  Play: KnowledgeMazePlay,
  demonstrates: [
    "Retrieval quality depends on relevance and freshness, not on how much you collect.",
    "An answer is only as good as the evidence it's grounded in.",
    "Semantic search narrows the field, but it ranks by meaning, not by date, so freshness still needs checking.",
  ],
  scoreRewards:
    "Relevant, current documents in your evidence; keeping outdated documents out of it; and choosing the answer grounded in current evidence, with a bonus when your own evidence backs it. Speed and the number of moves don't count.",
  caseFocus: /semantic search|vector|documentation/i,
};

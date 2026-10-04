"use client";

import { useEffect, useReducer, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COLS, KIND_LABEL, KIND_MARK, LEVEL, PRODUCT, QUESTION, ROWS, sourceById, type Kind } from "@/lib/arcade/neural-maze/level";
import {
  GROUNDING,
  TICK_MS,
  WINDOW_SLOTS,
  initialMaze,
  mazeReducer,
  composeAnswer,
  scoreMaze,
  sourceAt,
  type MazeAction,
  type MazeState,
} from "@/lib/arcade/neural-maze/engine";
import { useGameLoop } from "../use-game-loop";
import type { GameDefinition, PlayProps } from "../types";

/** Unsupported claims are in play. */
const DRIFTS_ON = true;
const CELL = 30;

/** Type shapes: circle current, square outdated, triangle conflicting, hollow diamond irrelevant. Each also carries its letter. */
const KIND_STROKE: Record<Kind, string> = {
  current: "stroke-signal-teal",
  outdated: "stroke-signal-amber",
  conflicting: "stroke-signal-red",
  irrelevant: "stroke-text-faint",
};

export function KindShape({ kind, cx, cy, size = 10 }: { kind: Kind; cx: number; cy: number; size?: number }) {
  const s = size;
  const common = `fill-panel ${KIND_STROKE[kind]}`;
  const shape =
    kind === "current" ? (
      <circle cx={cx} cy={cy} r={s} className={common} strokeWidth={2} />
    ) : kind === "outdated" ? (
      <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} className={common} strokeWidth={2} />
    ) : kind === "conflicting" ? (
      <polygon points={`${cx},${cy - s - 1} ${cx + s + 1},${cy + s} ${cx - s - 1},${cy + s}`} className={common} strokeWidth={2} strokeLinejoin="round" />
    ) : (
      <polygon points={`${cx},${cy - s - 1} ${cx + s + 1},${cy} ${cx},${cy + s + 1} ${cx - s - 1},${cy}`} className="fill-none stroke-text-faint" strokeWidth={2} />
    );
  return (
    <g>
      {shape}
      <text x={cx} y={cy + (kind === "conflicting" ? 4 : 3.5)} textAnchor="middle" className="fill-text font-mono" fontSize={s * 0.95}>
        {KIND_MARK[kind]}
      </text>
    </g>
  );
}

/** An unsupported claim: a wavy-edged outline with a "!" mark (its label is in the legend and the accessible text). */
export function ClaimShape({ cx, cy, r = 11, frozen = false }: { cx: number; cy: number; r?: number; frozen?: boolean }) {
  const points = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const rr = r + 1.6 * Math.sin(a * 7);
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <g>
      <polygon points={points} className="fill-panel-2 stroke-signal-amber" strokeWidth={1.8} strokeDasharray={frozen ? "2 2" : undefined} />
      <text x={cx} y={cy + 4} textAnchor="middle" className="fill-signal-amber font-mono" fontSize={11} fontWeight={700}>
        !
      </text>
    </g>
  );
}

/** A small standalone icon for the slot list and legend. */
function KindIcon({ kind }: { kind: Kind }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <KindShape kind={kind} cx={12} cy={12} size={8} />
    </svg>
  );
}

function NeuralMazePlay({ relaxed, paused, onFinish }: PlayProps) {
  const opts = useRef({ relaxed, drifts: DRIFTS_ON });
  opts.current = { relaxed, drifts: DRIFTS_ON };
  const [s, dispatch] = useReducer((st: MazeState, a: MazeAction) => mazeReducer(st, a, opts.current), undefined, initialMaze);
  const reduce = useReducedMotion();

  // Standard mode: claims step on a fixed tick. Relaxed mode is turn-based (they move when you do), so there's no tick.
  const tickAcc = useRef(0);
  useGameLoop(
    (dt) => {
      tickAcc.current += dt;
      if (tickAcc.current >= TICK_MS) {
        tickAcc.current -= TICK_MS;
        dispatch({ type: "tick" });
      }
    },
    { running: DRIFTS_ON && !relaxed && !paused && s.phase === "explore" }
  );
  const explored = new Set(s.explored);
  const here = sourceAt(s.pos);

  const act = (a: MazeAction) => !paused && dispatch(a);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const actRef = useRef(act);
  actRef.current = act;

  // Arrow keys and WASD move the query cursor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      const action: MazeAction | null =
        k === "x" ? { type: "discard" } : k === "q" ? { type: "search" } : k === "v" ? { type: "verify" } : /^[1-5]$/.test(k) ? { type: "select", slot: Number(k) - 1 } : null;
      if (action) {
        e.preventDefault();
        actRef.current(action);
        return;
      }
      const dir =
        k === "arrowup" || k === "w" ? [0, -1] : k === "arrowdown" || k === "s" ? [0, 1] : k === "arrowleft" || k === "a" ? [-1, 0] : k === "arrowright" || k === "d" ? [1, 0] : null;
      if (!dir) return;
      e.preventDefault();
      actRef.current({ type: "move", dx: dir[0], dy: dir[1] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);

  // The debrief: score by its three parts, and each sentence of the answer with its source.
  const finish = () => {
    const r = scoreMaze(s);
    const ans = r.answerDetail;
    onFinish({
      score: r.score,
      maxScore: r.maxScore,
      lines: [
        { label: "Answer", value: ans.status },
        { label: "Answer quality (50%)", value: `${r.answer} of 50` },
        { label: "Evidence relevance (30%)", value: `${r.relevance} of 30` },
        { label: "Context-window use (20%)", value: `${r.windowUse} of 20` },
        { label: "Current, relevant chunks", value: `${ans.relevant} of ${s.window.length} in the window` },
        { label: "Grounding at the end", value: `${s.grounding}` },
        { label: "Unsupported claims that reached you", value: `${s.contacts}` },
      ],
      table: ans.lines.length
        ? {
            caption: "The answer, sentence by sentence",
            columns: ["Sentence", "Source", "Note"],
            rows: ans.lines.map((l) => [l.text, l.tag, l.flag ?? "Current and relevant"]),
          }
        : undefined,
    });
  };

  if (s.phase === "answer") return <AnswerStep s={s} onContinue={finish} />;

  const tone = s.grounding >= 50 ? "bg-signal-teal" : s.grounding >= 25 ? "bg-signal-amber" : "bg-signal-red";

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-rule bg-ink p-3">
        <p className="text-xs text-text-faint">Question · {PRODUCT} (fictional)</p>
        <p className="mt-0.5 text-base text-text">&ldquo;{QUESTION}&rdquo;</p>
      </div>

      <div className="rounded-md border border-rule bg-ink px-3 py-2">
        <div className="flex items-baseline justify-between text-xs text-text-faint">
          <span>Grounding</span>
          <span className="font-mono text-sm tabular-nums text-text">{s.grounding}</span>
        </div>
        <div
          role="meter"
          aria-label="Grounding"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={s.grounding}
          className="mt-1 h-1.5 rounded-full bg-panel-2"
        >
          <div className={`h-1.5 rounded-full ${tone} motion-safe:transition-[width] motion-safe:duration-300`} style={{ width: `${s.grounding}%` }} />
        </div>
      </div>

      {/* The maze. Fog hides what hasn't been explored; a source's type shows once visited. */}
      <svg
        role="img"
        aria-label={`Maze, ${COLS} by ${ROWS}. The query cursor is at column ${s.pos.x + 1}, row ${s.pos.y + 1}.${here ? ` On: ${here.title}.` : ""}`}
        viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
        className="mx-auto block w-full max-w-[30rem] touch-none select-none rounded-md border border-rule bg-ink"
        // Swipe on the board: one step in the swipe's main direction.
        onPointerDown={(e) => (swipeStart.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const st = swipeStart.current;
          swipeStart.current = null;
          if (!st) return;
          const dx = e.clientX - st.x;
          const dy = e.clientY - st.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
          act(Math.abs(dx) > Math.abs(dy) ? { type: "move", dx: Math.sign(dx), dy: 0 } : { type: "move", dx: 0, dy: Math.sign(dy) });
        }}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        {Array.from({ length: ROWS }, (_, y) =>
          Array.from({ length: COLS }, (_, x) => {
            const seen = explored.has(`${x},${y}`);
            const wall = LEVEL.walls.has(`${x},${y}`);
            return (
              <rect
                key={`${x},${y}`}
                x={x * CELL + 1}
                y={y * CELL + 1}
                width={CELL - 2}
                height={CELL - 2}
                rx={3}
                // Fog is plain ink; explored floor gets a faint outline so it reads as open, and walls are solid.
                className={!seen ? "fill-ink" : wall ? "fill-text-faint stroke-rule" : "fill-panel stroke-rule"}
                strokeWidth={seen ? 1 : 0}
              />
            );
          })
        )}
        {/* The answer core: always visible, so the goal is clear from the start. */}
        <g aria-hidden>
          <polygon
            points={octagon(LEVEL.core.x * CELL + CELL / 2, LEVEL.core.y * CELL + CELL / 2, 12)}
            className="fill-panel-2 stroke-signal-teal"
            strokeWidth={2}
          />
          <polygon points={octagon(LEVEL.core.x * CELL + CELL / 2, LEVEL.core.y * CELL + CELL / 2, 6)} className="fill-none stroke-signal-teal" strokeWidth={1.5} />
        </g>
        {LEVEL.sources.map((src) => {
          if (s.taken.includes(src.id) || !explored.has(`${src.x},${src.y}`)) return null;
          const cx = src.x * CELL + CELL / 2;
          const cy = src.y * CELL + CELL / 2;
          return s.revealed.includes(src.id) ? (
            <KindShape key={src.id} kind={src.kind} cx={cx} cy={cy} />
          ) : (
            <text key={src.id} x={cx} y={cy + 4} textAnchor="middle" className="fill-text-faint font-mono" fontSize={12}>
              ?
            </text>
          );
        })}
        {/* Semantic search: dashed rings round current, relevant sources nearby, for a few moves. */}
        {s.searchLit.map((id) => {
          const src = sourceById(id);
          return (
            <rect
              key={`lit-${id}`}
              aria-hidden
              x={src.x * CELL + 2}
              y={src.y * CELL + 2}
              width={CELL - 4}
              height={CELL - 4}
              rx={6}
              className="fill-none stroke-signal-teal"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          );
        })}
        {/* Unsupported claims. */}
        {s.drifts.map((d) => (
          <g
            key={d.id}
            aria-hidden
            className="motion-safe:transition-transform motion-safe:duration-200"
            style={{ transform: `translate(${d.at.x * CELL}px, ${d.at.y * CELL}px)` }}
          >
            <ClaimShape cx={CELL / 2} cy={CELL / 2} frozen={s.freezeMoves > 0} />
          </g>
        ))}
        {/* The query cursor: a diamond with a crosshair. */}
        <g
          aria-hidden
          className="motion-safe:transition-transform motion-safe:duration-100"
          style={{ transform: `translate(${s.pos.x * CELL + CELL / 2}px, ${s.pos.y * CELL + CELL / 2}px)` }}
        >
          <polygon points="0,-12 12,0 0,12 -12,0" className="fill-panel-2 stroke-signal-blue" strokeWidth={2} />
          <line x1={-7} y1={0} x2={7} y2={0} className="stroke-signal-blue" strokeWidth={1.5} />
          <line x1={0} y1={-7} x2={0} y2={7} className="stroke-signal-blue" strokeWidth={1.5} />
        </g>
      </svg>
      {/* On-screen D-pad for touch devices (keys and swipes work everywhere). */}
      <div role="group" aria-label="Move" className="mx-auto hidden w-40 grid-cols-3 gap-1 [@media(pointer:coarse)]:grid">
        <span />
        <DpadButton label="Up" glyph="↑" onPress={() => act({ type: "move", dx: 0, dy: -1 })} />
        <span />
        <DpadButton label="Left" glyph="←" onPress={() => act({ type: "move", dx: -1, dy: 0 })} />
        <span aria-hidden className="flex items-center justify-center">
          <svg viewBox="-12 -12 24 24" className="h-6 w-6">
            <polygon points="0,-9 9,0 0,9 -9,0" className="fill-panel-2 stroke-signal-blue" strokeWidth={1.5} />
          </svg>
        </span>
        <DpadButton label="Right" glyph="→" onPress={() => act({ type: "move", dx: 1, dy: 0 })} />
        <span />
        <DpadButton label="Down" glyph="↓" onPress={() => act({ type: "move", dx: 0, dy: 1 })} />
        <span />
      </div>

      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[0.6875rem] text-text-dim" aria-label="Legend">
        {(["current", "outdated", "conflicting", "irrelevant"] as Kind[]).map((k) => (
          <li key={k} className="flex items-center gap-1">
            <KindIcon kind={k} />
            {KIND_LABEL[k]}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="font-mono text-text-faint">?</span> Not visited yet
        </li>
        <li className="flex items-center gap-1">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
            <ClaimShape cx={12} cy={12} r={8} />
          </svg>
          Unsupported claim
        </li>
      </ul>

      <section aria-labelledby="window-title" className="rounded-md border border-rule bg-ink p-2">
        <h3 id="window-title" className="flex items-baseline justify-between text-xs text-text-faint">
          Context window
          <span className="font-mono">
            {s.window.length} / {WINDOW_SLOTS}
          </span>
        </h3>
        <ol className="mt-1.5 space-y-1">
          {Array.from({ length: WINDOW_SLOTS }, (_, i) => {
            const c = s.window[i];
            if (!c)
              return (
                <li key={i} className="rounded border border-dashed border-rule px-2 py-1.5 text-xs text-text-faint">
                  Slot {i + 1}: empty
                </li>
              );
            const src = sourceById(c.id);
            return (
              <motion.li
                key={`${c.id}-${c.stale}`}
                initial={c.stale && !reduce ? { x: -6, opacity: 0.4 } : false}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.35 }}
                className={`rounded border bg-panel ${s.selected === i ? "border-signal-blue" : c.stale ? "border-signal-amber" : "border-rule"}`}
              >
                <button
                  type="button"
                  aria-pressed={s.selected === i}
                  aria-label={`Slot ${i + 1}: ${src.title}, ${KIND_LABEL[src.kind]}${c.stale ? ", stale copy" : ""}. ${s.selected === i ? "Selected for discard" : "Select"}`}
                  onClick={() => act({ type: "select", slot: i })}
                  className="flex w-full items-start gap-2 px-2 py-1.5 text-left"
                >
                <KindIcon kind={src.kind} />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-text">{src.title}</span>
                  <span className="block text-[0.6875rem] text-text-dim">
                    {KIND_LABEL[src.kind]} · {src.source} · {src.date}
                    {c.stale && <span className="text-signal-amber"> · stale copy</span>}
                  </span>
                </span>
                </button>
              </motion.li>
            );
          })}
        </ol>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button type="button" aria-keyshortcuts="X" disabled={!s.window.length} onClick={() => act({ type: "discard" })} className={actionBtn}>
            Discard
            <span className="block text-[0.625rem] text-text-faint">{s.selected !== null ? `slot ${s.selected + 1}` : "last"} · X</span>
          </button>
          <button type="button" aria-keyshortcuts="Q" disabled={!s.searchesLeft} onClick={() => act({ type: "search" })} className={actionBtn}>
            Semantic search
            <span className="block text-[0.625rem] text-text-faint">{s.searchesLeft} left · Q</span>
          </button>
          <button type="button" aria-keyshortcuts="V" disabled={!s.verifiesLeft} onClick={() => act({ type: "verify" })} className={actionBtn}>
            Verify
            <span className="block text-[0.625rem] text-text-faint">{s.verifiesLeft} left · V</span>
          </button>
        </div>
        {(s.freezeMoves > 0 || s.searchMoves > 0) && (
          <p className="mt-1.5 text-[0.6875rem] text-text-dim">
            {s.freezeMoves > 0 && `Claims held for ${s.freezeMoves} more ${s.freezeMoves === 1 ? "move" : "moves"}. `}
            {s.searchMoves > 0 && `Search highlights for ${s.searchMoves} more ${s.searchMoves === 1 ? "move" : "moves"}.`}
          </p>
        )}
      </section>

      {here && (
        <div className="rounded-md border border-rule bg-ink p-3 text-sm">
          <p className="text-xs text-text-faint">You&apos;re on</p>
          <p className="text-text">{here.title}</p>
          <p className="text-xs text-text-dim">
            {KIND_LABEL[here.kind]} · {here.source} · {here.date}
          </p>
          <p className="mt-1 text-xs text-text-dim">&ldquo;{here.excerpt}&rdquo;</p>
        </div>
      )}

      <p className="text-xs text-text-faint">
        Move with the arrow keys, WASD, a swipe on the board, or the on-screen pad. Visiting a source collects it. 1 to 5 selects a slot, X discards, Q searches, V verifies. Avoid the unsupported claims; reach the answer core when you&apos;re ready. P pauses.
      </p>
      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-text-dim">
        {s.note}
      </p>
      <p className="sr-only" aria-live="polite">
        Grounding {s.grounding}. Context window {s.window.length} of {WINDOW_SLOTS}.
      </p>
    </div>
  );
}

const STATUS_DOT: Record<string, string> = { Grounded: "bg-signal-teal", "Partly supported": "bg-signal-amber", Unsupported: "bg-text-faint" };

/** The answer composed from the context window, with its status and what's missing. Described, never graded. */
function AnswerStep({ s, onContinue }: { s: MazeState; onContinue: () => void }) {
  const a = composeAnswer(s);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section aria-labelledby="answer-step-title" className="space-y-3">
      <div className="rounded-md border border-rule bg-ink p-3">
        <p className="text-xs text-text-faint">Question · {PRODUCT} (fictional)</p>
        <p className="mt-0.5 text-sm text-text">&ldquo;{QUESTION}&rdquo;</p>
      </div>
      {s.end === "grounding" && <p className="rounded-md border border-signal-amber bg-ink p-3 text-sm text-text">Grounding is low. The answer may not be reliable.</p>}

      <div className="rounded-md border border-rule bg-ink p-3" role="status">
        <h3 id="answer-step-title" ref={headingRef} tabIndex={-1} className="flex items-center gap-2 text-base">
          <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[a.status]}`} />
          {a.status}
        </h3>
        <p className="mt-0.5 text-xs text-text-faint">
          {a.status === "Grounded"
            ? "Three or more current, relevant chunks, and nothing stale or conflicting."
            : a.status === "Partly supported"
              ? "Some current, relevant chunks, but with gaps or a stale or conflicting claim."
              : "Fewer than two current, relevant chunks to stand on."}
        </p>

        {a.lines.length ? (
          <ol className="mt-3 space-y-2">
            {a.lines.map((l, i) => (
              <li key={i} className={`border-l-2 pl-3 ${l.good ? "border-signal-teal" : "border-signal-amber"}`}>
                <p className="text-sm text-text">
                  {l.text} <span className="font-mono text-[0.6875rem] text-text-faint">[{l.tag}]</span>
                </p>
                {l.flag && <p className="text-xs text-signal-amber">{l.flag}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-text-dim">No evidence was collected, so there&apos;s nothing to ground the answer in. Any answer here would be unsupported.</p>
        )}
      </div>

      {(a.missing.length > 0 || a.staleIncluded || a.conflictIncluded) && (
        <div className="rounded-md border border-rule bg-ink p-3">
          <h4 className="text-sm text-text">What&apos;s missing</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text-dim">
            {a.missing.map((m) => (
              <li key={m}>Nothing in the evidence covers {m}.</li>
            ))}
            {a.staleIncluded && <li>A stale or outdated claim is in the answer; it should come from a current source instead.</li>}
            {a.conflictIncluded && <li>A conflicting claim contradicts a current source; the current one should win.</li>}
          </ul>
        </div>
      )}

      <button type="button" onClick={onContinue} className="h-10 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90">
        Continue to the debrief
      </button>
    </section>
  );
}

const SWIPE_PX = 24;

function DpadButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Move ${label.toLowerCase()}`}
      onClick={onPress}
      className="flex h-12 items-center justify-center rounded-md border border-rule bg-panel text-lg text-text active:bg-panel-2"
    >
      {glyph}
    </button>
  );
}

const actionBtn =
  "rounded-md border border-rule bg-panel px-1.5 py-1.5 text-xs text-text transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-panel";

function octagon(cx: number, cy: number, r: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

export const neuralMaze: GameDefinition = {
  tutorial: [
    {
      title: "Move the query cursor",
      body: "Use the arrow keys or WASD. Avoid the wavy unsupported claims. Reach the answer core on the right whenever you're ready to answer.",
    },
    {
      title: "Read the shapes",
      body: "Sources show as ? until you visit them. Then: circle (C) is current and relevant, square (O) is outdated, triangle (X) conflicts with a current source, and a hollow diamond (I) is irrelevant.",
    },
    {
      title: "Window and grounding",
      body: `Visiting a source puts it in your context window, which holds ${WINDOW_SLOTS}; X discards one. Grounding starts at ${GROUNDING.start}: current sources raise it, the rest lower it. Semantic search (Q) and Verify (V) help, twice each.`,
    },
  ],
  Play: NeuralMazePlay,
  demonstrates: [
    "Retrieval quality: current, relevant sources matter more than how many you collect.",
    "Grounded answers: every sentence should trace back to a current source.",
    "Context limits: a small window forces you to keep what's useful and drop the rest.",
    "Verifying sources: checking a chunk against its source catches stale copies.",
  ],
  scoreRewards:
    "Answer quality (50%), the relevance of the evidence you answered from (30%), and how well you used the context window (20%), by keeping current, relevant chunks and discarding the rest. Collecting more sources, or moving faster, doesn't raise it on its own.",
  caseFocus: /semantic search|vector|documentation/i,
};

"use client";

import { Fragment, useEffect, useReducer, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  DECK,
  FALL_MS,
  FIELDS,
  LANES,
  PROPOSED_LABEL,
  blockedReason,
  fieldSpec,
  initialStack,
  stackReducer,
  summariseStack,
  type Card,
  type LaneIndex,
} from "@/lib/arcade/games/stack-link";
import { useGameLoop } from "../use-game-loop";
import type { GameDefinition, PlayProps } from "../types";

const RELAXED_FALL_MS = FALL_MS * 2;
const DROP_PX = 64;
const CARD_PX = 44;

function cardText(c: Card) {
  if (c.kind === "field") return fieldSpec(c.field);
  if (c.kind === "validation") return "Validation rule";
  return `Connector: ${LANES[c.lane]}`;
}
function cardKind(c: Card) {
  if (c.kind === "field") return c.broken ? "Field card, broken data" : "Field card";
  return c.kind === "validation" ? "Validation card" : "Connector card";
}
const CARD_STYLE = (c: Card) =>
  c.kind === "field" ? (c.broken ? "border-dashed border-signal-amber" : "border-signal-blue") : c.kind === "validation" ? "border-signal-teal" : "border-text";

function StackLinkPlay({ relaxed, paused, onFinish }: PlayProps) {
  const reduce = useReducedMotion();
  const [s, dispatch] = useReducer(stackReducer, undefined, initialStack);
  const [hovered, setHovered] = useState(false);
  const active = s.active;
  const falling = !!active && !s.pending && !s.done;

  // The fall: elapsed time in a ref moves the card directly (no re-render per frame).
  const elapsed = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(FALL_MS / 1000));
  const activation = `${active?.key ?? "-"}|${s.queue.length}|${s.pending ? "p" : ""}`;
  const paint = () => {
    const share = Math.min(1, elapsed.current / (relaxed ? RELAXED_FALL_MS : FALL_MS));
    if (cardRef.current) cardRef.current.style.transform = reduce ? "none" : `translateY(${share * (DROP_PX - CARD_PX)}px)`;
    if (fillRef.current) fillRef.current.style.width = `${(1 - share) * 100}%`;
    const left = Math.max(0, Math.ceil((FALL_MS - elapsed.current) / 1000));
    setSecondsLeft((v) => (v === left ? v : left));
  };
  useEffect(() => {
    elapsed.current = 0;
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per card
  }, [activation]);

  useGameLoop(
    (dt) => {
      if (elapsed.current < 0) return;
      elapsed.current += dt;
      if (!relaxed && elapsed.current >= FALL_MS) {
        elapsed.current = -1;
        dispatch({ type: "timeout" });
        return;
      }
      if (relaxed) elapsed.current = Math.min(elapsed.current, RELAXED_FALL_MS);
      paint();
    },
    { running: !paused && falling && !(relaxed && hovered) }
  );

  const act = (a: Parameters<typeof dispatch>[0]) => !paused && dispatch(a);
  const actRef = useRef(act);
  actRef.current = act;

  // Keys: ← → move the card, ↓ or Enter place it, 1 or 2 choose the mapping.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      if (e.key === "ArrowLeft") actRef.current({ type: "move", dir: -1 });
      else if (e.key === "ArrowRight") actRef.current({ type: "move", dir: 1 });
      else if (e.key === "ArrowDown" || e.key === "Enter") actRef.current({ type: "place" });
      else if (e.key === "1") actRef.current({ type: "choose", option: 0 });
      else if (e.key === "2") actRef.current({ type: "choose", option: 1 });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);

  const r = summariseStack(s);

  const finished = useRef(false);
  useEffect(() => {
    if (!s.done || finished.current) return;
    finished.current = true;
    const sum = summariseStack(s);
    const brokenTotal = DECK.filter((c) => c.kind === "field" && c.broken).length;
    onFinish({
      score: sum.score,
      maxScore: sum.maxScore,
      lines: [
        { label: "Integration coverage", value: `${sum.mappedStages} of ${sum.totalStages} stages mapped` },
        { label: "Connections lit", value: `${sum.segments} of ${FIELDS.length * (LANES.length - 1)}` },
        { label: "Completed chains", value: `${sum.chains} of ${FIELDS.length}` },
        { label: "Data quality", value: `${sum.validatedBroken} of ${brokenTotal} broken cards validated first` },
        { label: "Exceptions (simulated)", value: `${sum.exceptions}` },
        ...(s.dropped ? [{ label: "Cards set aside", value: `${s.dropped}` }] : []),
      ],
      table: {
        caption: "Mapped stages per field",
        columns: ["Field", ...LANES],
        rows: FIELDS.map((f) => [f.id, ...s.mapped[f.id].map((v) => (v ? "Mapped" : "–"))]),
      },
    });
  }, [s, onFinish]);

  const lanePct = (l: number) => `${l * 25}%`;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-4 gap-2">
        {[
          ["Coverage", `${r.mappedStages}/${r.totalStages}`],
          ["Data quality", `${r.validatedBroken} ok`],
          ["Exceptions", `${r.exceptions}`],
          ["Chains", `${r.chains}/${FIELDS.length}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-rule bg-ink px-2 py-1.5">
            <dt className="text-[0.625rem] text-text-faint">{k}</dt>
            <dd className={`font-mono text-base tabular-nums ${k === "Exceptions" && r.exceptions > 0 ? "text-signal-amber" : "text-text"}`}>{v}</dd>
          </div>
        ))}
      </dl>

      <div
        role="group"
        aria-label="Integration board"
        aria-describedby="stack-keys"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHovered(false)}
        className="rounded-md border border-rule bg-ink p-2"
      >
        {/* Falling card, over the lane it will land in. */}
        <div className="relative" style={{ height: DROP_PX }}>
          {falling && active && (
            <div
              ref={cardRef}
              className={`absolute top-0 flex flex-col justify-center overflow-hidden rounded-md border-2 bg-panel-2 px-1.5 ${CARD_STYLE(active)}`}
              style={{ left: lanePct(s.lane), width: "25%", height: CARD_PX }}
            >
              <span className="truncate font-mono text-[0.625rem] text-text">{active.kind === "field" ? active.field : active.kind === "validation" ? "validation" : "connector"}</span>
              <span className="truncate text-[0.5625rem] text-text-faint">{active.kind === "field" && active.broken ? "broken" : cardKind(active).split(" ")[0].toLowerCase()}</span>
            </div>
          )}
        </div>

        {/* Lanes: tap a lane to place the card there. Rows are fields; segments light between mapped stages. */}
        <div className="grid grid-cols-[minmax(0,1fr)_0.5rem_minmax(0,1fr)_0.5rem_minmax(0,1fr)_0.5rem_minmax(0,1fr)] gap-y-1.5">
          {LANES.map((name, l) => (
            <Fragment key={name}>
              {l > 0 && <span aria-hidden />}
              <button
                type="button"
                disabled={!falling}
                onClick={() => act({ type: "place", lane: l as LaneIndex })}
                aria-label={`Place the card in ${name}${active && falling ? (blockedReason(s, active, l as LaneIndex) ? `: ${blockedReason(s, active, l as LaneIndex)}` : "") : ""}`}
                className={`flex min-h-[3.25rem] flex-col items-center justify-start rounded-md border px-1 py-1 text-center ${
                  falling && s.lane === l ? "border-signal-blue bg-panel" : "border-rule"
                } ${falling ? "hover:bg-panel-2" : "cursor-default"}`}
              >
                <span className="text-[0.6875rem] font-medium leading-tight text-text">{name}</span>
                {(l === 1 || l === 3) && (
                  <span className={`text-[0.5625rem] ${s.connectors[l as 1 | 3] ? "text-signal-teal" : "text-text-faint"}`}>
                    {s.connectors[l as 1 | 3] ? "connected" : "needs connector"}
                  </span>
                )}
                {l === 3 && <span className="mt-0.5 text-[0.5rem] leading-tight text-signal-amber">{PROPOSED_LABEL}</span>}
              </button>
            </Fragment>
          ))}
          {FIELDS.map((f) =>
            LANES.map((name, l) => {
              const on = s.mapped[f.id][l];
              const seg = l > 0 && on && s.mapped[f.id][l - 1];
              return (
                <Fragment key={`${f.id}-${l}`}>
                  {l > 0 && (
                    <span aria-hidden className="flex items-center">
                      <span className={`h-0.5 w-full rounded-full ${seg ? "bg-signal-teal" : "bg-rule"}`} />
                    </span>
                  )}
                  <span
                    className={`truncate rounded border px-1 py-1 text-center font-mono text-[0.5625rem] ${on ? "border-signal-teal text-text" : "border-dashed border-rule text-text-faint"}`}
                    aria-label={`${f.id} in ${name}: ${on ? "mapped" : "not mapped"}`}
                  >
                    {f.id}
                  </span>
                </Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* The card in hand, in full, and the mapping choice once it's placed. */}
      {s.pending ? (
        <div className="rounded-md border border-signal-blue bg-ink p-3" role="group" aria-labelledby="mapping-title">
          <p id="mapping-title" className="text-sm text-text">
            Map <span className="font-mono">{fieldSpec(s.pending.card.field)}</span> in {LANES[s.pending.lane]}
          </p>
          {s.pending.card.broken && (
            <p className="mt-1 text-xs text-signal-amber">
              Broken data: {s.pending.card.broken}. {s.validations > 0 ? "A validation card is ready." : "No validation card is ready."}
            </p>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {FIELDS.find((f) => f.id === s.pending!.card.field)!.options[s.pending.lane].map((o, i) => (
              <button
                key={o.name}
                type="button"
                onClick={() => act({ type: "choose", option: i as 0 | 1 })}
                aria-keyshortcuts={String(i + 1)}
                className="flex items-baseline justify-between gap-2 rounded-md border border-rule bg-panel px-3 py-2 text-left hover:bg-panel-2"
              >
                <span>
                  <span className="block font-mono text-sm text-text">{o.name}</span>
                  <span className="block text-xs text-text-dim">{o.type}</span>
                </span>
                <span className="rounded border border-rule px-1 font-mono text-[0.625rem] text-text-faint">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        active &&
        !s.done && (
          <div className="rounded-md border border-rule bg-ink p-3">
            <p className="flex items-baseline justify-between gap-2 text-xs text-text-faint">
              <span>
                {cardKind(active)} · {s.queue.length} more to come
              </span>
              {!relaxed && <span className="font-mono tabular-nums">Lands in {secondsLeft}s</span>}
            </p>
            <p className="mt-1 font-mono text-sm text-text">{cardText(active)}</p>
            {active.kind === "field" && active.broken && <p className="mt-0.5 text-xs text-signal-amber">Broken: {active.broken}</p>}
            <p className="mt-1 text-xs text-text-dim">
              Over {LANES[s.lane]}
              {blockedReason(s, active, s.lane) ? `: ${blockedReason(s, active, s.lane)}.` : "."}
              {s.validations > 0 && ` Validation ready: ${s.validations}.`}
            </p>
            {!relaxed && (
              <div aria-hidden className="mt-2 h-1 rounded-full bg-panel-2">
                <div ref={fillRef} className="h-1 rounded-full bg-signal-blue" />
              </div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" aria-keyshortcuts="ArrowLeft" onClick={() => act({ type: "move", dir: -1 })} className={ctrl}>
                ← Left
              </button>
              <button type="button" aria-keyshortcuts="ArrowRight" onClick={() => act({ type: "move", dir: 1 })} className={ctrl}>
                Right →
              </button>
              <button type="button" aria-keyshortcuts="ArrowDown Enter" onClick={() => act({ type: "place" })} className={primaryCtrl}>
                Place ↓
              </button>
            </div>
          </div>
        )
      )}

      <p id="stack-keys" className="text-xs text-text-faint">
        Move the card with ← → or the buttons, or tap a lane. ↓ or Enter places it; 1 or 2 picks the mapping. P pauses.
      </p>
      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-text-dim">
        {s.note}
      </p>
    </div>
  );
}

const ctrl = "h-11 rounded-md border border-rule px-2 text-sm text-text transition-colors hover:bg-panel-2";
const primaryCtrl = "h-11 rounded-md bg-text px-2 text-sm font-medium text-ink transition-opacity hover:opacity-90";

export const stackLink: GameDefinition = {
  tutorial: [
    {
      title: "Four stages, three fields",
      body: "Data moves through CRM, Middleware, ERP and a proposed service platform. Three fictional fields need mapping at every stage: customer_id, credit_limit and billing_email.",
    },
    {
      title: "Place each card",
      body: "Cards fall one at a time. Move one over a lane with the arrow keys or buttons, or tap a lane, and place it. A field can only connect to a stage once the stage before it is mapped, and Middleware and the service platform each need their connector card first.",
    },
    {
      title: "Map by meaning and type",
      body: "Placing a field asks you to pick its target field from two options. The one that matches its meaning and type lights the connection; the other sends failing records downstream as exceptions.",
    },
    {
      title: "Broken data and chains",
      body: "Some field cards carry broken data and need a validation card first, or they map with exceptions. Mapping a field through all four stages completes a chain. Relaxed mode removes the timer.",
    },
  ],
  Play: StackLinkPlay,
  demonstrates: [
    "Mapping fields by meaning and type, not by similar-looking names.",
    "Building an integration upstream first, so each stage has something to connect to.",
    "Validating data before it moves, so bad records don't become downstream exceptions.",
  ],
  scoreRewards:
    "Integration coverage (stages mapped), data quality (broken data validated first) and completed chains, minus simulated exceptions from mismatched mappings and unvalidated data. Speed and clicks don't count.",
  caseFocus: /sync|master data/i,
};

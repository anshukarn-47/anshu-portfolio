"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BEST_NET,
  DECISION_SECONDS,
  PROCESSES,
  ZONES,
  evaluate,
  manualHours,
  totals,
  zoneLabel,
  type Process,
  type Zone,
} from "@/lib/arcade/games/automation-bundles";
import { useGameLoop } from "../use-game-loop";
import type { GameDefinition, PlayProps } from "../types";

const hours = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 10) / 10)}`;
const DRAG_THRESHOLD_PX = 6;

/** Facts on a card, in words (never colour alone). */
function facts(p: Process) {
  return [
    `${p.volume[0].toUpperCase()}${p.volume.slice(1)} volume`,
    p.stable ? "Stable" : "Unstable",
    p.ruleBased ? "Rule-based" : "Needs judgement",
    `${p.exceptionRate}% exceptions`,
  ];
}

/**
 * Pointer drag that works for mouse, pen and touch: the element follows the
 * pointer, and on release whatever [data-zone] is under it receives the card.
 * A press without movement counts as a click (select).
 */
function useDrag(onDrop: (id: string, zone: Zone) => void, onClick: (id: string) => void, disabled: boolean) {
  const drag = useRef<{ id: string; el: HTMLElement; x: number; y: number; moved: boolean } | null>(null);
  const [over, setOver] = useState<Zone | null>(null);
  const zoneAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const z = (el as HTMLElement).dataset?.zone as Zone | undefined;
      if (z) return z;
    }
    return null;
  };
  const bind = (id: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Without capture the drag still works while the pointer stays over the page.
      }
      drag.current = { id, el: e.currentTarget, x: e.clientX, y: e.clientY, moved: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      d.el.style.transform = `translate(${dx}px, ${dy}px)`;
      d.el.style.zIndex = "30";
      d.el.style.pointerEvents = "none";
      setOver(zoneAt(e.clientX, e.clientY));
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      d.el.style.transform = "";
      d.el.style.zIndex = "";
      d.el.style.pointerEvents = "";
      setOver(null);
      if (!d.moved) return onClick(d.id);
      const z = zoneAt(e.clientX, e.clientY);
      if (z) onDrop(d.id, z);
    },
    onPointerCancel: () => {
      const d = drag.current;
      drag.current = null;
      if (d) {
        d.el.style.transform = "";
        d.el.style.zIndex = "";
        d.el.style.pointerEvents = "";
      }
      setOver(null);
    },
  });
  return { bind, over };
}

function AutomationBundlesPlay({ relaxed, paused, onFinish }: PlayProps) {
  const reduce = useReducedMotion();
  const [assign, setAssign] = useState<Record<string, Zone>>({});
  const [index, setIndex] = useState(0);
  /** A placed card picked up to move (by click or keyboard). The incoming card is the target otherwise. */
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const incoming = index < PROCESSES.length ? PROCESSES[index] : null;
  const target = selected ?? incoming?.id ?? null;
  const t = totals(assign);
  const outcomes = evaluate(assign);
  const outcomeOf = (id: string) => outcomes.find((o) => o.process.id === id);

  const place = (id: string, zone: Zone, reason?: string) => {
    if (paused) return;
    const p = PROCESSES.find((x) => x.id === id)!;
    const next = { ...assign, [id]: zone };
    const delta = totals(next).net - totals(assign).net;
    setAssign(next);
    setSelected(null);
    if (incoming && id === incoming.id) setIndex((i) => i + 1);
    const o = evaluate(next).find((x) => x.process.id === id)!;
    setNote(`${reason ?? ""}${p.name}: ${zoneLabel(zone)}. ${o.note}. Net change ${hours(delta)} simulated hours a month.`);
  };

  // Decision timer for the incoming card (normal mode only). When it runs out, the card stays manual.
  const elapsed = useRef(0);
  const fillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    elapsed.current = 0;
    if (fillRef.current) fillRef.current.style.width = "100%";
  }, [index]);
  const placeRef = useRef(place);
  placeRef.current = place;
  useGameLoop(
    (dt) => {
      if (!incoming) return;
      elapsed.current += dt;
      const share = Math.min(1, elapsed.current / (DECISION_SECONDS * 1000));
      if (fillRef.current) fillRef.current.style.width = `${(1 - share) * 100}%`;
      if (share >= 1) {
        elapsed.current = 0;
        placeRef.current(incoming.id, "manual", "No decision in time, so it stays manual for now. ");
      }
    },
    { running: !paused && !relaxed && !!incoming }
  );

  // Keys 1–4 send the target card to a zone; Escape puts a picked-up card back down.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.metaKey || e.ctrlKey || e.altKey) return;
      const z = ZONES.find((x) => x.key === e.key);
      if (z && target) {
        e.preventDefault();
        placeRef.current(target, z.id);
      } else if (e.key === "Escape" && selected) setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, target, selected]);

  const toggleSelect = (id: string) => setSelected((s) => (s === id || id === incoming?.id ? null : id));
  const { bind, over } = useDrag((id, zone) => place(id, zone), toggleSelect, paused);

  const finish = () => {
    const byZone = ZONES.map((z) => {
      const os = outcomes.filter((o) => o.zone === z.id);
      return [z.label, `${os.length}`, hours(os.reduce((n, o) => n + o.net, 0))];
    });
    onFinish({
      score: Math.round(t.net),
      maxScore: Math.round(BEST_NET),
      lines: [
        { label: "Net hours saved a month (simulated)", value: hours(t.net) },
        { label: "Coverage", value: `${t.coverage}% (${t.automated} of ${PROCESSES.length} automated)` },
        { label: "Exceptions a month (simulated)", value: `${t.exceptions}` },
        { label: "Manual hours left on strong candidates", value: `${Math.round(t.hoursLeftOnTable)} a month` },
      ],
      table: { caption: "By zone (simulated hours a month)", columns: ["Zone", "Processes", "Net hours"], rows: byZone },
    });
  };

  const allSorted = !incoming;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Hours saved · simulated</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{hours(t.net)}</dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Coverage</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-text">{t.coverage}%</dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-2.5 py-2">
          <dt className="text-[0.6875rem] text-text-faint">Exceptions · a month</dt>
          <dd className={`mt-0.5 font-mono text-lg tabular-nums ${t.exceptions > 100 ? "text-signal-amber" : "text-text"}`}>{t.exceptions}</dd>
        </div>
      </dl>

      {incoming ? (
        <div className="rounded-md border border-rule bg-ink p-3">
          <p className="flex items-baseline justify-between gap-2 text-xs text-text-faint">
            <span>
              Process {index + 1} of {PROCESSES.length}
            </span>
            {!relaxed && <span>{DECISION_SECONDS}s to decide</span>}
          </p>
          <motion.div
            key={incoming.id}
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              {...bind(incoming.id)}
              role="group"
              aria-roledescription="process card"
              aria-label={`${incoming.name}, ${incoming.system}. ${facts(incoming).join(", ")}.`}
              aria-describedby="bundles-keys"
              className={`relative mt-2 cursor-grab touch-none select-none rounded-md border-2 bg-panel p-3 active:cursor-grabbing ${
                selected ? "border-rule" : "border-signal-blue"
              }`}
            >
              <p className="text-base text-text">{incoming.name}</p>
              <p className="mt-0.5 font-mono text-xs text-text-dim">
                {incoming.id} · {incoming.system} · about {Math.round(manualHours(incoming))} manual hours a month
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {facts(incoming).map((f) => (
                  <li key={f} className="rounded border border-rule px-1.5 py-0.5 text-xs text-text-dim">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
          {!relaxed && (
            <div aria-hidden className="mt-2 h-1 rounded-full bg-panel-2">
              <div ref={fillRef} className="h-1 rounded-full bg-signal-blue" />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-rule bg-ink p-3">
          <p className="text-sm text-text">All twelve are sorted.</p>
          <p className="mt-1 text-sm text-text-dim">Move any card between zones if you like, then run the month.</p>
          <button
            type="button"
            onClick={finish}
            className="mt-3 h-11 rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            Run the month
          </button>
        </div>
      )}

      {selected && (
        <p className="text-sm text-text">
          Moving <span className="font-medium">{PROCESSES.find((p) => p.id === selected)?.name}</span>: choose a zone, press 1 to 4, or Escape to cancel.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {ZONES.map((z) => {
          const items = PROCESSES.filter((p) => assign[p.id] === z.id);
          const sum = items.reduce((n, p) => n + (outcomeOf(p.id)?.net ?? 0), 0);
          return (
            <section
              key={z.id}
              data-zone={z.id}
              aria-label={`${z.label}: ${items.length} ${items.length === 1 ? "process" : "processes"}`}
              className={`flex min-h-[9rem] flex-col rounded-md border bg-ink p-2 transition-colors ${over === z.id ? "border-signal-blue bg-panel" : "border-rule"}`}
            >
              <button
                type="button"
                disabled={!target || paused}
                onClick={() => target && place(target, z.id)}
                aria-keyshortcuts={z.key}
                className="flex w-full items-start justify-between gap-2 rounded px-1 py-1 text-left hover:bg-panel-2 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span>
                  <span className="block text-sm font-medium text-text">{z.label}</span>
                  <span className="hidden text-[0.6875rem] text-text-faint sm:block">{z.hint}</span>
                </span>
                <span className="shrink-0 rounded border border-rule px-1.5 font-mono text-xs text-text-dim">{z.key}</span>
              </button>
              <ul className="mt-2 flex flex-1 flex-col gap-1.5">
                {items.map((p) => {
                  const o = outcomeOf(p.id)!;
                  const picked = selected === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        {...bind(p.id)}
                        // Pointer presses are handled by the drag; this is Enter or Space from the keyboard.
                        onClick={(e) => e.detail === 0 && toggleSelect(p.id)}
                        aria-pressed={picked}
                        aria-label={`${p.name}, ${p.system}, ${hours(o.net)} simulated hours. ${picked ? "Picked up" : "Pick up to move"}`}
                        className={`w-full touch-none select-none rounded border bg-panel px-2 py-1 text-left ${picked ? "border-signal-blue" : "border-rule"}`}
                      >
                        <span className="block truncate text-xs text-text">{p.name}</span>
                        <span className="flex justify-between gap-2 font-mono text-[0.625rem] text-text-faint">
                          <span className="truncate">{p.system}</span>
                          <span className={o.net < 0 ? "text-signal-amber" : ""}>{hours(o.net)}h</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {items.length > 0 && <p className="mt-1.5 text-right font-mono text-[0.6875rem] text-text-faint">{hours(sum)}h · simulated</p>}
            </section>
          );
        })}
      </div>

      <p id="bundles-keys" className="text-xs text-text-faint">
        Drag a card to a zone, or tap a zone, or press 1 to 4. Tap a sorted card to pick it up and move it. P pauses.
      </p>
      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-text-dim">
        {note}
      </p>
      {allSorted && <span className="sr-only">All processes are sorted. The Run the month button finishes the run.</span>}
    </div>
  );
}

export const automationBundles: GameDefinition = {
  tutorial: [
    {
      title: "Twelve processes, four zones",
      body: "Fictional business processes arrive one at a time. Each card shows its system, volume, stability, whether it's rule-based, and how often it needs a person.",
    },
    {
      title: "Sort each one",
      body: "Drag the card to a zone, tap a zone, or press 1 to 4: Automate now, Bundle with others, Redesign first, or Leave manual. Tap a sorted card to pick it up and move it.",
    },
    {
      title: "What changes the hours",
      body: "Bundles on the same system share the build and save more. Unstable processes throw exceptions once automated. Busy, stable, rule-based work left manual keeps costing the team hours. All hours are simulated.",
    },
    {
      title: "Then run the month",
      body: "When all twelve are sorted, run the month to see the result. Each card has a timer; relaxed mode removes it.",
    },
  ],
  Play: AutomationBundlesPlay,
  demonstrates: [
    "Choosing what to automate by net value, not by how much gets automated.",
    "Spotting processes that need redesign before automation, so exceptions don't eat the savings.",
    "Grouping automations on the same system so they share the build and the upkeep.",
  ],
  scoreRewards:
    "Net simulated hours saved a month: the work automation takes over, minus exception handling and upkeep, plus what redesign recovers later. Coverage on its own doesn't count, and neither do speed or clicks.",
  caseFocus: /mentored|power automate|python/i,
};

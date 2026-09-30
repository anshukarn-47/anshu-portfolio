"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BALANCE_LABELS, BALANCE_START, type Balance, type BalanceChange, type BalanceKey } from "./model";

const METERS: BalanceKey[] = ["service", "cost", "capacity"];
/** Radar axes, clockwise from the top. */
const AXES: { key: BalanceKey; angle: number }[] = [
  { key: "service", angle: -90 },
  { key: "cost", angle: 0 },
  { key: "capacity", angle: 90 },
  { key: "risk", angle: 180 },
];

/** Whether a change is an improvement, given which direction is better for that measure. */
const improves = (k: BalanceKey, delta: number) => (BALANCE_LABELS[k].better === "higher" ? delta > 0 : delta < 0);

/**
 * Network Balance: Service, Cost and Capacity meters from the player's
 * decisions so far (see balanceChanges), with the reasons they moved, and the
 * Network Radar: SLA / Cost / Capacity / Risk on four axes, redrawn as the
 * balance changes, with its centre point marked.
 */
export function NetworkBalance({ balance, changes }: { balance: Balance; changes: BalanceChange[] }) {
  return (
    <section aria-labelledby="balance-title" className="mt-4 rounded-lg border border-rule bg-panel p-4">
      <h3 id="balance-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
        Network balance
      </h3>
      <div className="mt-3 grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div>
          <ul className="space-y-3">
            {METERS.map((k) => (
              <Meter key={k} k={k} value={balance[k]} />
            ))}
          </ul>
          <div className="mt-4">
            <h4 className="text-xs text-text-faint">Why it moved</h4>
            {changes.length === 0 ? (
              <p className="mt-1 text-sm text-text-faint">Start of day. Your decisions will shift the balance.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {changes.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-text-dim">
                    <span className="font-mono text-xs text-text-faint">{c.source}</span>
                    <span>{c.reason}</span>
                    <span className="font-mono text-xs">
                      {(Object.entries(c.deltas) as [BalanceKey, number][]).map(([k, d]) => (
                        <span key={k} className={`mr-2 ${improves(k, d) ? "text-signal-teal" : "text-signal-amber"}`}>
                          {BALANCE_LABELS[k].label} {d > 0 ? "+" : "−"}
                          {Math.abs(d)}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <Radar balance={balance} />
      </div>
    </section>
  );
}

function Meter({ k, value }: { k: BalanceKey; value: number }) {
  const meta = BALANCE_LABELS[k];
  const delta = value - BALANCE_START[k];
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-text">
          {meta.label} <span className="text-xs text-text-faint">({meta.better} is better)</span>
        </span>
        <span className="font-mono tabular-nums text-text">
          {value}
          {delta !== 0 && (
            <span className={`ml-2 text-xs ${improves(k, delta) ? "text-signal-teal" : "text-signal-amber"}`}>
              {delta > 0 ? "+" : "−"}
              {Math.abs(delta)}
            </span>
          )}
        </span>
      </div>
      <div
        role="meter"
        aria-label={meta.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} out of 100${delta ? `, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} since the start of the day` : ""}`}
        className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2"
      >
        <div className="h-full rounded-full bg-signal-blue motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${value}%` }} />
        {/* Start-of-day marker */}
        <span aria-hidden className="absolute top-0 h-full w-px bg-text-faint" style={{ left: `${BALANCE_START[k]}%` }} />
      </div>
    </li>
  );
}

const SIZE = 220;
const C = SIZE / 2;
const R = 78;

function point(angle: number, value: number) {
  const rad = (angle * Math.PI) / 180;
  const r = (value / 100) * R;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}
const polygon = (b: Balance) =>
  AXES.map((a) => {
    const p = point(a.angle, b[a.key]);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");

function Radar({ balance }: { balance: Balance }) {
  const reduce = !!useReducedMotion();
  const pts = AXES.map((a) => point(a.angle, balance[a.key]));
  const center = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  const transition = reduce ? { duration: 0 } : { duration: 0.6, ease: [0.2, 0, 0, 1] as const };

  return (
    <figure className="mx-auto w-full max-w-[15rem]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-labelledby="radar-title radar-desc" className="h-auto w-full">
        <title id="radar-title">Network radar</title>
        <desc id="radar-desc">
          {AXES.map((a) => `${BALANCE_LABELS[a.key].radar} ${balance[a.key]}`).join(", ")}. The dashed shape is the start of the day.
        </desc>
        {/* Rings and axes */}
        {[25, 50, 75, 100].map((v) => (
          <circle key={v} cx={C} cy={C} r={(v / 100) * R} className="fill-none stroke-rule" strokeWidth={1} />
        ))}
        {AXES.map((a) => {
          const end = point(a.angle, 100);
          // Top and bottom labels sit past the axis end; side labels sit just above it, anchored inwards.
          const side = a.angle === 0 ? "right" : a.angle === 180 ? "left" : null;
          const label = side ? { x: side === "right" ? SIZE - 2 : 2, y: C - 12 } : point(a.angle, 124);
          return (
            <g key={a.key}>
              <line x1={C} y1={C} x2={end.x} y2={end.y} className="stroke-rule" strokeWidth={1} />
              <text
                x={label.x}
                y={label.y + 4}
                textAnchor={side === "right" ? "end" : side === "left" ? "start" : "middle"}
                className="fill-text-dim font-mono text-[10px]"
              >
                {BALANCE_LABELS[a.key].radar} {balance[a.key]}
              </text>
            </g>
          );
        })}
        {/* Start of day */}
        <polygon points={polygon(BALANCE_START)} className="fill-none stroke-text-faint" strokeWidth={1} strokeDasharray="3 3" />
        {/* Now */}
        <motion.polygon
          initial={false}
          animate={{ points: polygon(balance) }}
          transition={transition}
          className="fill-signal-blue stroke-signal-blue"
          fillOpacity={0.18}
          strokeWidth={1.5}
        />
        <motion.circle initial={false} animate={{ cx: center.x, cy: center.y }} transition={transition} r={3.5} className="fill-signal-blue" />
      </svg>
      <figcaption className="mt-1 text-center text-xs text-text-faint">Dashed: start of day · Dot: balance point</figcaption>
    </figure>
  );
}

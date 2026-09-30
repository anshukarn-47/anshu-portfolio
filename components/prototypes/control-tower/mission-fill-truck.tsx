"use client";

import { useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import { dotClass, statusText } from "@/components/prototypes/engine/status";
import {
  FLEET,
  INCOMING,
  ORDERS,
  RISK_LABEL,
  RISK_STATUS,
  dispatchImpact,
  fits,
  inr,
  loadOf,
  orderById,
  truckById,
  truckUnavailableReason,
  type Order,
} from "./model";

export type DispatchResult = { impact: ReturnType<typeof dispatchImpact>; loaded: string[] };

const DEFAULT_TRUCK = "TK-07";

/**
 * Mission 01 — Fill the Truck. Pick a truck, drag orders onto it (or use the
 * Add / Remove buttons: native drag and drop doesn't work with a keyboard or on
 * most touch screens), watch utilisation, then dispatch. Capacity can't be
 * exceeded. The impact is computed from the combination (see dispatchImpact).
 */
export function MissionFillTruck({ result, onDispatch }: { result: DispatchResult | null; onDispatch: (r: DispatchResult) => void }) {
  const [truckId, setTruckId] = useState(DEFAULT_TRUCK);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const truck = truckById(truckId);
  const load = loadOf(loaded);
  const pending = ORDERS.filter((o) => !loaded.includes(o.id));

  function add(id: string) {
    if (loaded.includes(id)) return;
    if (!fits(truck, loaded, id)) {
      const o = orderById(id);
      setMessage(`Order #${o.id} (${o.demand} KL) won't fit: ${truck.capacity - load} KL left on ${truck.id}.`);
      return;
    }
    setLoaded((l) => [...l, id]);
    setMessage(null);
  }
  function remove(id: string) {
    setLoaded((l) => l.filter((x) => x !== id));
    setMessage(null);
  }
  function chooseTruck(id: string) {
    const next = truckById(id);
    // Keep what still fits, in loading order; the rest goes back to pending.
    const kept: string[] = [];
    for (const o of loaded) if (loadOf(kept) + orderById(o).demand <= next.capacity) kept.push(o);
    const dropped = loaded.filter((o) => !kept.includes(o));
    setTruckId(id);
    setLoaded(kept);
    setMessage(dropped.length ? `${dropped.map((o) => `#${o}`).join(", ")} didn't fit on ${next.id} and went back to pending.` : null);
  }

  if (result) return <DispatchReveal result={result} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <IncomingOrder />
        <FleetTable selected={truckId} onSelect={chooseTruck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pending orders: also a drop zone, to take an order back off the truck. */}
        <section
          aria-labelledby="pending-title"
          onDragOver={(e) => {
            if (dragging && loaded.includes(dragging)) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain");
            if (loaded.includes(id)) remove(id);
          }}
          className="rounded-lg border border-rule bg-panel p-4"
        >
          <h4 id="pending-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
            Pending orders · Delhi region
          </h4>
          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-text-faint">All orders are on the truck.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pending.map((o) => (
                <li key={o.id}>
                  <OrderChip
                    order={o}
                    onDragStart={() => setDragging(o.id)}
                    onDragEnd={() => setDragging(null)}
                    action={{ label: "Add", onClick: () => add(o.id), disabled: !fits(truck, loaded, o.id), hint: `Add order #${o.id} to ${truck.id}` }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <TruckSlot
          truckId={truckId}
          loaded={loaded}
          dragging={dragging}
          message={message}
          onDrop={add}
          onRemove={remove}
          onDragStart={setDragging}
          onDispatch={() => onDispatch({ impact: dispatchImpact(truckId, loaded), loaded })}
        />
      </div>
    </div>
  );
}

function IncomingOrder() {
  const o = INCOMING;
  return (
    <section aria-labelledby="incoming-title" className="rounded-lg border border-signal-blue bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 id="incoming-title" className="font-mono text-xs uppercase tracking-wider text-signal-blue">
          Incoming order
        </h4>
        <StatusPill tone="alert">Priority: {o.priority}</StatusPill>
      </div>
      <p className="mt-2 text-lg text-text">Order #{o.id}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-text-faint">Customer</dt>
        <dd className="text-text">{o.customer}</dd>
        <dt className="text-text-faint">Demand</dt>
        <dd className="font-mono tabular-nums text-text">{o.demand} KL</dd>
        <dt className="text-text-faint">SLA</dt>
        <dd className="font-mono tabular-nums text-text">{o.slaHours} hrs</dd>
      </dl>
      <p className="mt-3 text-sm text-text-dim">
        You decide how to fulfil it. Send it alone on a truck that fits, or pick a bigger truck and consolidate other pending
        orders heading the same way. Fuller trucks cost less per KL, but orders left behind wait for the next truck.
      </p>
    </section>
  );
}

function FleetTable({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <section aria-labelledby="fleet-title" className="rounded-lg border border-rule bg-panel p-4">
      <h4 id="fleet-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
        Available fleet
      </h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Trucks: choose one to load. Only available fuel trucks can take today&apos;s orders.</caption>
          <thead className="text-xs text-text-faint">
            <tr>
              <th scope="col" className="py-1.5 pr-3 font-normal">Truck</th>
              <th scope="col" className="py-1.5 pr-3 font-normal">Capacity</th>
              <th scope="col" className="py-1.5 pr-3 font-normal">Type</th>
              <th scope="col" className="py-1.5 pr-3 font-normal">Status</th>
              <th scope="col" className="py-1.5 font-normal">
                <span className="sr-only">Load</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {FLEET.map((t) => {
              const reason = truckUnavailableReason(t);
              const isSelected = t.id === selected;
              return (
                <tr key={t.id} className={isSelected ? "bg-panel-2" : ""}>
                  <th scope="row" className="py-2 pr-3 font-mono font-normal text-text">
                    {t.id}
                  </th>
                  <td className="py-2 pr-3 font-mono tabular-nums text-text">{t.capacity} KL</td>
                  <td className="py-2 pr-3 text-text-dim">{t.type}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-1.5 text-text-dim">
                      <span aria-hidden className={dotClass(t.status === "Available" ? "stable" : "inactive")} />
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {reason ? (
                      <span className="text-xs text-text-faint">{reason}</span>
                    ) : isSelected ? (
                      <span className="text-xs text-signal-blue">Loading</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(t.id)}
                        className="rounded border border-rule px-2 py-0.5 text-xs text-text-dim hover:bg-panel-2 hover:text-text"
                      >
                        Load this truck<span className="sr-only"> ({t.id})</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderChip({
  order: o,
  onDragStart,
  onDragEnd,
  action,
}: {
  order: Order;
  onDragStart: () => void;
  onDragEnd: () => void;
  action: { label: string; onClick: () => void; disabled?: boolean; hint: string };
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", o.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`flex cursor-grab items-center gap-3 rounded-md border bg-ink px-3 py-2 active:cursor-grabbing ${
        o.incoming ? "border-signal-blue" : "border-rule"
      }`}
    >
      <span aria-hidden className="select-none text-text-faint">
        ⠿
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-sm text-text">#{o.id}</span>
          <span className="truncate text-sm text-text-dim">{o.customer}</span>
        </span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-text-faint">
          <span className={o.priority === "High" ? "text-signal-amber" : ""}>{o.priority}</span>
          <span className="font-mono tabular-nums">SLA {o.slaHours} h</span>
        </span>
      </span>
      <span className="font-mono text-sm tabular-nums text-text">{o.demand} KL</span>
      <button
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        aria-label={action.hint}
        className="rounded border border-rule px-2 py-0.5 text-xs text-text-dim hover:bg-panel-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
      >
        {action.label}
      </button>
    </div>
  );
}

function TruckSlot({
  truckId,
  loaded,
  dragging,
  message,
  onDrop,
  onRemove,
  onDragStart,
  onDispatch,
}: {
  truckId: string;
  loaded: string[];
  dragging: string | null;
  message: string | null;
  onDrop: (id: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string | null) => void;
  onDispatch: () => void;
}) {
  const truck = truckById(truckId);
  const load = loadOf(loaded);
  const pct = Math.round((load / truck.capacity) * 100);
  const [over, setOver] = useState(false);
  const draggingPending = !!dragging && !loaded.includes(dragging);
  const willFit = draggingPending && fits(truck, loaded, dragging!);
  const statusRef = useRef<HTMLParagraphElement>(null);

  return (
    <section
      aria-labelledby="truck-slot-title"
      onDragOver={(e) => {
        if (draggingPending) {
          e.preventDefault(); // allow the drop; add() explains if it doesn't fit
          e.dataTransfer.dropEffect = willFit ? "move" : "none";
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop(e.dataTransfer.getData("text/plain"));
      }}
      className={`rounded-lg border-2 border-dashed p-4 motion-safe:transition-colors ${
        over ? (willFit ? "border-signal-teal bg-panel-2" : "border-signal-red bg-panel-2") : draggingPending ? "border-signal-blue bg-panel" : "border-rule bg-panel"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 id="truck-slot-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
          Truck {truck.id} · {truck.type}
        </h4>
        <span className="font-mono text-sm tabular-nums text-text">
          {load} / {truck.capacity} KL
        </span>
      </div>

      <div
        role="meter"
        aria-label={`${truck.id} utilisation`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% full, ${load} of ${truck.capacity} KL`}
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-panel-2"
      >
        <div
          className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${pct >= 85 ? "bg-signal-teal" : "bg-signal-blue"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-text-faint">
        <span className="font-mono tabular-nums">{pct}%</span> utilisation · {truck.capacity - load} KL free
      </p>

      {loaded.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-rule px-3 py-6 text-center text-sm text-text-faint">
          Drag orders here, or use Add.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {loaded.map((id) => {
            const o = orderById(id);
            return (
              <li key={id}>
                <OrderChip
                  order={o}
                  onDragStart={() => onDragStart(id)}
                  onDragEnd={() => onDragStart(null)}
                  action={{ label: "Remove", onClick: () => onRemove(id), hint: `Remove order #${id} from ${truck.id}` }}
                />
              </li>
            );
          })}
        </ul>
      )}

      <p ref={statusRef} role="status" className={`mt-3 min-h-[1.25rem] text-sm ${message ? "text-signal-red" : "text-text-faint"}`}>
        {message ?? (draggingPending && !willFit ? `Won't fit: ${truck.capacity - load} KL left.` : "")}
      </p>

      <button
        type="button"
        disabled={loaded.length === 0}
        onClick={onDispatch}
        className="mt-2 h-10 w-full rounded-md bg-text px-4 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Dispatch {truck.id}
      </button>
    </section>
  );
}

/** After dispatch: what the combination did to cost, fleet efficiency and SLA risk. */
function DispatchReveal({ result }: { result: DispatchResult }) {
  const { impact, loaded } = result;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const atRisk = impact.leftBehind.filter((l) => l.risk !== "normal");
  const fine = impact.leftBehind.filter((l) => l.risk === "normal");

  return (
    <section aria-labelledby="impact-title" className="rounded-lg border border-rule bg-panel p-4 sm:p-5">
      <h4 id="impact-title" ref={headingRef} tabIndex={-1} className="text-lg">
        {impact.truck.id} dispatched
      </h4>
      <p className="mt-1 text-sm text-text-dim">
        {loaded.map((id) => `#${id}`).join(", ")} · {impact.load} / {impact.truck.capacity} KL ({impact.utilisation}% full)
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-rule bg-ink px-3 py-2">
          <dt className="text-xs text-text-faint">{impact.avoidedCost >= 0 ? "Avoided transport cost" : "Extra transport cost"}</dt>
          <dd className={`mt-0.5 font-mono text-xl tabular-nums ${impact.avoidedCost > 0 ? "text-signal-teal" : impact.avoidedCost < 0 ? "text-signal-amber" : "text-text"}`}>
            {inr.format(Math.abs(impact.avoidedCost))}
          </dd>
          <dd className="text-xs text-text-dim">vs sending each order on its own truck</dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-3 py-2">
          <dt className="text-xs text-text-faint">Fleet efficiency</dt>
          <dd className={`mt-0.5 font-mono text-xl tabular-nums ${impact.efficiencyDelta >= 0 ? "text-signal-teal" : "text-signal-amber"}`}>
            {impact.efficiencyDelta >= 0 ? "+" : "−"}
            {Math.abs(impact.efficiencyDelta)}%
          </dd>
          <dd className="text-xs text-text-dim">{impact.utilisation}% truck utilisation vs 72% network average</dd>
        </div>
        <div className="rounded-md border border-rule bg-ink px-3 py-2">
          <dt className="text-xs text-text-faint">SLA risk</dt>
          <dd className={`mt-0.5 font-mono text-xl tabular-nums ${atRisk.length ? statusText[RISK_STATUS[atRisk.some((l) => l.risk === "critical") ? "critical" : "at-risk"]] : "text-signal-teal"}`}>
            {atRisk.length ? `${atRisk.length} order${atRisk.length > 1 ? "s" : ""} at risk` : "No new risk"}
          </dd>
          <dd className="text-xs text-text-dim">SLA {impact.slaDelta === 0 ? "unchanged" : `−${Math.abs(impact.slaDelta)} pts`}</dd>
        </div>
      </dl>

      {impact.leftBehind.length > 0 && (
        <div className="mt-4">
          <h5 className="text-sm font-medium text-text">Orders left for the next truck</h5>
          <p className="text-xs text-text-faint">The next truck can deliver in about 3.5 hours.</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {[...atRisk, ...fine].map(({ order: o, risk }) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-text-dim">
                  <span className="font-mono text-text">#{o.id}</span> {o.customer} · SLA {o.slaHours} h · {o.priority}
                </span>
                <span className={`flex items-center gap-1.5 ${statusText[RISK_STATUS[risk]]}`}>
                  <span aria-hidden className={dotClass(RISK_STATUS[risk])} />
                  {RISK_LABEL[risk]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-text-faint">Mission 01 complete. Mission 02 is below.</p>
    </section>
  );
}
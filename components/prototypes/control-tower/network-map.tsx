"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CUSTOMER_DEMAND,
  CUSTOMER_TYPES,
  NODE_CUSTOMERS,
  type CustomerType,
  DEPOT_FLEET,
  DEPOT_INVENTORY,
  DISPATCH_PATH,
  LEG_SECONDS,
  MAP_LAYERS,
  MOVING_TRUCKS,
  NODES,
  RISK_LABEL,
  ROUTES,
  inventoryLevel,
  riskLevel,
  type MapLayer,
  type MapNode,
  type RouteRisk,
} from "./model";

const byId = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<string, MapNode>;

/** Risk colour (a stroke class) plus a dash pattern per level, so risk never relies on colour alone. */
const RISK_STYLE: Record<RouteRisk, { stroke: string; fill: string; dash?: string; width: number }> = {
  normal: { stroke: "stroke-signal-teal", fill: "fill-signal-teal", width: 1.5 },
  "at-risk": { stroke: "stroke-signal-amber", fill: "fill-signal-amber", dash: "7 5", width: 2.25 },
  critical: { stroke: "stroke-signal-red", fill: "fill-signal-red", dash: "3 4", width: 2.75 },
};

/**
 * The control tower's live map: suppliers → depots → customer zones, five
 * layers (Network, Inventory, Fleet, Demand, Risk), and a few trucks shuttling
 * slowly along their routes. Everything is mock data from model.ts. With
 * reduced motion, trucks and demand rings are drawn still.
 */
export type MapOverlay = {
  /** Route risk values that replace the defaults (key "from-to"), e.g. during an exception. */
  routeRisk?: Record<string, number>;
  /** Extra trucks on the move (e.g. a reassigned or rerouted run). */
  trucks?: { id: string; path: string[]; phase: number }[];
  /** Stopped trucks, shown mid-route with an alert marker (and not animated). */
  stalled?: { id: string; route: [string, string] }[];
};

export function NetworkMap({ dispatchedTruck, overlay = {} }: { dispatchedTruck: string | null; overlay?: MapOverlay }) {
  const [layer, setLayer] = useState<MapLayer>("network");
  const reduce = !!useReducedMotion();

  const stalled = overlay.stalled ?? [];
  const trucks = [...MOVING_TRUCKS, ...(dispatchedTruck ? [{ id: dispatchedTruck, path: DISPATCH_PATH, phase: 0 }] : []), ...(overlay.trucks ?? [])].filter(
    (t) => !stalled.some((s) => s.id === t.id)
  );
  const routeRisk = (r: { from: string; to: string; riskValue: number }) => overlay.routeRisk?.[`${r.from}-${r.to}`] ?? r.riskValue;
  // The dispatched truck left D1, so one fewer is parked there.
  const depotFleet = { ...DEPOT_FLEET, ...(dispatchedTruck ? { D1: DEPOT_FLEET.D1 - 1 } : {}) };

  return (
    <section aria-labelledby="map-title" className="mt-4 rounded-lg border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="map-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
          Network
        </h3>
        <div role="group" aria-label="Map layer" className="flex flex-wrap rounded-md border border-rule p-0.5 text-xs">
          {MAP_LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              aria-pressed={layer === l.key}
              onClick={() => setLayer(l.key)}
              className={`rounded px-2.5 py-1 ${layer === l.key ? "bg-panel-2 text-text" : "text-text-dim hover:text-text"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <Legend layer={layer} />

      <div className="mt-3 overflow-x-auto">
        <svg viewBox="0 0 1000 420" role="img" aria-labelledby="map-svg-title map-svg-desc" className="h-auto w-full min-w-[40rem]">
          <title id="map-svg-title">Distribution network map, {MAP_LAYERS.find((l) => l.key === layer)!.label} layer</title>
          <desc id="map-svg-desc">{describe(layer, trucks.length, depotFleet, routeRisk, stalled)}</desc>

          {[
            { x: 90, text: "Suppliers" },
            { x: 485, text: "Depots" },
            { x: 900, text: "Customers" },
          ].map((c) => (
            <text key={c.text} x={c.x} y={14} textAnchor="middle" className="fill-text-faint font-mono text-[11px] uppercase tracking-wider">
              {c.text}
            </text>
          ))}

          <Routes layer={layer} riskOf={routeRisk} />

          {NODES.map((n) => (
            <NodeIcon key={n.id} node={n} layer={layer} reduce={reduce} depotFleet={depotFleet} />
          ))}

          {stalled.map((s) => (
            <StalledTruck key={s.id} id={s.id} route={s.route} highlighted={layer === "fleet"} />
          ))}

          {trucks.map((t) => (
            <MovingTruck key={t.id} id={t.id} path={t.path} phase={t.phase} highlighted={layer === "fleet"} reduce={reduce} />
          ))}
        </svg>
      </div>
    </section>
  );
}

// --- Routes -------------------------------------------------------------------------------

function Routes({ layer, riskOf }: { layer: MapLayer; riskOf: (r: { from: string; to: string; riskValue: number }) => number }) {
  return (
    <g>
      {ROUTES.map((r) => {
        const a = byId[r.from];
        const b = byId[r.to];
        const value = riskOf(r);
        const level = riskLevel(value);
        const risk = layer === "risk";
        const s = RISK_STYLE[level];
        return (
          <g key={`${r.from}-${r.to}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={`motion-safe:transition-[stroke,opacity] motion-safe:duration-300 ${risk ? s.stroke : "stroke-text-faint"}`}
              strokeWidth={risk ? s.width : 1.25}
              strokeDasharray={risk ? s.dash : undefined}
              strokeLinecap="round"
              opacity={risk ? (level === "normal" ? 0.6 : 1) : 0.45}
            />
            {/* Risk layer: the value on flagged routes. */}
            {risk && level !== "normal" && (
              <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 10})`}>
                <rect x={-17} y={-9} width={34} height={16} rx={3} className="fill-ink" />
                <text textAnchor="middle" y={3} className={`font-mono text-[10px] ${s.fill}`}>
                  {value}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// --- Nodes -------------------------------------------------------------------------------

/** Supplier: blue square. Depot: diamond. Customer zone: circle. */
function NodeIcon({
  node: n,
  layer,
  reduce,
  depotFleet,
}: {
  node: MapNode;
  layer: MapLayer;
  reduce: boolean;
  depotFleet: Record<string, number>;
}) {
  const labelX = n.kind === "customer" ? n.x + 16 : n.x;
  const labelY = n.kind === "customer" ? n.y + 4 : n.y + 26;
  const demand = n.kind === "customer" ? CUSTOMER_DEMAND[n.id] : null;
  const inventory = n.kind === "depot" ? DEPOT_INVENTORY[n.id] : null;

  // Inventory layer: depots grow a little with stock.
  const depotSize = layer === "inventory" && inventory !== null ? 9 + (inventory / 100) * 7 : 12;

  return (
    <g>
      {/* Demand layer: rings on customer zones; high demand pulses. */}
      {layer === "demand" && demand && demand !== "Low" && (
        <DemandRing x={n.x} y={n.y} level={demand} reduce={reduce} />
      )}

      {n.kind === "supplier" && (
        <rect x={n.x - 11} y={n.y - 11} width={22} height={22} rx={3} className="fill-panel-2 stroke-signal-blue" strokeWidth={1.75} />
      )}
      {n.kind === "depot" && (
        <polygon
          points={`${n.x},${n.y - depotSize} ${n.x + depotSize},${n.y} ${n.x},${n.y + depotSize} ${n.x - depotSize},${n.y}`}
          className="fill-panel-2 stroke-text motion-safe:transition-all motion-safe:duration-300"
          strokeWidth={1.5}
        />
      )}
      {n.kind === "customer" && (
        <circle
          cx={n.x}
          cy={n.y}
          r={9}
          className={`stroke-text-dim ${layer === "demand" && demand === "High" ? "fill-signal-blue" : "fill-ink"}`}
          strokeWidth={1.5}
        />
      )}
      {n.kind === "customer" && layer === "network" && NODE_CUSTOMERS[n.id] && (
        <text x={n.x} y={n.y + 3.5} textAnchor="middle" className="fill-text font-mono text-[9px]">
          {CUSTOMER_GLYPH[NODE_CUSTOMERS[n.id].type]}
        </text>
      )}

      <text
        x={labelX}
        y={labelY}
        textAnchor={n.kind === "customer" ? "start" : "middle"}
        className={`font-mono text-[11px] ${n.kind === "depot" ? "fill-text-dim" : "fill-text-faint"}`}
      >
        {n.label}
      </text>
      {/* Demand layer: the level on its own line, so long zone names don't run off the map. */}
      {layer === "demand" && demand && (
        <text x={labelX} y={labelY + 13} className={`font-mono text-[10px] ${demand === "High" ? "fill-signal-blue" : "fill-text-faint"}`}>
          {demand}
        </text>
      )}

      {/* Inventory layer: a fill bar and % under each depot. */}
      {layer === "inventory" && inventory !== null && <InventoryBar x={n.x} y={n.y + 32} pct={inventory} />}

      {/* Fleet layer: trucks parked and available at each depot. */}
      {layer === "fleet" && n.kind === "depot" && (
        <g transform={`translate(${n.x + 16} ${n.y - 16})`}>
          <rect x={0} y={-8} width={30} height={15} rx={7.5} className="fill-ink stroke-signal-teal" strokeWidth={1} />
          <text x={15} y={3} textAnchor="middle" className="fill-signal-teal font-mono text-[10px]">
            {depotFleet[n.id]}
          </text>
        </g>
      )}
    </g>
  );
}

function InventoryBar({ x, y, pct }: { x: number; y: number; pct: number }) {
  const level = inventoryLevel(pct);
  const w = 44;
  return (
    <g transform={`translate(${x - w / 2} ${y})`}>
      <rect width={w} height={5} rx={2.5} className="fill-panel-2" />
      <rect width={(w * pct) / 100} height={5} rx={2.5} className={RISK_STYLE[level].fill} />
      <text x={w + 5} y={5} className={`font-mono text-[10px] ${level === "normal" ? "fill-text-dim" : RISK_STYLE[level].fill}`}>
        {pct}%
      </text>
    </g>
  );
}

function DemandRing({ x, y, level, reduce }: { x: number; y: number; level: "High" | "Medium"; reduce: boolean }) {
  if (level === "Medium" || reduce) {
    return <circle cx={x} cy={y} r={level === "High" ? 16 : 14} className="fill-none stroke-signal-blue" strokeWidth={1.25} opacity={0.6} />;
  }
  return (
    <motion.circle
      cx={x}
      cy={y}
      className="fill-none stroke-signal-blue"
      strokeWidth={1.5}
      initial={{ r: 10, opacity: 0.7 }}
      animate={{ r: 22, opacity: 0 }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

// --- Trucks --------------------------------------------------------------------------------

/**
 * A truck shuttling along its path and back (A → B → C → B → A), a few seconds
 * per leg, forever, starting `phase` stops into the loop. With reduced motion
 * it sits still on its first leg.
 */
function MovingTruck({
  id,
  path,
  phase,
  highlighted,
  reduce,
}: {
  id: string;
  path: string[];
  phase: number;
  highlighted: boolean;
  reduce: boolean;
}) {
  // The closed round trip (first stop repeated at the end), rotated to start at `phase`.
  const loop = [...path, ...path.slice(0, -1).reverse()];
  const start = phase % (loop.length - 1);
  const stops = [...loop.slice(start, -1), ...loop.slice(0, start + 1)].map((nid) => byId[nid]);
  const legs = stops.length - 1;
  const icon = (
    <g opacity={highlighted ? 1 : 0.75}>
      <rect x={-8} y={-5} width={16} height={10} rx={2.5} className="fill-signal-blue" />
      <rect x={3} y={-3.5} width={4} height={3.5} rx={0.75} className="fill-ink" opacity={0.6} />
      {highlighted && (
        <text y={-10} textAnchor="middle" className="fill-signal-blue font-mono text-[10px]">
          {id}
        </text>
      )}
    </g>
  );

  if (reduce) {
    const a = stops[0];
    const b = stops[1];
    return <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}>{icon}</g>;
  }
  return (
    <motion.g
      initial={{ x: stops[0].x, y: stops[0].y }}
      animate={{ x: stops.map((s) => s.x), y: stops.map((s) => s.y) }}
      transition={{ duration: legs * LEG_SECONDS, repeat: Infinity, ease: "linear", times: stops.map((_, i) => i / legs) }}
    >
      {icon}
    </motion.g>
  );
}

/** A truck that's stopped mid-route (an exception): red, with an alert mark. */
function StalledTruck({ id, route, highlighted }: { id: string; route: [string, string]; highlighted: boolean }) {
  const a = byId[route[0]];
  const b = byId[route[1]];
  return (
    <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}>
      <rect x={-8} y={-5} width={16} height={10} rx={2.5} className="fill-signal-red" />
      <text x={0} y={-10} textAnchor="middle" className="fill-signal-red font-mono text-[10px]">
        ⚠ {highlighted ? id : ""}
      </text>
    </g>
  );
}

/** Customer type marker inside each customer node (Network layer). */
const CUSTOMER_GLYPH: Record<CustomerType, string> = { critical: "H", standard: "R", flexible: "I" };

// --- Legend and description ---------------------------------------------------------------

function Legend({ layer }: { layer: MapLayer }) {
  const item = (swatch: React.ReactNode, label: string) => (
    <li key={label} className="flex items-center gap-2">
      <svg aria-hidden width="24" height="14" className="overflow-visible">
        {swatch}
      </svg>
      {label}
    </li>
  );
  const items: React.ReactNode[] = {
    network: [
      item(<rect x={5} y={0} width={14} height={14} rx={2} className="fill-panel-2 stroke-signal-blue" strokeWidth={1.5} />, "Supplier"),
      item(<polygon points="12,0 19,7 12,14 5,7" className="fill-panel-2 stroke-text" strokeWidth={1.5} />, "Depot"),
      item(<rect x={4} y={2} width={16} height={10} rx={2.5} className="fill-signal-blue" />, "Truck in transit"),
      ...(Object.keys(CUSTOMER_GLYPH) as CustomerType[]).map((t) =>
        item(
          <g>
            <circle cx={12} cy={7} r={7} className="fill-ink stroke-text-dim" strokeWidth={1.5} />
            <text x={12} y={10} textAnchor="middle" className="fill-text font-mono text-[9px]">
              {CUSTOMER_GLYPH[t]}
            </text>
          </g>,
          `${CUSTOMER_TYPES[t].label} (${CUSTOMER_TYPES[t].sla} SLA)`
        )
      ),
    ],
    inventory: (["normal", "at-risk", "critical"] as RouteRisk[]).map((l) =>
      item(<rect x={2} y={4} width={20} height={5} rx={2.5} className={RISK_STYLE[l].fill} />, { normal: "50%+ stock", "at-risk": "25–49%", critical: "Under 25%" }[l])
    ),
    fleet: [
      item(<rect x={4} y={2} width={16} height={10} rx={2.5} className="fill-signal-blue" />, "In transit"),
      item(<rect x={2} y={0} width={20} height={14} rx={7} className="fill-ink stroke-signal-teal" strokeWidth={1} />, "Available at depot (count)"),
    ],
    demand: [
      item(<circle cx={12} cy={7} r={6} className="fill-signal-blue stroke-text-dim" strokeWidth={1.5} />, "High (pulsing)"),
      item(<circle cx={12} cy={7} r={6} className="fill-none stroke-signal-blue" strokeWidth={1.25} />, "Medium"),
      item(<circle cx={12} cy={7} r={5} className="fill-ink stroke-text-dim" strokeWidth={1.5} />, "Low"),
    ],
    risk: (["normal", "at-risk", "critical"] as RouteRisk[]).map((l) =>
      item(
        <line x1={0} y1={7} x2={24} y2={7} className={RISK_STYLE[l].stroke} strokeWidth={2} strokeDasharray={RISK_STYLE[l].dash} />,
        { normal: "Normal (under 40)", "at-risk": "At risk (40–69)", critical: "Critical (70+)" }[l]
      )
    ),
  }[layer];

  return (
    <ul aria-label="Legend" className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-dim">
      {items}
    </ul>
  );
}

/** The map in words, per layer, for screen readers. */
function describe(
  layer: MapLayer,
  trucksMoving: number,
  depotFleet: Record<string, number>,
  riskOf: (r: { from: string; to: string; riskValue: number }) => number,
  stalled: { id: string; route: [string, string] }[]
): string {
  const counts = `3 suppliers, 8 depots and 7 customer zones; ${trucksMoving} trucks shown in transit.`;
  const name = (id: string) => byId[id].label;
  switch (layer) {
    case "network":
      return `${counts}${stalled.map((s) => ` ${s.id} is stopped between ${byId[s.route[0]].label} and ${byId[s.route[1]].label}.`).join("")} Suppliers feed depots, which serve customer zones: ${Object.entries(NODE_CUSTOMERS)
        .map(([id, c]) => `${byId[id].label}, ${c.name} (${CUSTOMER_TYPES[c.type].short.toLowerCase()})`)
        .join("; ")}.`;
    case "inventory":
      return `Depot stock: ${Object.entries(DEPOT_INVENTORY)
        .map(([d, p]) => `${d} ${p}%${inventoryLevel(p) !== "normal" ? ` (${RISK_LABEL[inventoryLevel(p)].toLowerCase()})` : ""}`)
        .join(", ")}.`;
    case "fleet":
      return `Trucks available at each depot: ${Object.entries(depotFleet)
        .map(([d, n]) => `${d} ${n}`)
        .join(", ")}. ${trucksMoving} trucks in transit on the map.`;
    case "demand":
      return `Customer demand: ${Object.entries(CUSTOMER_DEMAND)
        .map(([c, l]) => `${name(c)} ${l.toLowerCase()}`)
        .join(", ")}.`;
    case "risk": {
      const flagged = ROUTES.filter((r) => riskLevel(riskOf(r)) !== "normal");
      return `${flagged.map((r) => `${name(r.from)} to ${name(r.to)}: ${RISK_LABEL[riskLevel(riskOf(r))].toLowerCase()} (${riskOf(r)})`).join("; ")}. All other routes normal.`;
    }
  }
}

"use client";

import { useState } from "react";

type SystemId = "customer" | "crm" | "tower" | "sap" | "fleet" | "inventory" | "vehicles";

export type LiveNumbers = {
  exceptionsUnresolved: number;
  exceptionsCritical: number;
  fleetAvailable: number;
  fleetInTransit: number;
  vehicleAlert: string | null;
};

const LABELS: Record<SystemId, { label: string; note: string }> = {
  customer: { label: "Customer", note: "Orders and requests" },
  crm: { label: "CRM", note: "Accounts and priorities" },
  tower: { label: "Control Tower", note: "Decisions and exceptions" },
  sap: { label: "SAP ERP", note: "Orders and stock" },
  fleet: { label: "Fleet", note: "Trucks and drivers" },
  inventory: { label: "Inventory", note: "Depot stock" },
  vehicles: { label: "Vehicles", note: "Telematics" },
};

/** Mock live data per system. Control Tower, Fleet and Vehicles read the tower's current numbers. */
function snippet(id: SystemId, live: LiveNumbers): { rows: [string, string][]; synced: string } {
  switch (id) {
    case "customer":
      return { rows: [["Open requests", "3"], ["Latest order", "#4821 · Delhi Distribution Hub"], ["Channel", "Customer portal"]], synced: "12 s ago" };
    case "crm":
      return { rows: [["Active accounts", "7"], ["Critical facilities", "2"], ["Open service cases", "2"]], synced: "40 s ago" };
    case "tower":
      return {
        rows: [
          ["Unresolved exceptions", String(live.exceptionsUnresolved)],
          ["Critical", String(live.exceptionsCritical)],
          ["Mission", "Morning dispatch"],
        ],
        synced: "live",
      };
    case "sap":
      return { rows: [["Open orders", "126"], ["Pending fulfillment", "18"], ["Truck loads planned", "31"]], synced: "1 min ago" };
    case "fleet":
      return {
        rows: [
          ["Trucks", "43"],
          ["Available", String(live.fleetAvailable)],
          ["In transit", String(live.fleetInTransit)],
        ],
        synced: "live",
      };
    case "inventory":
      return { rows: [["Depots", "8"], ["Below 25% stock", "D7"], ["Average fill", "55%"]], synced: "5 min ago" };
    case "vehicles":
      return {
        rows: [
          ["Telematics online", "41 / 43"],
          ["Active alerts", live.vehicleAlert ?? "None"],
          ["Density gauges", "8 depots reporting"],
        ],
        synced: "live",
      };
  }
}

/**
 * Integration View: how the systems connect, Customer → CRM → Control Tower →
 * (SAP ERP + Fleet) → (Inventory + Vehicles). Each box opens a small mock
 * live-data panel for that system.
 */
export function IntegrationView({ live }: { live: LiveNumbers }) {
  const [open, setOpen] = useState<SystemId | null>(null);

  const box = (id: SystemId) => (
    <button
      type="button"
      aria-pressed={open === id}
      aria-controls="integration-detail"
      onClick={() => setOpen((o) => (o === id ? null : id))}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
        open === id ? "border-signal-blue bg-panel-2" : "border-rule bg-ink hover:border-text-faint hover:bg-panel-2"
      }`}
    >
      <span className="block text-sm font-medium text-text">{LABELS[id].label}</span>
      <span className="block text-xs text-text-faint">{LABELS[id].note}</span>
    </button>
  );
  const arrow = (
    <span aria-hidden className="flex items-center justify-center font-mono text-text-faint">
      →
    </span>
  );
  const detail = open ? snippet(open, live) : null;

  return (
    <section aria-labelledby="integration-title" className="rounded-lg border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 id="integration-title" className="font-mono text-xs uppercase tracking-wider text-text-faint">
          Integration view
        </h4>
        <span className="text-xs text-text-faint">Select a system to see its live data</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        {/* Five stages left to right; the last two stages have two systems each. */}
        <div className="grid min-w-[44rem] grid-cols-[1fr_1.25rem_1fr_1.25rem_1fr_1.25rem_1fr_1.25rem_1fr] items-center gap-y-2">
          <div className="row-span-2">{box("customer")}</div>
          <div className="row-span-2">{arrow}</div>
          <div className="row-span-2">{box("crm")}</div>
          <div className="row-span-2">{arrow}</div>
          <div className="row-span-2">{box("tower")}</div>
          {arrow}
          {box("sap")}
          {arrow}
          {box("inventory")}
          {arrow}
          {box("fleet")}
          {arrow}
          {box("vehicles")}
        </div>
      </div>

      <div id="integration-detail" aria-live="polite">
        {open && detail && (
          <div className="mt-3 rounded-md border border-rule bg-ink p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-text">{LABELS[open].label}</p>
              <span className="flex items-center gap-1.5 font-mono text-xs text-text-faint">
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${detail.synced === "live" ? "bg-signal-teal" : "bg-text-faint"}`} />
                {detail.synced === "live" ? "Live" : `Synced ${detail.synced}`}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              {detail.rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-text-faint">{k}</dt>
                  <dd className="font-mono tabular-nums text-text">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

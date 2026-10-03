/**
 * RESOLVE//X: one shift running service operations for a fictional enterprise.
 * Pure data and logic. Everything here is invented: Helio Services, its business
 * units, teams and numbers are fictional, and no real company, client or
 * product is named or imitated.
 */

/** The fictional enterprise the player runs service operations for. */
export const ENTERPRISE = "Helio Services";

export const DISCLAIMER = "Independent concept prototype with a fictional enterprise. Not affiliated with or endorsed by ServiceNow.";

export const BUSINESS_UNITS = ["Retail Services", "Field Operations", "Corporate Services", "Digital Channels"] as const;
export type BusinessUnit = (typeof BUSINESS_UNITS)[number];

// --- Clock ------------------------------------------------------------------------------------

/** Simulated minutes that pass per real second while the clock runs. */
export const SIM_MINUTES_PER_REAL_SECOND = 1;
/** The shift starts at 08:00 simulated time. */
export const SHIFT_START_MINUTES = 8 * 60;

/** Minutes since midnight -> "08:00". */
export function formatSimTime(minutes: number) {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// --- SLA states (Flight Deck signals: teal healthy, amber at risk, red breached) ----------------

export type SlaState = "healthy" | "at-risk" | "breached";
export const SLA_LABEL: Record<SlaState, string> = { healthy: "Healthy", "at-risk": "At risk", breached: "Breached" };

// --- Briefing -----------------------------------------------------------------------------------

export const BRIEFING = {
  title: "Shift briefing",
  intro: "You own the service for 4 business units. 24 issues are expected this shift.",
  stats: [
    { label: "Incoming issues", value: "24" },
    { label: "At risk", value: "6" },
    { label: "Business units affected", value: "3" },
    { label: "Current SLA compliance", value: "78%" },
  ],
  objective: "Restore SLA compliance by getting each issue to the right team, resolving it once, and stopping repeats.",
};

// --- Teams and their queues ------------------------------------------------------------------------

export type Team = {
  id: "service-desk" | "app-support" | "infrastructure" | "identity";
  name: string;
  /** Incidents the team can work at once before the queue backs up. */
  capacity: number;
  /** Open incidents in the queue at the start of the shift, by SLA state. */
  open: Record<SlaState, number>;
};

export const TEAMS: Team[] = [
  { id: "service-desk", name: "Service desk L1", capacity: 8, open: { healthy: 4, "at-risk": 1, breached: 0 } },
  { id: "app-support", name: "Application support", capacity: 5, open: { healthy: 2, "at-risk": 1, breached: 1 } },
  { id: "infrastructure", name: "Infrastructure", capacity: 4, open: { healthy: 1, "at-risk": 0, breached: 0 } },
  { id: "identity", name: "Identity and access", capacity: 3, open: { healthy: 1, "at-risk": 1, breached: 0 } },
];

export type TeamId = Team["id"];
export const teamById = (id: TeamId) => TEAMS.find((t) => t.id === id)!;

// --- Triage: category, impact x urgency -> priority, routing ----------------------------------------

export const CATEGORIES = ["Application", "Network", "Access and identity", "Hardware"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Impact = "single" | "multiple" | "business-unit";
/** Matrix rows, top to bottom: widest impact first. */
export const IMPACTS: { id: Impact; label: string }[] = [
  { id: "business-unit", label: "Whole business unit" },
  { id: "multiple", label: "Multiple users" },
  { id: "single", label: "Single user" },
];

export type Urgency = "low" | "medium" | "high";
/** Matrix columns, left to right. */
export const URGENCIES: { id: Urgency; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export type Priority = "P1" | "P2" | "P3" | "P4";

/** Priority from impact and urgency. */
export const PRIORITY_MATRIX: Record<Impact, Record<Urgency, Priority>> = {
  "business-unit": { high: "P1", medium: "P2", low: "P3" },
  multiple: { high: "P2", medium: "P3", low: "P4" },
  single: { high: "P3", medium: "P4", low: "P4" },
};

/** Resolution target per priority, in simulated minutes. */
export const SLA_TARGET_MINUTES: Record<Priority, number> = { P1: 15, P2: 30, P3: 60, P4: 120 };

/** Routing to a team that isn't the best fit: the incident is reassigned, at this cost to its SLA time. */
export const REASSIGNMENT = { hops: 1, minutes: 6 };

/**
 * Countdown ring colours by share of the SLA target left: teal above HEALTHY_ABOVE,
 * amber from BREACH_NEAR_BELOW to HEALTHY_ABOVE, red below BREACH_NEAR_BELOW.
 * An incident counts as at risk once it's out of the teal band.
 */
export const RING = { HEALTHY_ABOVE: 0.5, BREACH_NEAR_BELOW: 0.2 } as const;
export type RingTone = "teal" | "amber" | "red";
export function ringTone(share: number): RingTone {
  return share > RING.HEALTHY_ABOVE ? "teal" : share >= RING.BREACH_NEAR_BELOW ? "amber" : "red";
}

// --- Incoming incidents (they arrive one at a time) -----------------------------------------------

export type Incident = {
  id: string;
  unit: BusinessUnit;
  summary: string;
  /** The team that can resolve it without a hand-off. */
  bestTeam: TeamId;
  /** The impact the incident really has (for later scoring; never shown while triaging). */
  realisticImpact: Impact;
};

export const INCIDENTS: Incident[] = [
  {
    id: "INC-1041",
    unit: "Corporate Services",
    summary: "Employee cannot open the shared reporting dashboard after a password change.",
    bestTeam: "identity",
    realisticImpact: "single",
  },
  {
    id: "INC-1044",
    unit: "Field Operations",
    summary: "Field team's mobile app is very slow to load since this morning.",
    bestTeam: "app-support",
    realisticImpact: "multiple",
  },
  {
    id: "INC-1048",
    unit: "Retail Services",
    summary: "Customer can log in but every payment attempt fails. Tried three times.",
    bestTeam: "app-support",
    realisticImpact: "multiple",
  },
];

export type Triage = { category: Category; impact: Impact; urgency: Urgency; team: TeamId };

/** A triaged incident in a team queue, with its SLA clock. */
export type RoutedIncident = {
  incident: Incident;
  triage: Triage;
  priority: Priority;
  /** SLA resolution target in simulated minutes. */
  target: number;
  /** Simulated minute the SLA clock started. */
  routedAt: number;
  /** The team the player chose. */
  chosenTeam: TeamId;
  /** Where it ends up: the chosen team, or the best fit after a reassignment. */
  team: TeamId;
  hops: number;
  /** SLA minutes used up by reassignment. */
  penaltyMinutes: number;
  /** Resolution work so far. */
  work: WorkState;
};

export function routeIncident(incident: Incident, triage: Triage, now: number): RoutedIncident {
  const priority = PRIORITY_MATRIX[triage.impact][triage.urgency];
  const reassigned = triage.team !== incident.bestTeam;
  return {
    incident,
    triage,
    priority,
    target: SLA_TARGET_MINUTES[priority],
    routedAt: now,
    chosenTeam: triage.team,
    team: reassigned ? incident.bestTeam : triage.team,
    hops: reassigned ? REASSIGNMENT.hops : 0,
    penaltyMinutes: reassigned ? REASSIGNMENT.minutes : 0,
    work: workStart(incident.id),
  };
}

/** SLA minutes left (negative once breached); frozen once resolved. Reassignment and action time count against it. */
export function minutesLeft(r: RoutedIncident, now: number) {
  if (r.work.resolution) return r.target - r.work.resolution.minutes;
  return r.target - (now - r.routedAt) - r.penaltyMinutes - r.work.spent;
}

/** Share of the SLA target left, 0 to 1 (for the countdown ring). */
export const shareLeft = (r: RoutedIncident, now: number) => Math.max(0, Math.min(1, minutesLeft(r, now) / r.target));

export function slaStateOf(r: RoutedIncident, now: number): SlaState {
  const left = minutesLeft(r, now);
  return left <= 0 ? "breached" : left / r.target <= RING.HEALTHY_ABOVE ? "at-risk" : "healthy";
}

export const isOpen = (r: RoutedIncident) => !r.work.resolution;

// --- Queues and counters (starting load plus routed incidents) --------------------------------------

/** Where each routed incident currently sits (a reassigned one shows in the chosen queue first). */
export type Placement = (r: RoutedIncident) => TeamId;
export const finalPlacement: Placement = (r) => r.team;

export const openCount = (t: Team, routed: RoutedIncident[] = [], place: Placement = finalPlacement) =>
  t.open.healthy + t.open["at-risk"] + t.open.breached + routed.filter((r) => isOpen(r) && place(r) === t.id).length;

const WORST: SlaState[] = ["breached", "at-risk", "healthy"];

/** A queue is as healthy as its worst incident. */
export function queueState(t: Team, routed: RoutedIncident[] = [], now = 0, place: Placement = finalPlacement): SlaState {
  const states: SlaState[] = [
    ...(t.open.breached ? ["breached" as const] : []),
    ...(t.open["at-risk"] ? ["at-risk" as const] : []),
    ...routed.filter((r) => isOpen(r) && place(r) === t.id).map((r) => slaStateOf(r, now)),
  ];
  return WORST.find((s) => states.includes(s)) ?? "healthy";
}

/** Live counters for the header, from the queues. */
export function counters(teams: Team[], routed: RoutedIncident[] = [], now = 0) {
  const open = routed.filter(isOpen);
  const routedRisky = open.filter((r) => slaStateOf(r, now) !== "healthy").length;
  return {
    open: teams.reduce((s, t) => s + openCount(t), 0) + open.length,
    slaAtRisk: teams.reduce((s, t) => s + t.open["at-risk"] + t.open.breached, 0) + routedRisky,
  };
}

// --- Decision log ---------------------------------------------------------------------------------

export type DecisionLogEntry = {
  time: string;
  incidentId: string;
  decision: string;
  consequence: string;
  kind?: "triage" | "action" | "resolved" | "breached" | "pattern" | "problem" | "case" | "automation";
  /** On "resolved" entries: what the metrics are computed from. */
  resolution?: Resolution;
  /** On pattern, problem and rule entries: the repeat-incident count after this decision. */
  repeatIncidents?: number;
  /** On the kept rule: what it did in its run. */
  rule?: { linked: number; extra: number };
};

/** Logged once when an open incident's countdown reaches zero. The player carries on. */
export const breachEntry = (r: RoutedIncident, now: number): DecisionLogEntry => ({
  time: formatSimTime(now),
  incidentId: r.incident.id,
  kind: "breached",
  decision: "SLA target reached while open",
  consequence: "SLA breached; the incident stays open and can still be resolved",
});

const impactLabel = (i: Impact) => IMPACTS.find((x) => x.id === i)!.label.toLowerCase();

/** The three decisions behind one triage, as log entries. Neutral wording: a reassignment is a cost, not a mistake. */
export function triageDecisions(r: RoutedIncident): DecisionLogEntry[] {
  const time = formatSimTime(r.routedAt);
  const id = r.incident.id;
  return [
    { time, incidentId: id, kind: "triage", decision: `Category: ${r.triage.category}`, consequence: "Recorded on the incident" },
    {
      time,
      incidentId: id,
      kind: "triage",
      decision: `Impact: ${impactLabel(r.triage.impact)}, urgency: ${r.triage.urgency} → ${r.priority}`,
      consequence: `SLA resolution target ${r.target} simulated minutes`,
    },
    {
      time,
      incidentId: id,
      kind: "triage",
      decision: `Routed to ${teamById(r.chosenTeam).name}`,
      consequence: r.hops
        ? `Reassigned: +${r.hops} hop, ${r.penaltyMinutes} simulated minutes used (now with ${teamById(r.team).name}; ${r.target - r.penaltyMinutes} min left)`
        : `SLA clock started: ${r.target} min to resolve`,
    },
  ];
}

// --- Resolution: four actions, each with a fixed consequence per incident ----------------------------

export type ActionId = "knowledge" | "escalate" | "investigate" | "request-info";

export const ACTIONS: { id: ActionId; label: string; hint: string }[] = [
  { id: "knowledge", label: "Use a knowledge article", hint: "Fast. Only works if a matching article exists." },
  { id: "escalate", label: "Escalate to a specialist", hint: "Slower, but resolves it. Faster with context from an investigation." },
  { id: "investigate", label: "Investigate a related incident", hint: "Reveals one extra signal. Costs time." },
  { id: "request-info", label: "Request more information", hint: "Small time cost. May unlock a better option." },
];

/** Simulated minutes each action takes from the incident's SLA time. */
export const ACTION_MINUTES = {
  knowledge: 6,
  /** Looking for an article that turns out not to exist. */
  knowledgeMiss: 2,
  escalate: 20,
  /** Escalating after an investigation: the specialist starts with context. */
  escalateWithContext: 15,
  investigate: 6,
  requestInfo: 4,
} as const;

export type KnowledgeArticle = { id: string; title: string };

/** What each action leads to, per incident. Fixed: the same choices always give the same result. */
export const CONSEQUENCES: Record<
  string,
  {
    /** A matching article that exists from the start, or null. */
    article: KnowledgeArticle | null;
    /** The extra signal an investigation reveals. */
    investigateSignal: string;
    /** What the user says when asked, and the article it unlocks (if any). */
    requestInfo: { signal: string; unlocks: KnowledgeArticle | null };
  }
> = {
  "INC-1041": {
    article: { id: "KB-0217", title: "Refresh dashboard permissions after a password change" },
    investigateSignal: "Two other password-change tickets this week were fixed with the same permissions refresh.",
    requestInfo: { signal: "The employee changed their password last night. Every other app works.", unlocks: null },
  },
  "INC-1044": {
    article: null,
    investigateSignal: "The slowdown started with this morning's app release. 11 field users have reported it.",
    requestInfo: {
      signal: "Only users on the newest app version are affected, and reinstalling the app clears it.",
      unlocks: { id: "KB-0342", title: "Clear cached data after a mobile app update" },
    },
  },
  "INC-1048": {
    article: null,
    investigateSignal: "Similar payment incidents exist: 5 failed-payment reports from Retail Services in the last hour.",
    requestInfo: { signal: "The customer sees 'Payment could not be completed' with every card they try.", unlocks: null },
  },
};

export type Resolution = {
  by: ActionId;
  /** Simulated minute it was resolved. */
  at: number;
  /** Time from routing to resolution, in simulated minutes (reassignment and action costs included). */
  minutes: number;
  withinTarget: boolean;
  /** Minutes past the target (0 if within it). */
  breachedBy: number;
  firstContact: boolean;
  csat: number;
};

/** What has happened to an incident since it was routed. */
export type WorkState = {
  /** Simulated minutes spent on actions. */
  spent: number;
  signals: string[];
  used: ActionId[];
  /** An article that became available (from the start, or unlocked by asking). */
  article: KnowledgeArticle | null;
  escalated: boolean;
  investigated: boolean;
  infoRequests: number;
  articleMisses: number;
  resolution: Resolution | null;
};

export const workStart = (incidentId: string): WorkState => ({
  spent: 0,
  signals: [],
  used: [],
  article: CONSEQUENCES[incidentId].article,
  escalated: false,
  investigated: false,
  infoRequests: 0,
  articleMisses: 0,
  resolution: null,
});

/**
 * First-contact resolution: resolved by the team that first received it, with
 * no reassignment, no escalation, and no request back to the user for more information.
 */
export const FIRST_CONTACT_RULE =
  "First-contact resolution: resolved by the team that first received it, with no reassignment, no escalation and no request back to the user for more information.";
export const isFirstContact = (r: RoutedIncident, w: WorkState) => r.hops === 0 && !w.escalated && w.infoRequests === 0;

/** CSAT out of 5: 5, minus 1 if the SLA was breached, 0.5 per reassignment, 0.5 for an escalation, 0.25 per request for more information and per article that didn't exist. At least 1. */
export const CSAT_FORMULA =
  "5, minus 1 if the SLA was breached, 0.5 per reassignment, 0.5 for an escalation, 0.25 per request for more information and 0.25 per missing article (at least 1).";
export function csatFor(r: RoutedIncident, w: WorkState, breached: boolean) {
  const score = 5 - (breached ? 1 : 0) - 0.5 * r.hops - (w.escalated ? 0.5 : 0) - 0.25 * w.infoRequests - 0.25 * w.articleMisses;
  return Math.max(1, Math.round(score * 100) / 100);
}

/**
 * Applies one action to a routed incident at simulated minute `now`: the new
 * work state and the decision log entries it produces. Pure and deterministic.
 */
export function applyAction(r: RoutedIncident, action: ActionId, now: number): { work: WorkState; entries: DecisionLogEntry[] } {
  const c = CONSEQUENCES[r.incident.id];
  const w: WorkState = { ...r.work, used: [...r.work.used, action], signals: [...r.work.signals] };
  const time = formatSimTime(now);
  const id = r.incident.id;
  const entry = (decision: string, consequence: string): DecisionLogEntry => ({ time, incidentId: id, decision, consequence, kind: "action" });

  const resolve = (minutes: number): DecisionLogEntry[] => {
    w.spent += minutes;
    const total = now - r.routedAt + r.penaltyMinutes + w.spent;
    const breachedBy = Math.max(0, total - r.target);
    const firstContact = isFirstContact(r, w);
    w.resolution = { by: action, at: now, minutes: total, withinTarget: breachedBy === 0, breachedBy, firstContact, csat: csatFor(r, w, breachedBy > 0) };
    const label = ACTIONS.find((a) => a.id === action)!.label;
    return [
      {
        time,
        incidentId: id,
        kind: "resolved",
        resolution: w.resolution,
        decision: `${label}: resolved in ${total} simulated minutes`,
        consequence: `${breachedBy ? `SLA breached by ${breachedBy} simulated minutes` : "Within the SLA target"}; ${firstContact ? "first-contact resolution" : "not first contact"}; CSAT ${w.resolution.csat}`,
      },
    ];
  };

  switch (action) {
    case "knowledge":
      if (w.article) return { work: w, entries: resolve(ACTION_MINUTES.knowledge) };
      w.spent += ACTION_MINUTES.knowledgeMiss;
      w.articleMisses += 1;
      return { work: w, entries: [entry("Looked for a knowledge article", `No matching article; ${ACTION_MINUTES.knowledgeMiss} simulated minutes used`)] };
    case "escalate":
      w.escalated = true;
      return { work: w, entries: resolve(w.investigated ? ACTION_MINUTES.escalateWithContext : ACTION_MINUTES.escalate) };
    case "investigate":
      w.spent += ACTION_MINUTES.investigate;
      w.investigated = true;
      w.signals.push(c.investigateSignal);
      return { work: w, entries: [entry("Investigated a related incident", `${c.investigateSignal} (${ACTION_MINUTES.investigate} simulated minutes)`)] };
    case "request-info": {
      w.spent += ACTION_MINUTES.requestInfo;
      w.infoRequests += 1;
      w.signals.push(c.requestInfo.signal);
      const unlocked = !w.article && c.requestInfo.unlocks;
      if (unlocked) w.article = c.requestInfo.unlocks;
      return {
        work: w,
        entries: [
          entry(
            "Requested more information",
            `${c.requestInfo.signal}${unlocked ? ` Unlocked ${c.requestInfo.unlocks!.id}.` : ""} (${ACTION_MINUTES.requestInfo} simulated minutes)`
          ),
        ],
      };
    }
  }
}

// --- Metrics, computed from the decision log -----------------------------------------------------------

export type MetricKey = "sla" | "fcr" | "time" | "csat";

/** How each metric is calculated, over the incidents resolved this shift. */
export const METRIC_FORMULAS: Record<MetricKey, string> = {
  sla: "Resolved within target ÷ resolved",
  fcr: "First-contact resolutions ÷ resolved",
  time: "Mean of routing-to-resolution time",
  csat: "Mean of each resolved incident's CSAT",
};

/** Targets, and the band just short of them that counts as "near". */
export const METRIC_TARGETS: Record<MetricKey, { target: number; near: number; higherIsBetter: boolean; label: string }> = {
  sla: { target: 90, near: 75, higherIsBetter: true, label: "Target 90%" },
  fcr: { target: 70, near: 50, higherIsBetter: true, label: "Target 70%" },
  time: { target: 40, near: 60, higherIsBetter: false, label: "Target 40 min" },
  csat: { target: 4, near: 3.5, higherIsBetter: true, label: "Target 4.0" },
};

export type MetricState = "on-target" | "near-target" | "below-target";
export const METRIC_STATE_LABEL: Record<MetricState, string> = { "on-target": "On target", "near-target": "Near target", "below-target": "Below target" };

export function metricState(key: MetricKey, value: number): MetricState {
  const t = METRIC_TARGETS[key];
  const meets = (x: number) => (t.higherIsBetter ? value >= x : value <= x);
  return meets(t.target) ? "on-target" : meets(t.near) ? "near-target" : "below-target";
}

/** The four metrics from the log's resolution entries; null until something is resolved. */
export function computeMetrics(log: DecisionLogEntry[]): Record<MetricKey, number> | null {
  const resolved = log.flatMap((e) => (e.kind === "resolved" && e.resolution ? [e.resolution] : []));
  if (!resolved.length) return null;
  const n = resolved.length;
  const mean = (f: (r: Resolution) => number) => resolved.reduce((s, r) => s + f(r), 0) / n;
  return {
    sla: Math.round((resolved.filter((r) => r.withinTarget).length / n) * 100),
    fcr: Math.round((resolved.filter((r) => r.firstContact).length / n) * 100),
    time: Math.round(mean((r) => r.minutes)),
    csat: Math.round(mean((r) => r.csat) * 10) / 10,
  };
}

// --- Pattern event (after the third incident is resolved) -------------------------------------------

export const PATTERN = {
  title: "Pattern detected",
  text: "7 similar payment incidents in 18 minutes. Multiple customers. Similar failure signature.",
};

export type PatternChoice = "continue" | "link" | "workaround";
export const PATTERN_OPTIONS: { id: PatternChoice; label: string }[] = [
  { id: "continue", label: "Continue resolving incidents one by one" },
  { id: "link", label: "Link the incidents and investigate a common cause" },
  { id: "workaround", label: "Publish a temporary workaround article" },
];

export type RelatedIncident = { id: string; unit: BusinessUnit };

/** The seven incidents behind the pattern (INC-1048 is the one already resolved). */
export const PATTERN_INCIDENTS: RelatedIncident[] = [
  { id: "INC-1048", unit: "Retail Services" },
  { id: "INC-1049", unit: "Retail Services" },
  { id: "INC-1050", unit: "Digital Channels" },
  { id: "INC-1051", unit: "Retail Services" },
  { id: "INC-1052", unit: "Digital Channels" },
  { id: "INC-1053", unit: "Field Operations" },
  { id: "INC-1054", unit: "Retail Services" },
];

/** Continuing one by one: these similar incidents arrive, one after another. */
export const CONTINUE_ARRIVALS: RelatedIncident[] = [
  { id: "INC-1056", unit: "Retail Services" },
  { id: "INC-1058", unit: "Digital Channels" },
  { id: "INC-1059", unit: "Retail Services" },
];

/** Publishing a workaround: some users self-serve (open incidents drop), but new ones still arrive. */
export const WORKAROUND = {
  relief: 4,
  arrivals: [
    { id: "INC-1057", unit: "Digital Channels" },
    { id: "INC-1060", unit: "Retail Services" },
  ] as RelatedIncident[],
};

/** Simulated-feel pacing for arrivals (real milliseconds; instant under reduced motion). */
export const ARRIVAL_INTERVAL_MS = 700;
export const RELIEF_HOLD_MS = 1600;

export const PROBLEM = { id: "PRB-021", title: "Payment gateway instability" };
export const LEARNING = "Incident management restores service. Problem management works to prevent it happening again.";

export type PatternState = {
  choices: PatternChoice[];
  /** Similar incidents that arrived after the pattern was detected. */
  arrived: RelatedIncident[];
  /** Open incidents taken off the queue by a workaround article. */
  relief: number;
  workaroundPublished: boolean;
  /** The problem record is open (the end of every path). */
  problemOpen: boolean;
  /** The agent's call on the knowledge suggestion, once made. */
  knowledge: "accepted" | "rejected" | null;
};
export const PATTERN_START: PatternState = { choices: [], arrived: [], relief: 0, workaroundPublished: false, problemOpen: false, knowledge: null };

export const relatedIncidents = (p: PatternState) => [...PATTERN_INCIDENTS, ...p.arrived];
/** Related incidents still open: all but the resolved INC-1048, less any a workaround deflected or the knowledge suggestion resolved. */
export const patternOpenCount = (p: PatternState) =>
  Math.max(0, relatedIncidents(p).length - 1 - p.relief - (p.knowledge === "accepted" ? KB_RESOLVES.length : 0));
/** Repeat incidents: everything matching the signature so far. */
export const repeatCount = (p: PatternState) => relatedIncidents(p).length;
export const unitsAffected = (p: PatternState) => new Set(relatedIncidents(p).map((r) => r.unit)).size;

export function problemCard(p: PatternState) {
  return {
    id: PROBLEM.id,
    title: PROBLEM.title,
    lines: [
      `${relatedIncidents(p).length} related incidents`,
      `${unitsAffected(p)} business units affected`,
      "Root cause investigation started",
      ...(p.knowledge === "accepted"
        ? p.workaroundPublished
          ? ["Workaround article published", `Proposed workaround: ${KB_TOP.id} ${KB_TOP.title}`]
          : [`Workaround article proposed: ${KB_TOP.id} ${KB_TOP.title}`]
        : [p.workaroundPublished ? "Workaround article published" : "Workaround article proposed"]),
    ],
  };
}

const optionLabel = (c: PatternChoice) => PATTERN_OPTIONS.find((o) => o.id === c)!.label;

export function patternDetectedEntry(now: number): DecisionLogEntry {
  return {
    time: formatSimTime(now),
    incidentId: "PATTERN",
    kind: "pattern",
    decision: PATTERN.title,
    consequence: PATTERN.text,
    repeatIncidents: PATTERN_INCIDENTS.length,
  };
}

/** The log entry for a response to the pattern, given the state after its consequence played out. */
export function patternChoiceEntry(choice: PatternChoice, after: PatternState, now: number): DecisionLogEntry {
  const consequence =
    choice === "continue"
      ? `${CONTINUE_ARRIVALS.length} more similar incidents arrived; repeat incidents now ${repeatCount(after)}`
      : choice === "workaround"
        ? `Short relief: ${WORKAROUND.relief} fewer open incidents, but ${WORKAROUND.arrivals.length} new similar incidents still arrived`
        : `Linked ${relatedIncidents(after).length} incidents; investigating a common cause`;
  return { time: formatSimTime(now), incidentId: "PATTERN", kind: "pattern", decision: optionLabel(choice), consequence, repeatIncidents: repeatCount(after) };
}

export function problemEntry(p: PatternState, now: number): DecisionLogEntry {
  const card = problemCard(p);
  const path = p.choices.map((c) => (c === "continue" ? "continued one by one" : c === "workaround" ? "published a workaround" : "linked")).join(" → ");
  return {
    time: formatSimTime(now),
    incidentId: PROBLEM.id,
    kind: "problem",
    decision: `Problem record ${card.id} opened: ${card.title}`,
    consequence: `${card.lines.join("; ")}. Path: ${path}`,
    repeatIncidents: repeatCount(p),
  };
}

// --- Linked customer case (after the problem record) ------------------------------------------------

/** The parent incident: linking the pattern to PRB-021 reopens it, because the payment failure came back. */
export const PARENT_INCIDENT = "INC-1048";

/** Logged with the problem record. Earlier metrics stay as they were. */
export const reopenEntry = (now: number): DecisionLogEntry => ({
  time: formatSimTime(now),
  incidentId: PARENT_INCIDENT,
  kind: "case",
  decision: `Reopened as the parent incident for ${PROBLEM.id}`,
  consequence: "The payment failure came back; the earlier resolution and its metrics stay as they were",
});

/** Fictional customer, owner and history. */
export const CUSTOMER_CASE = {
  id: "CASE-3307",
  report: "I've tried to pay three times this morning and every payment fails. Has my card been charged?",
  customer: { name: "Noor Haddad", tier: "Gold", since: "Customer since 2019" },
  history: [
    { id: "CASE-2874", summary: "Card replaced after expiry", outcome: "Resolved in 1 day" },
    { id: "CASE-3019", summary: "Billing address update", outcome: "Resolved the same day" },
  ],
  commitment: "Gold: first response within 30 minutes, then an update at least every 2 hours",
  owner: "Sam Ortiz, Customer care",
};

export type CaseStatus = "new" | "in-progress" | "awaiting-fix" | "resolved";
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  new: "New",
  "in-progress": "In progress",
  "awaiting-fix": "Customer updated, awaiting service fix",
  resolved: "Resolved, awaiting customer confirmation",
};

/** The back-office check: what the CRM and ERP boxes send back (fictional data). */
export const BACK_OFFICE = {
  need: "Has the customer been charged? The case needs a back-office check.",
  results: [
    { from: "CRM", line: "Customer tier: Gold" },
    { from: "ERP", line: "Last payment: pending" },
  ],
  label: "Proposed integration. POC under evaluation. Fictional data.",
};
/** One hop of the request animation; five hops plus the reveal is about 4 seconds. */
export const INTEGRATION_HOP_MS = 750;

export type ChipId = "acknowledge" | "explain" | "next-update" | "workaround" | "apologise" | "jargon" | "promise";

/**
 * Message chips, in the order they appear in the message. Fixed, simulated CSAT
 * weights: the clear chips raise it, jargon and an unrealistic promise lower it.
 */
export const CHIPS: { id: ChipId; label: string; sentence: string; weight: number; communicates: string }[] = [
  { id: "apologise", label: "Apologise", sentence: "I'm sorry for the trouble this has caused.", weight: 0.2, communicates: "Empathy" },
  { id: "acknowledge", label: "Acknowledge the issue", sentence: "I can see your payments have failed this morning, and we're working on it.", weight: 0.4, communicates: "We've heard you" },
  {
    id: "explain",
    label: "Explain what we know",
    sentence: "Our payment service is unstable right now. It's affecting several customers, not just your account, and your last payment shows as pending, not taken.",
    weight: 0.4,
    communicates: "What's known in plain words",
  },
  {
    id: "jargon",
    label: "Use technical jargon",
    sentence: "Root cause: intermittent upstream gateway timeouts during the payment authorisation handshake.",
    weight: -0.4,
    communicates: "Detail that's hard to follow",
  },
  { id: "workaround", label: "Offer a workaround", sentence: "In the meantime, you can pay by bank transfer from your account page.", weight: 0.3, communicates: "A way to keep going now" },
  { id: "promise", label: "Promise a fix time", sentence: "It will be fixed within 30 minutes.", weight: -0.6, communicates: "A commitment the team can't back yet: the root cause is still under investigation" },
  { id: "next-update", label: "Give the next update time", sentence: "I'll update you again within 2 hours, sooner if it's fixed.", weight: 0.3, communicates: "When to expect news" },
];
/** Chip buttons in the order the brief lists them. */
export const CHIP_ORDER: ChipId[] = ["acknowledge", "explain", "next-update", "workaround", "apologise", "jargon", "promise"];
export const MESSAGE_GREETING = `Hi ${CUSTOMER_CASE.customer.name.split(" ")[0]},`;
export const MESSAGE_SIGNOFF = `${CUSTOMER_CASE.owner.split(",")[0]}, ${ENTERPRISE}`;

const chipById = (id: ChipId) => CHIPS.find((c) => c.id === id)!;
/** Selected chips in message order (not the order they were picked). */
export const messageChips = (selected: ChipId[]) => CHIPS.filter((c) => selected.includes(c.id));
export const messageText = (selected: ChipId[]) => messageChips(selected).map((c) => c.sentence).join(" ");
/** Simulated CSAT change: the sum of the fixed chip weights, to one decimal place. */
export const csatChange = (selected: ChipId[]) => Math.round(messageChips(selected).reduce((s, c) => s + c.weight, 0) * 10) / 10;
export const formatChange = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}`;

export const CASE_CALLOUT = "ITSM restores the service. CSM resolves the customer's issue and manages the relationship.";

export const caseCreatedEntry = (now: number): DecisionLogEntry => ({
  time: formatSimTime(now),
  incidentId: CUSTOMER_CASE.id,
  kind: "case",
  decision: "Customer reported the payment failure in the portal",
  consequence: `Case created, linked to ${PARENT_INCIDENT} and ${PROBLEM.id}; owner ${CUSTOMER_CASE.owner}`,
});

export const backOfficeEntry = (now: number): DecisionLogEntry => ({
  time: formatSimTime(now),
  incidentId: CUSTOMER_CASE.id,
  kind: "case",
  decision: "Back-office check through the proposed integration",
  consequence: BACK_OFFICE.results.map((r) => `${r.from}: ${r.line}`).join("; "),
});

export function messageEntry(selected: ChipId[], now: number): DecisionLogEntry {
  const chips = messageChips(selected);
  return {
    time: formatSimTime(now),
    incidentId: CUSTOMER_CASE.id,
    kind: "case",
    decision: `Customer update sent: ${chips.map((c) => c.label).join(", ")}`,
    consequence: `Simulated CSAT change ${formatChange(csatChange(selected))}; communicates: ${chips.map((c) => chipById(c.id).communicates.toLowerCase()).join(", ")}`,
  };
}

export const parentResolvedEntries = (now: number): DecisionLogEntry[] => [
  {
    time: formatSimTime(now),
    incidentId: PARENT_INCIDENT,
    kind: "case",
    decision: "Workaround applied; incident resolved",
    consequence: `Service restored for payments; ${PROBLEM.id} stays open for the root cause`,
  },
  {
    time: formatSimTime(now),
    incidentId: CUSTOMER_CASE.id,
    kind: "case",
    decision: `Status updated automatically from ${PARENT_INCIDENT}`,
    consequence: `${CASE_STATUS_LABEL.resolved}; the case closes when the customer confirms`,
  },
];

// --- Knowledge suggestion (while the payment incidents are still open) -----------------------------------

/** Pre-written, simulated retrieval: no live model. The query, then three fictional articles with fixed scores. */
export const KB_QUERY = "payment fails after login";
export type KnowledgeResult = { id: string; title: string; score: number; summary: string };
export const KB_RESULTS: KnowledgeResult[] = [
  {
    id: "KB-204",
    title: "Payment gateway recovery",
    score: 0.93,
    summary:
      "When customers can sign in but every payment fails with the same error, the payment gateway is usually rejecting new connections. Payments are held as pending, not taken, and clear once the gateway recovers.",
  },
  {
    id: "KB-117",
    title: "Card retry guidance",
    score: 0.81,
    summary:
      "What to tell a customer whose card payment didn't go through: retry once, not repeatedly; pending holds usually clear within 3 working days; try another card or bank transfer if it still fails.",
  },
  {
    id: "KB-052",
    title: "Session timeout troubleshooting",
    score: 0.64,
    summary:
      "For users signed out part-way through checkout: sign out fully, sign in again and retry. It doesn't apply when sign-in works and only the payment step fails.",
  },
];
export const KB_TOP = KB_RESULTS[0];
/** The top result's suggested resolution. */
export const KB_STEPS = [
  "Confirm the signature: sign-in works, the payment fails, and the payment shows as pending.",
  "Switch checkout to the secondary payment route (a pre-approved standard change).",
  "Ask the customer to retry once. If it still fails, offer bank transfer and link the incident to the open problem.",
];
export const KB_CONFIRMATION = "Requires agent confirmation before execution";
/** Real milliseconds between results appearing (instant under reduced motion). */
export const KB_RESULT_INTERVAL_MS = 500;

/** Accepting resolves these two open related incidents with the article. */
export const KB_RESOLVES = ["INC-1049", "INC-1050"];
/** With the article: the knowledge action's time. Without it: investigate, then escalate with context. */
export const KB_MINUTES = ACTION_MINUTES.knowledge;
export const MANUAL_MINUTES = ACTION_MINUTES.investigate + ACTION_MINUTES.escalateWithContext;
export const KB_MINUTES_SAVED = MANUAL_MINUTES - KB_MINUTES;

/** Accept: the two incidents resolve at first contact (these entries feed the metrics), and PRB-021 gets the proposed workaround. */
export function knowledgeAcceptEntries(now: number): DecisionLogEntry[] {
  const time = formatSimTime(now);
  return [
    {
      time,
      incidentId: KB_TOP.id,
      kind: "action",
      decision: `Used suggested resolution: ${KB_TOP.title} (match ${KB_TOP.score.toFixed(2)})`,
      consequence: `Agent confirmed before execution; applied to ${KB_RESOLVES.join(" and ")}`,
    },
    ...KB_RESOLVES.map(
      (id): DecisionLogEntry => ({
        time,
        incidentId: id,
        kind: "resolved",
        decision: `Resolved with ${KB_TOP.id}`,
        consequence: `Resolved in ${KB_MINUTES} simulated minutes instead of about ${MANUAL_MINUTES} (${KB_MINUTES_SAVED} saved); first contact`,
        resolution: { by: "knowledge", at: now, minutes: KB_MINUTES, withinTarget: true, breachedBy: 0, firstContact: true, csat: 5 },
      })
    ),
    {
      time,
      incidentId: PROBLEM.id,
      kind: "problem",
      decision: `${KB_TOP.id} flagged as the proposed workaround`,
      consequence: "The root cause investigation continues",
    },
  ];
}

export const KB_REJECT_NOTE = "The agent chose manual handling. The related incidents stay open and are worked as usual.";
export const knowledgeRejectEntry = (now: number): DecisionLogEntry => ({
  time: formatSimTime(now),
  incidentId: KB_TOP.id,
  kind: "action",
  decision: `Rejected suggestion: ${KB_TOP.title} (match ${KB_TOP.score.toFixed(2)})`,
  consequence: "Agent chose manual handling; related incidents stay open, no penalty",
});

// --- Automation studio (after the knowledge suggestion) ---------------------------------------------------

export type RuleWhen = "count" | "sla" | "p1";
export type RuleIf = "pattern" | "unit";
export type RuleThen = "problem" | "notify" | "article" | "escalate";
export type Rule = { when: RuleWhen; n: number; if: RuleIf; then: RuleThen[] };

export const RULE_WHEN: { id: RuleWhen; label: string }[] = [
  { id: "count", label: "Similar incident count exceeds N" },
  { id: "sla", label: "SLA at risk" },
  { id: "p1", label: "Priority is P1" },
];
export const RULE_IF: { id: RuleIf; label: string }[] = [
  { id: "pattern", label: "Same service and same failure pattern" },
  { id: "unit", label: "Same business unit" },
];
export const RULE_THEN: { id: RuleThen; label: string }[] = [
  { id: "problem", label: "Create problem record" },
  { id: "notify", label: "Notify support lead" },
  { id: "article", label: "Suggest knowledge article" },
  { id: "escalate", label: "Escalate to specialist" },
];
export const RULE_N = { min: 2, max: 10, start: 5 };
export const RULE_START: Rule = { when: "count", n: RULE_N.start, if: "pattern", then: [] };
/** The count is taken over this many simulated minutes. */
export const RULE_WINDOW_MINUTES = 30;

export type StreamKind = "payment" | "vpn" | "email" | "printer";
export const STREAM_SIGNATURE: Record<StreamKind, string> = {
  payment: "Payment fails after login",
  vpn: "VPN drops on remote connections",
  email: "Password reset email delayed",
  printer: "Receipt printer offline",
};
export type StreamIncident = { id: string; unit: BusinessUnit; kind: StreamKind; atRisk?: boolean };

/**
 * The simulated window after activation, in arrival order: four new payment
 * incidents, and the usual background of small, unrelated clusters. None is P1.
 */
export const RULE_STREAM: StreamIncident[] = [
  { id: "INC-1061", unit: "Retail Services", kind: "payment" },
  { id: "INC-1062", unit: "Field Operations", kind: "vpn" },
  { id: "INC-1063", unit: "Digital Channels", kind: "payment", atRisk: true },
  { id: "INC-1064", unit: "Corporate Services", kind: "email" },
  { id: "INC-1065", unit: "Retail Services", kind: "printer" },
  { id: "INC-1066", unit: "Field Operations", kind: "vpn" },
  { id: "INC-1067", unit: "Retail Services", kind: "payment" },
  { id: "INC-1068", unit: "Corporate Services", kind: "email", atRisk: true },
  { id: "INC-1069", unit: "Field Operations", kind: "vpn", atRisk: true },
  { id: "INC-1070", unit: "Retail Services", kind: "printer" },
  { id: "INC-1071", unit: "Digital Channels", kind: "payment", atRisk: true },
  { id: "INC-1072", unit: "Corporate Services", kind: "email" },
  { id: "INC-1073", unit: "Field Operations", kind: "vpn" },
  { id: "INC-1074", unit: "Retail Services", kind: "printer", atRisk: true },
  { id: "INC-1075", unit: "Corporate Services", kind: "email" },
];
export const RULE_PAYMENTS = RULE_STREAM.filter((i) => i.kind === "payment").length;
/** Already inside the window when the rule goes live: the six most recent payment incidents. */
const RULE_PRIOR: { unit: BusinessUnit; kind: StreamKind }[] = PATTERN_INCIDENTS.slice(1).map((r) => ({ unit: r.unit, kind: "payment" }));

/** Simulated triage minutes per incident. */
export const RULE_MINUTES = {
  manual: 8,
  /** Auto-linked to a problem record: a quick check. */
  clustered: 1,
  /** Not linked, but the matching article was suggested. */
  withArticle: 4,
  /** Added per escalation: the hand-off. */
  escalation: 3,
  /** Someone has to review and close each problem record nobody needed. */
  reviewRecord: 15,
} as const;
/** Real milliseconds between simulated arrivals (instant under reduced motion). */
export const RULE_ARRIVAL_MS = 120;

export type StreamOutcome = {
  incident: StreamIncident;
  fired: boolean;
  /** The problem record it was linked to, if any. */
  problem: string | null;
};
export type RuleResult = {
  verdict: "absorbed" | "late" | "none" | "unlinked" | "noisy";
  stream: StreamOutcome[];
  paymentLinked: number;
  /** Problem records created for clusters that didn't need one. */
  extraProblems: { id: string; title: string }[];
  alerts: number;
  unrelatedAlerts: number;
  articles: number;
  escalations: number;
  repeatBefore: number;
  repeatAfter: number;
  minutesWithout: number;
  minutesWith: number;
};

const PAYMENT_KEY = "pattern:payment";

/** Runs the rule over the fixed stream. Same rule in, same result out. */
export function simulateRule(rule: Rule, repeatBefore: number): RuleResult {
  const keyOf = (i: { unit: BusinessUnit; kind: StreamKind }) => (rule.if === "pattern" ? `pattern:${i.kind}` : `unit:${i.unit}`);
  const groups = new Map<string, { count: number; problem: string | null; notified: boolean }>();
  const group = (key: string) => {
    if (!groups.has(key)) groups.set(key, { count: 0, problem: key === PAYMENT_KEY ? PROBLEM.id : null, notified: false });
    return groups.get(key)!;
  };
  RULE_PRIOR.forEach((i) => group(keyOf(i)).count++);

  const has = (t: RuleThen) => rule.then.includes(t);
  const extraProblems: RuleResult["extraProblems"] = [];
  let alerts = 0;
  let unrelatedAlerts = 0;
  let articles = 0;
  let escalations = 0;
  let minutes = 0;

  const stream = RULE_STREAM.map((i): StreamOutcome => {
    const key = keyOf(i);
    const g = group(key);
    g.count++;
    const fired = rule.when === "count" ? g.count > rule.n : rule.when === "sla" ? !!i.atRisk : false;
    let problem: string | null = null;
    if (fired) {
      if (has("problem")) {
        if (!g.problem) {
          g.problem = `PRB-0${22 + extraProblems.length}`;
          extraProblems.push({ id: g.problem, title: rule.if === "pattern" ? STREAM_SIGNATURE[i.kind] : `${i.unit} incidents` });
        }
        problem = g.problem;
      }
      if (has("notify") && !g.notified) {
        g.notified = true;
        alerts++;
        if (key !== PAYMENT_KEY) unrelatedAlerts++;
      }
      if (has("article") && i.kind === "payment") articles++;
      if (has("escalate")) escalations++;
    }
    minutes += problem ? RULE_MINUTES.clustered : fired && has("article") && i.kind === "payment" ? RULE_MINUTES.withArticle : RULE_MINUTES.manual;
    if (fired && has("escalate")) minutes += RULE_MINUTES.escalation;
    return { incident: i, fired, problem };
  });
  minutes += extraProblems.length * RULE_MINUTES.reviewRecord;

  const paymentLinked = stream.filter((o) => o.incident.kind === "payment" && o.problem === PROBLEM.id).length;
  const anyFired = stream.some((o) => o.fired);
  const verdict: RuleResult["verdict"] = extraProblems.length
    ? "noisy"
    : !has("problem")
      ? anyFired
        ? "unlinked"
        : "none"
      : paymentLinked === RULE_PAYMENTS
        ? "absorbed"
        : paymentLinked > 0
          ? "late"
          : "none";

  return {
    verdict,
    stream,
    paymentLinked,
    extraProblems,
    alerts,
    unrelatedAlerts,
    articles,
    escalations,
    repeatBefore,
    repeatAfter: repeatBefore + RULE_PAYMENTS - paymentLinked,
    minutesWithout: RULE_STREAM.length * RULE_MINUTES.manual,
    minutesWith: minutes,
  };
}

export const NOISY_LINE = "This rule creates more records than it resolves.";

/** A neutral reading of the result: what the rule did, never a grade. */
export function ruleHeadline(rule: Rule, r: RuleResult): { title: string; detail: string } {
  switch (r.verdict) {
    case "noisy": {
      const n = r.extraProblems.length;
      const opened = n === 1 ? "It opened a problem record for a cluster that didn't need one" : `It opened ${n} problem records for clusters that didn't need one`;
      const alerts = r.unrelatedAlerts
        ? r.alerts === 1
          ? " and sent the support lead an alert about it"
          : ` and sent the support lead ${r.alerts} alerts, ${r.unrelatedAlerts === r.alerts ? "all" : r.unrelatedAlerts} about ${n === 1 ? "that cluster" : "those clusters"}`
        : "";
      const mixed =
        rule.if === "unit" ? ` Grouping by business unit mixed unrelated failures, so ${r.paymentLinked ? "only " + r.paymentLinked : "none"} of the payment incidents reached ${PROBLEM.id}.` : "";
      return { title: NOISY_LINE, detail: `${opened}${alerts}.${mixed} Edit the rule and run it again.` };
    }
    case "absorbed":
      return { title: `The rule held the pattern: all ${RULE_PAYMENTS} new payment incidents joined ${PROBLEM.id} automatically.`, detail: "Repeat incidents stopped rising." };
    case "late":
      return {
        title: `The rule caught the pattern late: ${r.paymentLinked} of ${RULE_PAYMENTS} payment incidents joined ${PROBLEM.id}.`,
        detail: `The first ${RULE_PAYMENTS - r.paymentLinked} were triaged by hand before the count passed ${rule.n}.`,
      };
    case "unlinked":
      return { title: "The rule fired, but nothing links the incidents to a problem record.", detail: "Each one is still worked on its own." };
    case "none":
      return {
        title: "The rule didn't fire for the payment incidents.",
        detail:
          rule.when === "p1"
            ? "None of the incidents in this window was P1."
            : rule.when === "count"
              ? `The similar count never passed ${rule.n} in the ${RULE_WINDOW_MINUTES}-minute window.`
              : "None of the payment incidents was linked to a problem record.",
      };
  }
}

export function describeRule(rule: Rule) {
  const when = rule.when === "count" ? `similar incident count exceeds ${rule.n}` : RULE_WHEN.find((w) => w.id === rule.when)!.label.toLowerCase();
  const cond = RULE_IF.find((c) => c.id === rule.if)!.label.toLowerCase();
  const then = RULE_THEN.filter((t) => rule.then.includes(t.id))
    .map((t) => t.label.toLowerCase())
    .join(", ");
  return `WHEN ${when} · IF ${cond} · THEN ${then}`;
}

export function finalRuleEntry(rule: Rule, r: RuleResult, runs: number, now: number): DecisionLogEntry {
  return {
    time: formatSimTime(now),
    incidentId: "RULE",
    kind: "automation",
    repeatIncidents: r.repeatAfter,
    rule: { linked: r.paymentLinked, extra: r.extraProblems.length },
    decision: `Final rule: ${describeRule(rule)}`,
    consequence: `${r.paymentLinked} of ${RULE_PAYMENTS} payment incidents linked to ${PROBLEM.id}; ${r.extraProblems.length} extra problem ${r.extraProblems.length === 1 ? "record" : "records"}; ${r.alerts} lead ${r.alerts === 1 ? "alert" : "alerts"}; ${r.articles} articles suggested; ${r.escalations} escalations; triage ${r.minutesWithout} → ${r.minutesWith} simulated min; ${runs} ${runs === 1 ? "run" : "runs"}`,
  };
}

// --- Shift summary and the real-world reveal -----------------------------------------------------------

export const SUMMARY_LABEL = "Simulated results from your decisions";

/** The latest repeat-incident count in the log (null before the pattern appears). */
export function repeatFromLog(log: DecisionLogEntry[]) {
  const last = [...log].reverse().find((e) => e.repeatIncidents !== undefined);
  return last?.repeatIncidents ?? null;
}

/** Service improvements actually made this shift, read from the log. Only what happened is listed. */
export function improvementsFromLog(log: DecisionLogEntry[]): string[] {
  const out: string[] = [];
  const routed = new Set(log.filter((e) => e.kind === "triage" && e.decision.startsWith("Routed to")).map((e) => e.incidentId)).size;
  if (routed) out.push(`Routed ${routed} ${routed === 1 ? "incident" : "incidents"} with a category, impact, urgency and SLA target`);
  const pattern = log.find((e) => e.kind === "pattern" && e.decision === PATTERN.title);
  if (pattern) out.push(`Identified a recurring issue: ${pattern.repeatIncidents} similar payment incidents`);
  const problem = log.find((e) => e.kind === "problem" && e.decision.startsWith("Problem record"));
  if (problem) out.push(`Created a problem record: ${PROBLEM.id} ${PROBLEM.title}`);
  const withKnowledge = log.filter((e) => e.kind === "resolved" && e.resolution?.by === "knowledge").length;
  if (withKnowledge) out.push(`Used knowledge-assisted resolution on ${withKnowledge} ${withKnowledge === 1 ? "incident" : "incidents"}`);
  const rule = log.find((e) => e.kind === "automation" && e.rule);
  if (rule?.rule && rule.rule.linked > 0) out.push(`Automated repeatable triage: a rule linked ${rule.rule.linked} new payment incidents to ${PROBLEM.id}`);
  return out;
}

/** Resume wording only: no added numbers or claims. */
export const WHAT_I_DID = [
  "Owned the incident lifecycle end to end for 4 business units, including categorisation, impact/urgency, routing, and SLA rules.",
  "Tracked resolution time, SLA compliance, first-contact resolution, repeat incidents and CSAT, and used trend analysis to drive knowledge management, automation, and problem management.",
  "Designed a triage, routing and resolution POC, now under evaluation for integrating ServiceNow CSM with CRM, SAP, and middleware.",
];

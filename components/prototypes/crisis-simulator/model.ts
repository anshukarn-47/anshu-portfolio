import type { Status } from "@/components/prototypes/engine/status";

/**
 * Crisis simulator: a pure reducer (no timers or React in here).
 *
 * The surge starts at the moment it hits (numbers from the demand-surge case
 * study). Three rounds arrive in the decision queue: 1) API utilization (pick an
 * option, "Make decision"), 2) an injected mobile-traffic signal answered from
 * the Decision Deck, 3) recovery, once no customer function is critical. Each
 * round has a countdown (ROUND_TIME_SECONDS); at zero it auto-advances with
 * whatever was selected. Consequences land on the same dashboard. If the API
 * tier saturates, emergency and booking start failing. After the last round the
 * incident closes and a debrief compares the run with the real incident.
 */

export type HealthKey = "cpu" | "api" | "db";
export type FunctionKey = "emergency" | "booking" | "loyalty" | "analytics";
export type FunctionState = "stable" | "degraded" | "down" | "shed";
export type StakeholderKey = "operations" | "engineering" | "leadership" | "marketing";
export type StakeholderState = "inactive" | "engaged" | "concerned";
export type MeterKey = "availability" | "customerImpact" | "featureDelivery" | "cost";
export type CapacityKey = "coreBooking" | "emergency" | "loyalty" | "analytics" | "onboarding" | "newFeatures";

export type Effect = {
  health?: Partial<Record<HealthKey, number>>; // deltas, percentage points
  traffic?: Partial<Record<"ivrs" | "mobile", number>>; // deltas, req/sec
  functions?: Partial<Record<FunctionKey, FunctionState>>;
  stakeholders?: Partial<Record<StakeholderKey, StakeholderState>>;
  meters?: Partial<Record<MeterKey, number>>; // deltas
};

export type DecisionOption = {
  id: string;
  label: string;
  /** The trade-off in words, shown with the option (no numbers: the dashboard shows those). */
  hint: string;
  effect: Effect;
  /** What changed, listed under "Decision applied". */
  changes: string[];
  /** How the consequence reads in the incident log: stable (good call), warning or critical. */
  tone: "stable" | "warning" | "critical";
  /** What was decided and what happened: the incident log and decisionLog description. */
  log: string;
};

/**
 * A round. "choice" rounds offer fixed options. "event" rounds inject a new
 * signal (it changes the dashboard as it lands) and are answered from the
 * Decision Deck: an action applied to a target.
 */
export type Decision = {
  id: string;
  kind?: "choice" | "event";
  title: string;
  context?: string;
  options: DecisionOption[];
  /** Seconds after the previous round resolves (default DECISION_GAP). */
  arrivesAfter?: number;
  /** "stable": only arrives once no customer function is critical (down). */
  requires?: "stable";
};

/** Round 2's signal: mobile/portal traffic up another 18% (18K → 21.2K req/sec on the usual path). */
export const MOBILE_SURGE = 0.18;

export const DECISIONS: Decision[] = [
  {
    id: "api-utilization",
    title: "API utilization has reached 91%. What do you do?",
    options: [
      {
        id: "continue-roadmap",
        label: "Continue planned roadmap",
        hint: "Delivery stays on track; booking and emergency keep competing for capacity.",
        effect: {
          health: { api: 5, cpu: 3 },
          stakeholders: { engineering: "engaged" },
          meters: { availability: -1.2, customerImpact: 8 },
        },
        changes: ["Roadmap work continues on shared capacity", "Core booking and Emergency stay degraded"],
        tone: "warning",
        log: "Continued the planned roadmap. API load kept climbing.",
      },
      {
        id: "deprioritise",
        label: "Deprioritise non-critical features",
        hint: "Frees capacity for booking and emergency; loyalty and analytics pause.",
        effect: {
          health: { api: -7, cpu: -6, db: -3 },
          functions: { booking: "stable", emergency: "stable", loyalty: "shed", analytics: "shed" },
          stakeholders: { engineering: "engaged", marketing: "concerned" },
          meters: { availability: 0.8, customerImpact: -8, featureDelivery: -10 },
        },
        changes: [
          "Loyalty deployment paused",
          "Analytics jobs paused",
          "Core booking and Emergency back to stable",
        ],
        tone: "stable",
        log: "Deprioritised non-critical features: loyalty deployment and analytics paused.",
      },
      {
        id: "pause-all",
        label: "Pause all user-facing functionality",
        hint: "Takes almost all load off the platform, and every customer with it.",
        effect: {
          health: { api: -31, cpu: -25, db: -15 },
          traffic: { ivrs: -30_000, mobile: -15_000 },
          functions: { booking: "shed", emergency: "shed", loyalty: "shed", analytics: "shed" },
          stakeholders: { operations: "concerned", leadership: "concerned", engineering: "engaged" },
          meters: { availability: -6, customerImpact: 40, featureDelivery: -20 },
        },
        changes: [
          "Booking, emergency, loyalty and analytics paused",
          "Customers can't book or reach emergency services",
        ],
        tone: "critical",
        log: "Paused all user-facing functionality. Load dropped, and so did service to every customer.",
      },
    ],
  },
  {
    id: "mobile-surge",
    kind: "event",
    title: "Mobile traffic has increased another 18%",
    options: [],
    arrivesAfter: 25,
  },
  {
    id: "recovery",
    title: "Platform stable. Core services are operational. Now restore capacity. What comes back first?",
    requires: "stable",
    options: [
      {
        id: "restore-analytics",
        label: "Analytics",
        hint: "Visibility into the incident and its impact comes back.",
        effect: { health: { api: 2, db: 2 }, functions: { analytics: "stable" }, stakeholders: { engineering: "engaged" }, meters: { featureDelivery: 5 } },
        changes: ["Analytics jobs resumed", "Incident reporting back online"],
        tone: "stable",
        log: "Recovery: restored analytics first.",
      },
      {
        id: "restore-loyalty",
        label: "Loyalty",
        hint: "Customer-facing rewards return; marketing gets its channel back.",
        effect: { health: { api: 3 }, functions: { loyalty: "stable" }, stakeholders: { marketing: "engaged" }, meters: { featureDelivery: 5 } },
        changes: ["Loyalty deployment resumed", "Marketing's campaign channel back"],
        tone: "stable",
        log: "Recovery: restored loyalty first.",
      },
      {
        id: "restore-onboarding",
        label: "Onboarding",
        hint: "New users can sign up again.",
        effect: { health: { api: 2 }, meters: { featureDelivery: 5 } },
        changes: ["Onboarding flows resumed", "New sign-ups open again"],
        tone: "stable",
        log: "Recovery: restored onboarding first.",
      },
      {
        id: "restore-new-features",
        label: "New features",
        hint: "The roadmap restarts; the release that slipped is back in motion.",
        effect: { health: { api: 3 }, stakeholders: { engineering: "engaged" }, meters: { featureDelivery: 10 } },
        changes: ["Feature work resumed", "Paused release back in motion"],
        tone: "stable",
        log: "Recovery: restored new feature work first.",
      },
    ],
  },
];

/** The end screen's takeaway. */
export const PRODUCT_PRINCIPLE =
  "During a high-pressure incident, prioritise critical customer functions over non-essential roadmap work.";

/** Capacity budget: 100 points across the work competing for the platform. Shown as context for now. */
export const CAPACITY: { key: CapacityKey; label: string; points: number; critical: boolean }[] = [
  { key: "coreBooking", label: "Core booking", points: 30, critical: true },
  { key: "emergency", label: "Emergency", points: 25, critical: true },
  { key: "loyalty", label: "Loyalty", points: 15, critical: false },
  { key: "analytics", label: "Analytics", points: 10, critical: false },
  { key: "onboarding", label: "Onboarding", points: 10, critical: false },
  { key: "newFeatures", label: "New features", points: 10, critical: false },
];
export const CAPACITY_TOTAL = 100;

// --- Stakeholder interruptions -------------------------------------------------------

/**
 * Fixed schedule (seconds into the war room). One card shows at a time; later
 * ones queue. The fastest possible run reaches the debrief at about T+44, so
 * every interruption fires before then. Leadership isn't on the schedule: its
 * card is the communication mini-game (COMMS), triggered after Round 2.
 */
export const INTERRUPTIONS: { at: number; who: StakeholderKey; message: string }[] = [
  { at: 8, who: "operations", message: "Emergency booking cannot degrade." },
  { at: 18, who: "engineering", message: "We need 20 capacity points to stabilize the API layer." },
  { at: 30, who: "marketing", message: "Can we still launch the loyalty campaign?" },
];

export type Interruption = { who: StakeholderKey; message: string; kind?: "comms" };

// --- Stakeholder communication mini-game ---------------------------------------------

export type QualityKey = "specificity" | "customerFocus" | "riskClarity" | "tradeoffClarity";
export type QualityLevel = "Low" | "Medium" | "High";

export const QUALITY_LABELS: Record<QualityKey, string> = {
  specificity: "Specificity",
  customerFocus: "Customer focus",
  riskClarity: "Risk clarity",
  tradeoffClarity: "Tradeoff clarity",
};

/**
 * Leadership's question, asked once after Round 2 (only if loyalty was paused,
 * since that's what it asks about). Each answer has fixed message-quality
 * levels: B highest on all four, A lowest, C in between. They describe what the
 * response communicates; they're never a score.
 */
export const COMMS = {
  question: "Why did you stop the loyalty release?",
  options: [
    {
      id: "a",
      text: "We had to because engineering said so.",
      quality: { specificity: "Low", customerFocus: "Low", riskClarity: "Low", tradeoffClarity: "Low" },
      reading: "Points to another team. It doesn't say what was protected, for whom, or what it cost.",
      leadership: "concerned",
    },
    {
      id: "b",
      text: "We protected critical booking and emergency functions while reducing non-essential load.",
      quality: { specificity: "High", customerFocus: "High", riskClarity: "High", tradeoffClarity: "High" },
      reading: "Names what was protected and why, and what was set aside to do it.",
      leadership: "engaged",
    },
    {
      id: "c",
      text: "The system was overloaded.",
      quality: { specificity: "Medium", customerFocus: "Low", riskClarity: "Medium", tradeoffClarity: "Low" },
      reading: "Names the pressure, but not what was protected or what the pause traded off.",
      leadership: "engaged",
    },
  ],
} as const satisfies {
  question: string;
  options: readonly {
    id: string;
    text: string;
    quality: Record<QualityKey, QualityLevel>;
    reading: string;
    leadership: StakeholderState;
  }[];
};
export type CommsOptionId = (typeof COMMS.options)[number]["id"];

// --- Limited information ---------------------------------------------------------------

export type UnknownSignal = "dbSaturation" | "errorDistribution" | "regionalImpact";

export const UNKNOWN_LABELS: Record<UnknownSignal, string> = {
  dbSaturation: "Database saturation",
  errorDistribution: "Error distribution",
  regionalImpact: "Regional impact",
};

/** What "Request more data" costs: seconds off the current round's countdown (or the next round's, between rounds). */
export const DATA_REQUEST_SECONDS = 15;

/** Revealed values. DB saturation is live; the other two are fixed readings for this scenario. */
export function unknownValue(s: CrisisState, k: UnknownSignal): string {
  if (k === "dbSaturation") return `${s.health.db}%`;
  if (k === "errorDistribution") return "API timeouts 64% · IVRS queue drops 22% · Other 14%";
  return "North: high · West: moderate · South: low · East: low";
}

/** Booking success rate (a known signal), derived from booking's state and how hot the API tier is. */
export function bookingSuccessRate(s: CrisisState): number {
  const base = { stable: 98, degraded: 84, down: 0, shed: 0 }[s.functions.booking];
  const penalty = s.locked.includes("booking") ? 0 : Math.max(0, s.health.api - 90) * 2;
  return Math.max(0, base - penalty);
}

// --- Ask Engineering -------------------------------------------------------------------

export type QuestionId = "db-bottleneck" | "scale-api" | "safe-to-pause" | "error-by-region";

/** Two questions per run, from four. Each answer is fixed and reveals its related unknown signal for free. */
export const QUESTION_SLOTS = 2;
export const QUESTIONS: { id: QuestionId; question: string; answer: string; reveals: UnknownSignal }[] = [
  {
    id: "db-bottleneck",
    question: "Is the database the bottleneck?",
    answer: "The API layer is approaching saturation. The database currently has headroom.",
    reveals: "dbSaturation",
  },
  {
    id: "scale-api",
    question: "Can we scale the API layer?",
    answer: "Yes, but new API capacity takes about 10 minutes to come online, and it pushes more load onto the database. Watch it.",
    reveals: "dbSaturation",
  },
  {
    id: "safe-to-pause",
    question: "Which services are safest to pause?",
    answer: "Loyalty, analytics and onboarding can pause without customer-facing errors. Most current errors are API timeouts on booking.",
    reveals: "errorDistribution",
  },
  {
    id: "error-by-region",
    question: "What's the error rate by region?",
    answer: "Errors are concentrated in the North, where the surge started. The South and East are mostly unaffected so far.",
    reveals: "regionalImpact",
  },
];

// --- Decision Deck -------------------------------------------------------------------

export type DeckAction = "scale" | "deprioritise" | "protect" | "throttle" | "monitor";
export type TrafficKey = "ivrs" | "mobile";
export type DeckTarget = FunctionKey | TrafficKey;
export type ImpactLevel = "Low" | "Medium" | "Critical";

export const DECK_ACTIONS: { key: DeckAction; label: string; summary: string }[] = [
  { key: "scale", label: "Scale", summary: "+capacity, +cost" },
  { key: "deprioritise", label: "Deprioritise", summary: "Pause work, −features" },
  { key: "protect", label: "Protect", summary: "Lock core functions" },
  { key: "throttle", label: "Throttle", summary: "Reduce load" },
  { key: "monitor", label: "Monitor", summary: "Wait and watch" },
];

export const TRAFFIC_LABELS: Record<TrafficKey, string> = { ivrs: "IVRS", mobile: "Mobile / portal" };

export function targetLabel(t: DeckTarget) {
  return t === "ivrs" || t === "mobile" ? TRAFFIC_LABELS[t] : FUNCTION_LABELS[t];
}

export type DeckImpact = {
  effect: Effect;
  /** Protect: this function is locked stable (effects and saturation can't degrade it). */
  lock?: FunctionKey;
  /** Customer impact level shown in the preview. */
  level: ImpactLevel;
  /** What changed, listed under "Decision applied". */
  changes: string[];
  /** The decisionLog / incident log description. */
  log: string;
};

const MONITOR_EFFECT: Effect = {
  health: { api: 4, cpu: 3 },
  stakeholders: { leadership: "concerned" },
  meters: { availability: -0.6, customerImpact: 4 },
};
const monitor = (what: string, extraApi = 0): DeckImpact => ({
  effect: { ...MONITOR_EFFECT, health: { api: 4 + extraApi, cpu: 3 } },
  level: "Medium",
  changes: [`Watching ${what}; no change made`, "Load keeps building meanwhile"],
  log: `Chose to monitor ${what} rather than act.`,
});

/**
 * Fixed outcome for every action and target (no randomness). Numbers are
 * deltas; function states are set outright.
 */
export const DECK_IMPACT: Record<DeckAction, Record<DeckTarget, DeckImpact>> = {
  scale: {
    emergency: {
      effect: { health: { api: -4, cpu: -3 }, functions: { emergency: "stable" }, stakeholders: { engineering: "engaged" }, meters: { cost: 15, availability: 0.3, customerImpact: -3 } },
      level: "Low",
      changes: ["Emergency capacity added", "Cost up"],
      log: "Scaled emergency services.",
    },
    booking: {
      effect: { health: { api: -6, cpu: -4 }, functions: { booking: "stable" }, stakeholders: { engineering: "engaged" }, meters: { cost: 20, availability: 0.4, customerImpact: -4 } },
      level: "Low",
      changes: ["Booking capacity added", "Cost up"],
      log: "Scaled core booking.",
    },
    loyalty: {
      effect: { health: { api: -2 }, stakeholders: { engineering: "engaged", marketing: "engaged" }, meters: { cost: 15 } },
      level: "Low",
      changes: ["Capacity added to a non-critical service", "Cost up for little relief"],
      log: "Scaled loyalty.",
    },
    analytics: {
      effect: { health: { api: -1 }, stakeholders: { engineering: "engaged" }, meters: { cost: 15 } },
      level: "Low",
      changes: ["Capacity added to analytics", "Cost up for little relief"],
      log: "Scaled analytics.",
    },
    ivrs: {
      effect: { health: { api: -5, cpu: -3 }, stakeholders: { engineering: "engaged", operations: "engaged" }, meters: { cost: 20, customerImpact: -3, availability: 0.3 } },
      level: "Low",
      changes: ["IVRS tier scaled out", "Cost up"],
      log: "Scaled the IVRS tier.",
    },
    mobile: {
      effect: { health: { api: -9, cpu: -6, db: -2 }, stakeholders: { engineering: "engaged", leadership: "engaged" }, meters: { cost: 25, customerImpact: -5, availability: 0.6 } },
      level: "Low",
      changes: ["Mobile/portal tier scaled out", "Headroom for the extra 18%", "Cost up"],
      log: "Scaled the mobile/portal tier to absorb the extra traffic.",
    },
  },
  deprioritise: {
    emergency: {
      effect: { health: { api: -5 }, functions: { emergency: "shed" }, stakeholders: { operations: "concerned", leadership: "concerned" }, meters: { customerImpact: 30, availability: -3 } },
      level: "Critical",
      changes: ["Emergency services paused", "Callers can't reach emergency services"],
      log: "Paused emergency services.",
    },
    booking: {
      effect: { health: { api: -10, cpu: -6 }, functions: { booking: "shed" }, stakeholders: { operations: "concerned", leadership: "concerned" }, meters: { customerImpact: 25, availability: -2 } },
      level: "Critical",
      changes: ["Core booking paused", "Customers can't book"],
      log: "Paused core booking.",
    },
    loyalty: {
      effect: { health: { api: -2 }, functions: { loyalty: "shed" }, stakeholders: { marketing: "concerned" }, meters: { featureDelivery: -3 } },
      level: "Low",
      changes: ["Remaining loyalty jobs paused"],
      log: "Paused remaining loyalty work.",
    },
    analytics: {
      effect: { health: { api: -2 }, functions: { analytics: "shed" }, meters: { featureDelivery: -2 } },
      level: "Low",
      changes: ["Remaining analytics jobs paused"],
      log: "Paused remaining analytics jobs.",
    },
    ivrs: {
      effect: { health: { api: -4 }, stakeholders: { operations: "engaged" }, meters: { customerImpact: 5, featureDelivery: -3 } },
      level: "Medium",
      changes: ["Non-urgent IVRS menus paused"],
      log: "Paused non-urgent IVRS menus.",
    },
    mobile: {
      effect: { health: { api: -7, cpu: -4 }, stakeholders: { marketing: "concerned", engineering: "engaged" }, meters: { customerImpact: 4, featureDelivery: -8 } },
      level: "Medium",
      changes: ["Promotions and recommendations paused on mobile"],
      log: "Paused non-essential mobile features (promotions, recommendations).",
    },
  },
  protect: {
    emergency: {
      effect: { health: { api: 1 }, functions: { emergency: "stable" }, stakeholders: { operations: "engaged" }, meters: { customerImpact: -4, cost: 5 } },
      lock: "emergency",
      level: "Low",
      changes: ["Emergency locked: guaranteed capacity", "Won't degrade under load"],
      log: "Protected emergency: locked its capacity.",
    },
    booking: {
      effect: { health: { api: 1 }, functions: { booking: "stable" }, stakeholders: { operations: "engaged" }, meters: { customerImpact: -5, cost: 5 } },
      lock: "booking",
      level: "Low",
      changes: ["Core booking locked: guaranteed capacity", "Won't degrade under load"],
      log: "Protected core booking: locked its capacity.",
    },
    loyalty: {
      effect: { health: { api: 4, cpu: 2 }, functions: { loyalty: "stable" }, stakeholders: { marketing: "engaged", engineering: "concerned" }, meters: { customerImpact: 3, featureDelivery: 4 } },
      lock: "loyalty",
      level: "Medium",
      changes: ["Loyalty locked on", "Capacity reserved away from booking and emergency"],
      log: "Protected loyalty, reserving capacity for it.",
    },
    analytics: {
      effect: { health: { api: 3 }, functions: { analytics: "stable" }, stakeholders: { engineering: "concerned" }, meters: { customerImpact: 3, featureDelivery: 2 } },
      lock: "analytics",
      level: "Medium",
      changes: ["Analytics locked on", "Capacity reserved away from booking and emergency"],
      log: "Protected analytics, reserving capacity for it.",
    },
    ivrs: {
      effect: { health: { api: 1 }, functions: { emergency: "stable" }, stakeholders: { operations: "engaged" }, meters: { customerImpact: -3 } },
      lock: "emergency",
      level: "Low",
      changes: ["IVRS capacity reserved for emergency lines", "Emergency locked"],
      log: "Protected emergency lines on IVRS.",
    },
    mobile: {
      effect: { health: { api: 2 }, functions: { booking: "stable" }, stakeholders: { engineering: "engaged" }, meters: { customerImpact: -2 } },
      lock: "booking",
      level: "Low",
      changes: ["Mobile capacity reserved for booking", "Core booking locked"],
      log: "Protected booking on mobile/portal.",
    },
  },
  throttle: {
    emergency: {
      effect: { health: { api: -3 }, functions: { emergency: "degraded" }, stakeholders: { operations: "concerned", leadership: "concerned" }, meters: { customerImpact: 20, availability: -1 } },
      level: "Critical",
      changes: ["Emergency requests rate-limited", "Some emergency callers turned away"],
      log: "Throttled emergency requests.",
    },
    booking: {
      effect: { health: { api: -7, cpu: -4 }, functions: { booking: "degraded" }, stakeholders: { operations: "concerned" }, meters: { customerImpact: 12, availability: -0.5 } },
      level: "Critical",
      changes: ["Booking requests rate-limited", "Customers see 'try again later'"],
      log: "Throttled core booking.",
    },
    loyalty: {
      effect: { health: { api: -2 }, meters: { customerImpact: 1 } },
      level: "Low",
      changes: ["Loyalty requests rate-limited"],
      log: "Throttled loyalty requests.",
    },
    analytics: {
      effect: { health: { api: -2 } },
      level: "Low",
      changes: ["Analytics ingestion rate-limited"],
      log: "Throttled analytics ingestion.",
    },
    ivrs: {
      effect: { health: { api: -6, cpu: -3 }, traffic: { ivrs: -8_000 }, stakeholders: { operations: "concerned" }, meters: { customerImpact: 10, availability: -0.3 } },
      level: "Medium",
      changes: ["IVRS rate-limited to 32K req/sec", "Some callers hear a busy tone"],
      log: "Throttled IVRS.",
    },
    mobile: {
      effect: { health: { api: -9, cpu: -5 }, traffic: { mobile: -3_200 }, stakeholders: { marketing: "concerned", engineering: "engaged" }, meters: { customerImpact: 4 } },
      level: "Low",
      changes: ["Non-critical mobile requests rate-limited", "Booking and emergency traffic exempt"],
      log: "Throttled non-critical mobile/portal requests, exempting booking and emergency.",
    },
  },
  monitor: {
    emergency: monitor("emergency"),
    booking: monitor("booking"),
    loyalty: monitor("loyalty"),
    analytics: monitor("analytics"),
    ivrs: monitor("IVRS traffic"),
    mobile: monitor("mobile traffic", 1),
  },
};

/** What the "System impact" preview shows before confirming. */
export function deckPreview(s: CrisisState, action: DeckAction, target: DeckTarget) {
  const impact = DECK_IMPACT[action][target];
  const apiAfter = clamp(s.health.api + (impact.effect.health?.api ?? 0));
  const stakeholders = Object.entries(impact.effect.stakeholders ?? {})
    .filter(([k, v]) => s.stakeholders[k as StakeholderKey] !== v)
    .map(([k, v]) => `${STAKEHOLDER_LABELS[k as StakeholderKey]} ${STAKEHOLDER_DISPLAY[v].text.toLowerCase()}`);
  return { impact, apiBefore: s.health.api, apiAfter, level: impact.level, stakeholders };
}

export type LogEntry = { at: number; text: string; tone: Status };
/** One entry per confirmed decision, e.g. { time: "T+00:42", description: "…" }. */
export type DecisionLogEntry = { time: string; description: string };

export type CrisisState = {
  phase: "briefing" | "war-room" | "debrief";
  /** Increments on every (re)start, so the UI can remount the war room. */
  run: number;
  /** Seconds since entering the war room. */
  seconds: number;
  health: Record<HealthKey, number>;
  traffic: { ivrs: number; mobile: number };
  functions: Record<FunctionKey, FunctionState>;
  stakeholders: Record<StakeholderKey, StakeholderState>;
  meters: Record<MeterKey, number>;
  capacity: Record<CapacityKey, number>;
  /** Index of the next round to show (DECISIONS.length when all are done). */
  decisionIndex: number;
  /** Seconds when the current round arrived, or null when none is pending. */
  pendingSince: number | null;
  /** When the next round arrives (seconds). */
  nextAt: number;
  /** Each round's decision, for the debrief. */
  choices: { decisionId: string; label: string }[];
  /** Incident log: rounds, consequences and system events (shown on the dashboard). */
  log: LogEntry[];
  /** Decisions only, in order (shown on the end screen). */
  decisionLog: DecisionLogEntry[];
  /** The latest decision, for the "Decision applied" reveal (health before and after is measured, not canned). */
  lastApplied: {
    label: string;
    changes: string[];
    tone: "stable" | "warning" | "critical";
    before: Record<HealthKey, number>;
    after: Record<HealthKey, number>;
  } | null;
  /** Functions locked by Protect: nothing can degrade them. */
  locked: FunctionKey[];
  /** Every function paused at any point in the run (for the end-screen comparison). */
  paused: FunctionKey[];
  /** The latest injected signal (Round 2): mobile req/sec before and after. */
  signal: { from: number; to: number } | null;
  /** Stakeholder cards waiting to be dismissed (first one is shown), and how many have fired. */
  interruptions: Interruption[];
  interruptionsFired: number;
  /** Communication mini-game: triggered at most once; the player's answer. */
  commsTriggered: boolean;
  commsChoice: CommsOptionId | null;
  /** Unknown signals the player has revealed (by requesting data or asking Engineering). */
  revealed: UnknownSignal[];
  /** Ask Engineering: questions asked, in order (at most QUESTION_SLOTS). */
  asked: QuestionId[];
  /** Round timer: seconds used on the current round (ticks plus data-request penalties). */
  roundElapsed: number;
  /** Data-request penalty incurred between rounds, charged to the next round. */
  carryPenalty: number;
  /** "No rush": the countdown stops (it never expires). */
  noRush: boolean;
  /** The current round's in-progress selection; applied as-is if time runs out. */
  draft: { optionId?: string; action?: DeckAction; target?: DeckTarget };
  /** Lowest availability reached during the run. */
  lowestAvailability: number;
};

export const BASELINE_TRAFFIC = { ivrs: 10_000, mobile: 3_000 };

/** Seconds before Round 1, after a decision before the next round (time to read "Decision applied"). */
export const FIRST_DECISION_AT = 3;
export const DECISION_GAP = 8;
/** Per-round countdown. At zero the round auto-advances with whatever was selected. */
export const ROUND_TIME_SECONDS = 75;
/** Recovery waits for stability at most this long after it's due, then the incident closes without it. */
export const RECOVERY_WAIT_MAX = 30;

export const INITIAL_STATE: CrisisState = {
  phase: "briefing",
  run: 0,
  seconds: 0,
  health: { cpu: 87, api: 91, db: 71 },
  traffic: { ivrs: 40_000, mobile: 18_000 },
  functions: { emergency: "degraded", booking: "degraded", loyalty: "stable", analytics: "degraded" },
  stakeholders: { operations: "inactive", engineering: "inactive", leadership: "inactive", marketing: "inactive" },
  meters: { availability: 98, customerImpact: 28, featureDelivery: 100, cost: 20 },
  capacity: Object.fromEntries(CAPACITY.map((c) => [c.key, c.points])) as Record<CapacityKey, number>,
  decisionIndex: 0,
  pendingSince: null,
  nextAt: FIRST_DECISION_AT,
  choices: [],
  log: [],
  decisionLog: [],
  lastApplied: null,
  locked: [],
  paused: [],
  signal: null,
  interruptions: [],
  interruptionsFired: 0,
  commsTriggered: false,
  commsChoice: null,
  revealed: [],
  asked: [],
  roundElapsed: 0,
  carryPenalty: 0,
  noRush: false,
  draft: {},
  lowestAvailability: 98,
};

export type Action =
  | { type: "enter" }
  | { type: "tick" }
  | { type: "choose"; optionId: string }
  | { type: "act"; action: DeckAction; target: DeckTarget }
  | { type: "dismiss" }
  | { type: "respondComms"; optionId: CommsOptionId }
  | { type: "draft"; draft: CrisisState["draft"] }
  | { type: "setNoRush"; noRush: boolean }
  | { type: "requestData"; signal: UnknownSignal }
  | { type: "ask"; question: QuestionId }
  | { type: "reset" };

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function applyEffect(s: CrisisState, e: Effect): CrisisState {
  const health = { ...s.health };
  for (const [k, d] of Object.entries(e.health ?? {})) health[k as HealthKey] = clamp(health[k as HealthKey] + d);
  const traffic = { ...s.traffic };
  for (const [k, d] of Object.entries(e.traffic ?? {})) traffic[k as "ivrs" | "mobile"] = Math.max(0, traffic[k as "ivrs" | "mobile"] + d);
  const meters = { ...s.meters };
  // Availability tops out at 99.9%: nothing in an incident is ever 100%.
  for (const [k, d] of Object.entries(e.meters ?? {})) meters[k as MeterKey] = round1(clamp(meters[k as MeterKey] + d, 0, k === "availability" ? 99.9 : 100));
  // Locked (protected) functions can't be pushed to degraded or down.
  const functions = { ...s.functions };
  const paused = [...s.paused];
  for (const [k, v] of Object.entries(e.functions ?? {})) {
    const key = k as FunctionKey;
    if (s.locked.includes(key) && (v === "degraded" || v === "down")) continue;
    functions[key] = v;
    if (v === "shed" && !paused.includes(key)) paused.push(key);
  }
  return {
    ...s,
    health,
    traffic,
    meters,
    functions,
    paused,
    stakeholders: { ...s.stakeholders, ...e.stakeholders },
    lowestAvailability: Math.min(s.lowestAvailability, meters.availability),
  };
}

/**
 * Saturation: past 98% API load emergency starts failing; at 100% booking goes
 * down and availability falls. Once load drops back under 95%, a downed booking
 * service comes back up, degraded (fixing it properly still takes a decision).
 */
function applySaturation(s: CrisisState): CrisisState {
  if (s.health.api < 95 && s.functions.booking === "down") {
    return {
      ...s,
      functions: { ...s.functions, booking: "degraded" },
      log: [...s.log, { at: s.seconds, text: "Load eased: booking is back up, degraded.", tone: "warning" }],
    };
  }
  if (s.health.api < 98) return s;
  let next = s;
  const log: LogEntry[] = [];
  if (next.functions.emergency === "stable" && !next.locked.includes("emergency")) {
    next = { ...next, functions: { ...next.functions, emergency: "degraded" } };
    log.push({ at: s.seconds, text: "API tier saturated: emergency requests are failing.", tone: "critical" });
  }
  if (next.health.api >= 100 && next.functions.booking !== "down" && !next.locked.includes("booking")) {
    next = { ...next, functions: { ...next.functions, booking: "down" } };
    log.push({ at: s.seconds, text: "Booking is down.", tone: "critical" });
  }
  next = applyEffect(next, { meters: { availability: -0.3, customerImpact: 1 } });
  return log.length ? { ...next, log: [...next.log, ...log] } : next;
}

export function reducer(s: CrisisState, a: Action): CrisisState {
  switch (a.type) {
    case "enter":
    case "reset":
      // "No rush" is a visitor preference, so it survives restarts.
      return { ...INITIAL_STATE, phase: "war-room", run: s.run + 1, noRush: s.noRush };

    case "setNoRush":
      return { ...s, noRush: a.noRush };

    case "tick": {
      if (s.phase !== "war-room") return s;
      let next: CrisisState = { ...s, seconds: s.seconds + 1 };

      // A new round arrives when the gap has passed; the debrief after the last one.
      if (next.pendingSince === null && next.seconds >= next.nextAt) {
        if (next.decisionIndex < DECISIONS.length) {
          const round = DECISIONS[next.decisionIndex];
          const blocked = round.requires === "stable" && anyCritical(next);
          if (blocked && next.seconds - next.nextAt >= RECOVERY_WAIT_MAX) {
            // Never a hard lockout: if the platform never stabilises, close the incident without recovery.
            return {
              ...next,
              phase: "debrief",
              log: [...next.log, { at: next.seconds, text: "The platform never stabilised, so there was no recovery round.", tone: "critical" }],
            };
          }
          if (!blocked) {
            next = {
              ...next,
              pendingSince: next.seconds,
              roundElapsed: next.carryPenalty,
              carryPenalty: 0,
              draft: {},
              log: [...next.log, { at: next.seconds, text: `Round ${next.decisionIndex + 1}: ${round.title}`, tone: "info" }],
            };
            // An event lands on the dashboard as it arrives: mobile traffic +18%, and the load with it.
            if (round.kind === "event") {
              const from = next.traffic.mobile;
              const to = Math.round(from * (1 + MOBILE_SURGE));
              next = applyEffect(
                { ...next, signal: { from, to } },
                { traffic: { mobile: to - from }, health: { api: 6, cpu: 4 }, meters: { customerImpact: 3 } }
              );
            }
          }
        } else {
          return { ...next, phase: "debrief" };
        }
      }

      // Stakeholder interruptions fire on schedule and queue behind any card still showing.
      while (next.interruptionsFired < INTERRUPTIONS.length && next.seconds >= INTERRUPTIONS[next.interruptionsFired].at) {
        const i = INTERRUPTIONS[next.interruptionsFired];
        next = {
          ...next,
          interruptionsFired: next.interruptionsFired + 1,
          interruptions: [...next.interruptions, { who: i.who, message: i.message }],
          log: [...next.log, { at: next.seconds, text: `${STAKEHOLDER_LABELS[i.who]}: “${i.message}”`, tone: "info" }],
        };
      }

      // Round countdown (stopped in "No rush"). At zero: auto-advance with whatever is selected.
      if (next.pendingSince !== null && !next.noRush && next.pendingSince < next.seconds) {
        next = { ...next, roundElapsed: next.roundElapsed + 1 };
        if (next.roundElapsed >= ROUND_TIME_SECONDS) return autoResolve(next);
      }
      return applySaturation(next);
    }

    case "draft": {
      if (s.phase !== "war-room" || s.pendingSince === null) return s;
      return { ...s, draft: a.draft };
    }

    case "choose": {
      if (s.phase !== "war-room" || s.pendingSince === null) return s;
      const decision = DECISIONS[s.decisionIndex];
      if (decision.kind === "event") return s;
      const option = decision.options.find((o) => o.id === a.optionId);
      if (!option) return s;
      return resolveRound(s, { label: option.label, changes: option.changes, tone: option.tone, log: option.log, effect: option.effect });
    }

    case "dismiss": {
      // Acknowledge and Respond both dismiss for now; the stakeholder counts as engaged once heard.
      const [first, ...rest] = s.interruptions;
      if (!first) return s;
      const stakeholders =
        s.stakeholders[first.who] === "inactive" ? { ...s.stakeholders, [first.who]: "engaged" as const } : s.stakeholders;
      return { ...s, interruptions: rest, stakeholders };
    }

    case "respondComms": {
      // Only while Leadership's card is the one showing, and only once.
      const option = COMMS.options.find((o) => o.id === a.optionId);
      if (!option || s.interruptions[0]?.kind !== "comms" || s.commsChoice) return s;
      const time = `T+${formatClock(s.seconds)}`;
      return {
        ...s,
        commsChoice: option.id,
        stakeholders: { ...s.stakeholders, leadership: option.leadership },
        log: [...s.log, { at: s.seconds, text: `Told leadership: “${option.text}”`, tone: "info" }],
        decisionLog: [...s.decisionLog, { time, description: `Told leadership why loyalty stopped: “${option.text}”` }],
      };
    }

    case "requestData": {
      if (s.phase !== "war-room" || s.revealed.includes(a.signal)) return s;
      // Costs time: off the current round's countdown, or the next round's if none is open.
      const pending = s.pendingSince !== null;
      const next: CrisisState = {
        ...s,
        revealed: [...s.revealed, a.signal],
        roundElapsed: pending ? s.roundElapsed + DATA_REQUEST_SECONDS : s.roundElapsed,
        carryPenalty: pending ? s.carryPenalty : s.carryPenalty + DATA_REQUEST_SECONDS,
        log: [...s.log, { at: s.seconds, text: `Requested data: ${UNKNOWN_LABELS[a.signal]} (+${DATA_REQUEST_SECONDS}s).`, tone: "info" }],
      };
      return pending && !s.noRush && next.roundElapsed >= ROUND_TIME_SECONDS ? autoResolve(next) : next;
    }

    case "ask": {
      const q = QUESTIONS.find((x) => x.id === a.question);
      if (s.phase !== "war-room" || !q || s.asked.includes(q.id) || s.asked.length >= QUESTION_SLOTS) return s;
      return {
        ...s,
        asked: [...s.asked, q.id],
        revealed: s.revealed.includes(q.reveals) ? s.revealed : [...s.revealed, q.reveals],
        stakeholders: s.stakeholders.engineering === "inactive" ? { ...s.stakeholders, engineering: "engaged" } : s.stakeholders,
        log: [...s.log, { at: s.seconds, text: `Asked Engineering: ${q.question}`, tone: "info" }],
      };
    }

    case "act": {
      if (s.phase !== "war-room" || s.pendingSince === null) return s;
      if (DECISIONS[s.decisionIndex].kind !== "event") return s;
      return applyDeck(s, a.action, a.target);
    }
  }
}

/**
 * A customer function in critical status (down), or a core function (booking,
 * emergency) that's paused: recovery says "core services are operational", so
 * both have to be true before it can start.
 */
export function anyCritical(s: CrisisState) {
  const down = (Object.values(s.functions) as FunctionState[]).some((f) => FUNCTION_DISPLAY[f].status === "critical");
  return down || s.functions.booking === "shed" || s.functions.emergency === "shed";
}

/** Round timer: seconds left on the current round. */
export function timeLeft(s: CrisisState) {
  return Math.max(0, ROUND_TIME_SECONDS - s.roundElapsed);
}

function applyDeck(s: CrisisState, actionKey: DeckAction, target: DeckTarget, note = "") {
  const impact = DECK_IMPACT[actionKey][target];
  const action = DECK_ACTIONS.find((d) => d.key === actionKey)!;
  const locked = impact.lock && !s.locked.includes(impact.lock) ? [...s.locked, impact.lock] : s.locked;
  // Lock first, so the action's own effect is applied with the protection in place.
  return resolveRound(
    { ...s, locked },
    {
      label: `${action.label} → ${targetLabel(target)}`,
      changes: impact.changes,
      tone: impact.level === "Low" ? "stable" : impact.level === "Medium" ? "warning" : "critical",
      log: impact.log + note,
      effect: impact.effect,
    }
  );
}

const TIMED_OUT = " (applied when time ran out)";

/**
 * Time ran out: apply whatever the player had selected. A full selection is
 * applied as chosen; with nothing (or only an action) selected, no decision is
 * made, which on the live incident means the load keeps building.
 */
function autoResolve(s: CrisisState): CrisisState {
  const round = DECISIONS[s.decisionIndex];
  const { optionId, action, target } = s.draft;
  if (round.kind === "event" && action && target) return applyDeck(s, action, target, TIMED_OUT);
  const option = round.kind !== "event" && optionId ? round.options.find((o) => o.id === optionId) : undefined;
  if (option) {
    return resolveRound(s, { label: option.label, changes: option.changes, tone: option.tone, log: option.log + TIMED_OUT, effect: option.effect });
  }
  const recovery = round.requires === "stable";
  return resolveRound(s, {
    label: "No decision: time ran out",
    changes: recovery ? ["Nothing restored yet"] : ["No action taken", "Load kept building"],
    tone: "warning",
    log: `Time ran out on Round ${s.decisionIndex + 1}: no decision made.`,
    effect: recovery ? {} : { health: { api: 4, cpu: 3 }, meters: { availability: -0.6, customerImpact: 4 } },
  });
}

/** Applies a round's decision: dashboard effects, logs, the reveal, and scheduling the next round. */
function resolveRound(
  s: CrisisState,
  d: { label: string; changes: string[]; tone: "stable" | "warning" | "critical"; log: string; effect: Effect }
): CrisisState {
  const decision = DECISIONS[s.decisionIndex];
  const next = applyEffect(s, d.effect);
  const upcoming = DECISIONS[s.decisionIndex + 1];
  const resolved = applySaturation({
    ...next,
    lastApplied: { label: d.label, changes: d.changes, tone: d.tone, before: s.health, after: next.health },
    decisionIndex: s.decisionIndex + 1,
    pendingSince: null,
    roundElapsed: 0,
    draft: {},
    nextAt: s.seconds + (upcoming?.arrivesAfter ?? DECISION_GAP),
    choices: [...s.choices, { decisionId: decision.id, label: d.label }],
    log: [...next.log, { at: s.seconds, text: d.log, tone: d.tone }],
    decisionLog: [...s.decisionLog, { time: `T+${formatClock(s.seconds)}`, description: d.log }],
  });

  // After Round 2 (the event round), Leadership asks about the loyalty pause, once, if loyalty was paused.
  if (decision.kind === "event" && !resolved.commsTriggered && resolved.paused.includes("loyalty")) {
    return {
      ...resolved,
      commsTriggered: true,
      interruptions: [...resolved.interruptions, { who: "leadership", message: COMMS.question, kind: "comms" }],
      log: [...resolved.log, { at: s.seconds, text: `Leadership: “${COMMS.question}”`, tone: "info" }],
    };
  }
  return resolved;
}

// --- Labels and thresholds ---------------------------------------------------------

export const HEALTH_LABELS: Record<HealthKey, string> = { cpu: "CPU", api: "API", db: "DB" };

export const FUNCTION_LABELS: Record<FunctionKey, string> = {
  emergency: "Emergency",
  booking: "Booking",
  loyalty: "Loyalty",
  analytics: "Analytics",
};

/** Shed is a deliberate choice, so it's shown neutrally rather than as a failure. */
export const FUNCTION_DISPLAY: Record<FunctionState, { status: Status; text: string }> = {
  stable: { status: "stable", text: "Stable" },
  degraded: { status: "warning", text: "Degraded" },
  down: { status: "critical", text: "Down" },
  shed: { status: "inactive", text: "Paused" },
};

export const STAKEHOLDER_LABELS: Record<StakeholderKey, string> = {
  operations: "Operations",
  engineering: "Engineering",
  leadership: "Leadership",
  marketing: "Marketing",
};

export const STAKEHOLDER_DISPLAY: Record<StakeholderState, { status: Status; text: string }> = {
  inactive: { status: "inactive", text: "Standing by" },
  engaged: { status: "info", text: "Engaged" },
  concerned: { status: "warning", text: "Concerned" },
};

export const NORTH_STAR = ["Emergency booking", "Core booking", "Platform availability"];

/** System health thresholds: under 75% stable, 75–90% warning, above 90% critical. */
export function healthStatus(pct: number): Status {
  if (pct > 90) return "critical";
  if (pct >= 75) return "warning";
  return "stable";
}

/** Mission meters: each has a direction (is higher better?) and its own thresholds. */
export const METERS: Record<MeterKey, { label: string; higherIsBetter: boolean; status: (v: number) => Status }> = {
  availability: {
    label: "Availability",
    higherIsBetter: true,
    status: (v) => (v >= 99.5 ? "stable" : v >= 97 ? "warning" : "critical"),
  },
  customerImpact: {
    label: "Customer impact",
    higherIsBetter: false,
    status: (v) => (v < 20 ? "stable" : v < 50 ? "warning" : "critical"),
  },
  featureDelivery: {
    label: "Feature delivery",
    higherIsBetter: true,
    status: (v) => (v >= 80 ? "stable" : v >= 50 ? "warning" : "critical"),
  },
  cost: {
    label: "Cost",
    higherIsBetter: false,
    status: (v) => (v < 50 ? "stable" : v < 80 ? "warning" : "critical"),
  },
};

/** Incident severity for the header pill. */
export function severity(s: CrisisState): "critical" | "stabilising" | "resolved" {
  if (s.phase === "debrief") return "resolved";
  const criticalOk = s.functions.emergency === "stable" && s.functions.booking === "stable";
  return criticalOk && s.health.api <= 90 ? "stabilising" : "critical";
}

const CORE: FunctionKey[] = ["booking", "emergency"];
const NON_CRITICAL: FunctionKey[] = ["loyalty", "analytics"];

/**
 * Compares the player's path with the documented one, without grading it.
 * The real side is read from the work record's own words (decision titles and
 * approach for what was protected; the decision's choice for what was
 * deprioritised), so nothing about the real incident is restated here.
 *
 * - Player protected: core functions still stable at the end, plus anything locked.
 * - Player deprioritised: every function paused at any point in the run.
 */
export function comparePaths(s: CrisisState, real: { protectText: string; deprioritiseText: string }) {
  const protectText = real.protectText.toLowerCase();
  const realProtected = CORE.filter((k) => protectText.includes(FUNCTION_LABELS[k].toLowerCase()));
  const realDeprioritisesNonCritical = /non-critical|non-essential/i.test(real.deprioritiseText);

  const playerProtected = Array.from(new Set<FunctionKey>([...CORE.filter((k) => s.functions[k] === "stable"), ...s.locked]));
  const playerDeprioritised = s.paused;

  const protectsSame = realProtected.length > 0 && realProtected.every((k) => playerProtected.includes(k));
  const deprioritisesSame =
    realDeprioritisesNonCritical &&
    playerDeprioritised.some((k) => NON_CRITICAL.includes(k)) &&
    !playerDeprioritised.some((k) => CORE.includes(k));

  const overlap: "overlaps" | "partial" | "different" = protectsSame && deprioritisesSame ? "overlaps" : protectsSame || deprioritisesSame ? "partial" : "different";
  const line = {
    overlaps: "Your decision path overlaps with the documented approach in the real incident.",
    partial: "Your decision path partly overlaps with the documented approach in the real incident.",
    different: "Your decision path took a different route from the documented approach in the real incident.",
  }[overlap];

  return {
    playerProtected: playerProtected.map((k) => FUNCTION_LABELS[k]),
    playerDeprioritised: playerDeprioritised.map((k) => FUNCTION_LABELS[k]),
    overlap,
    line,
  };
}

export function formatClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

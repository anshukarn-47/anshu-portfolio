/**
 * Prototype Lab registry: interactive prototypes built into the site.
 *
 * Each entry is plain data (safe to import on the server or the client). The
 * interactive canvas for a slug lives in components/prototypes/canvases.tsx, and
 * the "Case study" mode reads the related work entry from the database by
 * relatedWorkSlug.
 */

export type PrototypeCategory = "Think" | "Build" | "Analyze" | "Build with AI";

export type PmLens = {
  /** Who the prototype is for. */
  user: string;
  /** What they're struggling with. */
  problem: string;
  /** What in the product tells you it's working (or not). */
  signal: string;
  /** The key product decision the prototype explores. */
  decision: string;
};

export type Measures = {
  primary: string;
  guardrail: string;
  leadingIndicator: string;
  failureMode: string;
};

export type Tradeoff = { a: string; b: string; choice: string; why: string };

export type PrototypeEntry = {
  slug: string;
  title: string;
  category: PrototypeCategory;
  /** One-line description for cards and the header. */
  hook: string;
  pmLens: PmLens;
  whatIWouldMeasure: Measures;
  tradeoffs: Tradeoff[];
  /** Slug of the work case study this prototype is based on (Case study mode). */
  relatedWorkSlug: string | null;
  /**
   * The prototype ends with its own real-world reveal, so Case study mode and the
   * Product lens trade-offs stay locked until the player reaches the end.
   */
  revealAfterPlay?: boolean;
};

export const PROTOTYPES: PrototypeEntry[] = [
  {
    slug: "crisis-simulator",
    title: "Crisis simulator",
    category: "Think",
    hook: "Run the war room through a sudden 4–5x demand surge and decide what to protect.",
    pmLens: {
      user: "The product owner on call when traffic spikes with no warning, with engineering, operations and leadership all waiting on a call.",
      problem:
        "Every system is under load at once and there isn't capacity to keep everything running, so something has to give, and it has to be decided in minutes.",
      signal: "Whether critical customer functions (emergency and core booking) stay available while load keeps climbing.",
      decision: "Which features to shed, in what order, and how to explain those trade-offs to each stakeholder.",
    },
    whatIWouldMeasure: {
      primary: "Success rate of critical journeys: emergency and core booking completions per minute.",
      guardrail: "Platform availability stays up; no full outage, even if non-critical features are switched off.",
      leadingIndicator: "API latency and error rate on the critical endpoints, before customers notice.",
      failureMode: "Shedding features too late, so the whole platform degrades instead of just the non-critical parts.",
    },
    tradeoffs: [
      {
        a: "Keep every feature running",
        b: "Shed non-critical features",
        choice: "Shed non-critical features",
        why: "Capacity can't scale 4–5x in minutes; turning off loyalty and analytics frees headroom for booking and emergency.",
      },
      {
        a: "Wait for the root cause",
        b: "Act on the signals now",
        choice: "Act on the signals now",
        why: "The cause is external and already known; the load is the problem. Waiting for certainty risks availability.",
      },
      {
        a: "Protect roadmap delivery",
        b: "Pause feature work",
        choice: "Pause feature work",
        why: "Engineering attention goes to stability until load normalises; delivery dates move and are communicated.",
      },
    ],
    relatedWorkSlug: "demand-surge-zero-outage",
    revealAfterPlay: true,
  },
  {
    slug: "control-tower-24",
    title: "TOWER // 24",
    category: "Analyze",
    hook: "Operate the network. Protect the customer. Optimize the system.",
    pmLens: {
      user: "The control-tower operator running a day of dispatch across depots, trucks and customers, with more demand than slack.",
      problem:
        "Trucks, depots and delivery windows are finite, and exceptions (delays, breakdowns, stock-outs) keep arriving, so every fix competes with the rest of the network.",
      signal: "SLA attainment on high-priority deliveries, alongside cost per delivery and overall network health.",
      decision: "Which shipments to prioritise, consolidate or reroute when an exception hits, and what that costs everywhere else.",
    },
    whatIWouldMeasure: {
      primary: "On-time delivery rate for high-priority customers.",
      guardrail: "Logistics cost per delivery stays within the day's budget.",
      leadingIndicator: "Unresolved exceptions and at-risk routes, before they turn into missed windows.",
      failureMode: "Firefighting every exception equally, so the network runs out of trucks for the deliveries that matter most.",
    },
    tradeoffs: [
      {
        a: "Dispatch each order as it's ready",
        b: "Consolidate orders onto shared loads",
        choice: "Consolidate orders onto shared loads",
        why: "Fuller trucks cut cost and free fleet for urgent runs, at the price of a little waiting time for low-priority orders.",
      },
      {
        a: "Reroute around a disruption",
        b: "Hold and wait for it to clear",
        choice: "Reroute around a disruption",
        why: "For high-priority deliveries, a longer route that arrives beats a short one that might not.",
      },
      {
        a: "Treat every customer the same",
        b: "Protect high-priority deliveries first",
        choice: "Protect high-priority deliveries first",
        why: "When capacity is short, the SLA that matters most gets the trucks first; the rest are re-promised early.",
      },
    ],
    relatedWorkSlug: "petroleum-logistics",
    revealAfterPlay: true,
  },
  {
    slug: "resolve-x",
    title: "RESOLVE//X",
    category: "Think",
    hook: "One issue. Multiple systems. One resolution.",
    pmLens: {
      user: "Service desk agents working the queues, and the customers waiting on the other side of each incident.",
      problem: "Triage is slow and inconsistent, so incidents wait in the wrong queue, and the same incidents keep coming back.",
      signal: "Repeat incidents and SLA risk: a recurring failure shows up as similar incidents piling up and countdowns running short.",
      decision: "When to link similar incidents to one problem, how to route each one, and which repeatable triage to automate.",
    },
    whatIWouldMeasure: {
      primary: "SLA compliance.",
      guardrail: "Customer satisfaction (CSAT).",
      leadingIndicator: "Repeat-incident count.",
      failureMode: "Noisy auto-created problem records: automation that opens more records than it resolves.",
    },
    tradeoffs: [
      {
        a: "Speed of resolution",
        b: "Thoroughness of root-cause work",
        choice: "Speed of resolution",
        why: "Restore service first with a workaround, so customers can carry on now, but link the incidents to a problem record so the root-cause work isn't lost once the queue is quiet.",
      },
      {
        a: "Automation coverage",
        b: "Avoiding noisy records",
        choice: "Avoiding noisy records",
        why: "Automate narrowly, on a specific failure pattern. A rule that fires on small or loosely grouped clusters creates records and alerts that someone has to review, which costs more triage time than it saves.",
      },
      {
        a: "Detail for the customer",
        b: "Technical accuracy",
        choice: "Detail for the customer",
        why: "Plain language about what is known, what to do now and when the next update comes. Precise technical detail belongs on the incident and the problem record.",
      },
    ],
    // The shift ends with its own real-world reveal ("What I actually did"), so the case study waits until then.
    revealAfterPlay: true,
    // Case study mode shows the real ServiceNow POC write-up; the canvas itself stays fictional.
    relatedWorkSlug: "servicenow-service-management",
  },
];

export function getPrototypeEntry(slug: string): PrototypeEntry | null {
  return PROTOTYPES.find((p) => p.slug === slug) ?? null;
}

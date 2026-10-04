/**
 * The arcade: short games (60–120 seconds) that each turn one product decision
 * into something to play. Data-driven, and deliberately separate from the
 * Prototype lab registry (lib/prototypes/registry.ts), which holds the longer
 * decision simulations.
 */

export type ArcadeStatus = "published" | "soon";

export type ArcadeEntry = {
  slug: string;
  title: string;
  /** One line for the card. */
  hook: string;
  /** How it plays, in a few words. */
  mechanic: string;
  duration: string;
  /** The work record the Real-world case section is pulled from. */
  relatedWorkSlug: string | null;
  /** Further work records shown in the Real-world case, after the main one. */
  moreWorkSlugs?: string[];
  /** A Prototype lab simulation on the same theme, only when one genuinely exists. */
  relatedSimulation: string | null;
  status: ArcadeStatus;
};

export const ARCADE_DURATION = "60–120 seconds";

export const ARCADE: ArcadeEntry[] = [
  {
    slug: "capacity-fit",
    title: "Capacity fit",
    hook: "Four sprints, six units each: features, bugs, compliance and technical debt all compete for the space.",
    mechanic: "Position and drop work items into sprint rows",
    duration: ARCADE_DURATION,
    relatedWorkSlug: "crm-mobile-platforms",
    relatedSimulation: null,
    status: "published",
  },
  {
    slug: "automation-bundles",
    title: "Automation bundles",
    hook: "Twelve processes, four choices: automate, bundle, redesign or leave manual. Only net hours count.",
    mechanic: "Sort process cards into zones",
    duration: ARCADE_DURATION,
    relatedWorkSlug: "rpa-automation",
    relatedSimulation: null,
    status: "published",
  },
  {
    slug: "sprint-slice",
    title: "Sprint slice",
    hook: "Backlog items drift past a 20-point sprint. Pick what earns its place; scope creep costs.",
    mechanic: "Swipe, tap or key in backlog items as they pass",
    duration: ARCADE_DURATION,
    relatedWorkSlug: "crm-mobile-platforms",
    relatedSimulation: null,
    status: "published",
  },
  {
    slug: "neural-maze",
    title: "Neural Maze",
    hook: "Collect current sources, avoid unsupported claims, answer from evidence.",
    mechanic: "Retrieval maze",
    duration: ARCADE_DURATION,
    // The requested rag-crm-assistant record doesn't exist; these two are the closest published records.
    relatedWorkSlug: "genai-knowledge-platform",
    moreWorkSlugs: ["rag-llm-chatbot"],
    relatedSimulation: null,
    status: "published",
  },
  {
    slug: "stack-link",
    title: "Stack link",
    hook: "Map fields through four stages, CRM to service platform, without letting bad data through.",
    mechanic: "Place field, validation and connector cards in stage lanes",
    duration: ARCADE_DURATION,
    relatedWorkSlug: "sap-crm-billing",
    relatedSimulation: null,
    status: "published",
  },
  {
    slug: "release-run",
    title: "Release run",
    hook: "Steer a release to the production gate, and match the rollout to the risk you pick up on the way.",
    mechanic: "Change lanes, pick up tests, choose the rollout at each fork",
    duration: ARCADE_DURATION,
    relatedWorkSlug: "flutter-migration",
    relatedSimulation: null,
    status: "published",
  },
];

export const getArcadeEntry = (slug: string) => ARCADE.find((g) => g.slug === slug);
export const PUBLISHED_GAMES = ARCADE.filter((g) => g.status === "published");

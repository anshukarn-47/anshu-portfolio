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
  /** A short plain-language description: how it plays, what it shows, what the score rewards. Used by the AI index. */
  about: string;
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
    about:
      "Plan four sprints of six capacity units each. Work items arrive one at a time as bars one to four units wide: features with a value and a risk, bugs, compliance items with a deadline sprint, and technical debt that adds no value now but keeps technical health up. Place each item, defer it to carryover, or ship a sprint early. Mid-game a three-unit critical defect arrives and pushes planned work into carryover. The score rewards priority-weighted value, compliance shipped on time and technical health; filling rows alone earns little. All data is fictional and results are simulated.",
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
    about:
      "Sort twelve fictional business processes into four zones: automate now, bundle with others, redesign first, or leave manual. Each card shows the system, monthly volume, whether it is stable and rule-based, and its exception rate. Processes on the same system can be bundled to share the build; automating an unstable process creates exceptions that cut the hours saved; leaving a busy, stable, rule-based process manual wastes hours. The score is net simulated hours saved, not how much gets automated.",
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
    about:
      "Backlog items drift past a 20-point sprint, each with a value, an effort and a risk: features, critical bugs that add stability, technical debt that keeps health up, and low-value nice-to-haves. Include items by swiping, tapping or with the keyboard, then commit the sprint. Going over capacity is scope creep and costs points, so including everything scores badly, and so does including nothing. The score rewards risk-adjusted value per capacity point, stability and health.",
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
    about:
      "A retrieval maze. Answer one fictional customer question by moving a query cursor through an 11 by 9 grid of source documents under fog of war. Sources are current, outdated, conflicting or irrelevant, revealed on visit. Collect evidence into a five-slot context window, keep the grounding meter up, and avoid unsupported claims that patrol and chase. Semantic search and Verify help twice each. The answer is composed from the collected sources and rated grounded, partly supported or unsupported. The score rewards answer quality, evidence relevance and use of the context window, not collecting more or moving faster.",
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
    about:
      "Map three fictional fields through four integration stages: CRM, middleware, ERP and a proposed service platform. Field, validation and connector cards fall into the lanes. Each placement asks for the matching target field by meaning and type; a match lights the connection between stages. A stage can only connect once the stage before it is mapped, and broken data needs a validation card first. The score rewards integration coverage, data quality and completed chains, minus simulated exceptions.",
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
    about:
      "Steer a release down three lanes to a production gate. Tests give a shield against regressions, stakeholder alignment gives a short boost, and technical debt, scope creep and regressions add risk. Twice on the way, choose a fast release or a controlled rollout. At the gate, accumulated risk decides the outcome: a smooth release, a release with a minor incident, or a rollback. The score rewards matching the rollout to the risk at each fork, not speed.",
    duration: ARCADE_DURATION,
    relatedWorkSlug: "flutter-migration",
    relatedSimulation: null,
    status: "published",
  },
];

export const getArcadeEntry = (slug: string) => ARCADE.find((g) => g.slug === slug);
export const PUBLISHED_GAMES = ARCADE.filter((g) => g.status === "published");

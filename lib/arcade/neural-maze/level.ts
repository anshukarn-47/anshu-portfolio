/**
 * Neural Maze: the fixed level. An 11×9 grid, twelve fictional sources, the
 * answer core and the unsupported claims' patrol loops. Same layout every run.
 * See docs/arcade-game-rules.md.
 */

export const COLS = 11;
export const ROWS = 9;
export const QUESTION = "How do I reset a stuck approval workflow?";
/** The fictional product the sources belong to. */
export const PRODUCT = "Flowdesk";

/**
 * The map, row by row: # wall, . floor, S start, A answer core, and one
 * character per source (see SOURCES). Every open cell is reachable from S.
 */
export const MAP = [
  "S.....#1#b#",
  ".#6##.#.#.#",
  ".#.#9.....2",
  "...######.#",
  "##........A",
  "7#.##3##d##",
  "...#...#..5",
  "##.#4#.#.#.",
  "a....#8....",
] as const;

export type Kind = "current" | "outdated" | "conflicting" | "irrelevant";
export const KIND_LABEL: Record<Kind, string> = {
  current: "Current, relevant",
  outdated: "Outdated",
  conflicting: "Conflicting",
  irrelevant: "Irrelevant",
};
/** One-letter marks drawn inside each shape, so a type never depends on colour (or shape) alone. */
export const KIND_MARK: Record<Kind, string> = { current: "C", outdated: "O", conflicting: "X", irrelevant: "I" };

export type Source = {
  id: string;
  kind: Kind;
  title: string;
  source: string;
  /** Freshness date (fictional). */
  date: string;
  excerpt: string;
  /** The sentence it contributes to the answer. */
  claim: string;
  /** Current sources: the point it covers, for "what's missing". */
  topic?: string;
  /** Current sources: what a stale copy says instead. */
  staleClaim?: string;
  /** Conflicting sources: the current source they contradict. */
  contradicts?: string;
};

/** The twelve sources, keyed by their character in MAP: five current, three outdated, two irrelevant, two conflicting. All fictional. */
export const SOURCES: Record<string, Source> = {
  "1": {
    id: "S1",
    kind: "current",
    title: "Restart a stuck approval step",
    source: "Help centre",
    date: "2026-08-12",
    excerpt: "Open the approval and choose More, then Restart step. Approvers on that step are notified again.",
    claim: "Open the stuck approval and choose More, then Restart step; its approvers are notified again.",
    topic: "how to restart the stuck step",
    staleClaim: "Go to Settings and press Reset all approvals.",
  },
  "2": {
    id: "S2",
    kind: "current",
    title: "Approval timeouts and escalation",
    source: "Admin guide",
    date: "2026-07-30",
    excerpt: "A step that waits longer than its timeout escalates to the backup approver set on the workflow.",
    claim: "If an approver is away, the step escalates to the backup approver once its timeout passes.",
    topic: "what happens when an approver is away",
    staleClaim: "Steps never escalate; they wait until the original approver acts.",
  },
  "3": {
    id: "S3",
    kind: "current",
    title: "Who can restart a workflow step",
    source: "Admin guide",
    date: "2026-06-18",
    excerpt: "Only the workflow owner and admins can restart a step. Others can request a restart.",
    claim: "Only the workflow owner or an admin can restart a step; anyone else can request one.",
    topic: "who is allowed to restart it",
    staleClaim: "Any user with view access can restart a step.",
  },
  "4": {
    id: "S4",
    kind: "current",
    title: "Restart or cancel?",
    source: "Help centre",
    date: "2026-09-02",
    excerpt: "Restarting keeps the request and its history. Cancelling closes the request for good.",
    claim: "Restarting keeps the request and its history; cancelling closes it for good.",
    topic: "the difference between restarting and cancelling",
    staleClaim: "Restarting deletes the request's history.",
  },
  "5": {
    id: "S5",
    kind: "current",
    title: "Reading the run log",
    source: "Support playbook",
    date: "2026-08-27",
    excerpt: "The run log shows which step is waiting, who it's waiting on, and since when.",
    claim: "The run log shows which step is stuck and who it's waiting on.",
    topic: "how to find which step is stuck",
    staleClaim: "There's no way to see which step is stuck.",
  },
  "6": {
    id: "S6",
    kind: "outdated",
    title: "Resetting approvals in the classic editor",
    source: "Help centre archive",
    date: "2023-02-10",
    excerpt: "In the classic editor, go to Settings, Classic approvals, and press Reset all.",
    claim: "Go to Settings, open Classic approvals and press Reset all.",
  },
  "7": {
    id: "S7",
    kind: "outdated",
    title: "Approval timeout settings (v2)",
    source: "Release notes",
    date: "2022-11-04",
    excerpt: "In version 2, approval timeouts can only be changed by the support team.",
    claim: "Only the support team can change approval timeouts.",
  },
  "8": {
    id: "S8",
    kind: "outdated",
    title: "Restart by export and re-import",
    source: "Team wiki",
    date: "2023-05-19",
    excerpt: "Export the workflow as a file, delete it, then import it again to clear stuck steps.",
    claim: "Export the workflow and import it again to clear the stuck step.",
  },
  "9": {
    id: "S9",
    kind: "irrelevant",
    title: "Invoice numbering formats",
    source: "Help centre",
    date: "2026-05-11",
    excerpt: "Invoice numbers can start with a custom prefix and a running number.",
    claim: "Invoice numbers can start with a custom prefix.",
  },
  a: {
    id: "S10",
    kind: "irrelevant",
    title: "Dashboard colour themes",
    source: "Community forum",
    date: "2026-04-02",
    excerpt: "Dashboards can switch between light and dark themes from the profile menu.",
    claim: "Dashboards support light and dark themes.",
  },
  b: {
    id: "S11",
    kind: "conflicting",
    title: "Approvals can't be restarted",
    source: "Community forum",
    date: "2026-07-14",
    excerpt: "From experience, stuck approvals never restart. Delete the request and raise it again.",
    claim: "Stuck approvals can't be restarted, so delete the request and raise it again.",
    contradicts: "S1",
  },
  d: {
    id: "S12",
    kind: "conflicting",
    title: "Anyone can restart a step",
    source: "Team wiki",
    date: "2026-06-30",
    excerpt: "Any team member can restart a stuck step; no special role is needed.",
    claim: "Any team member can restart a stuck step.",
    contradicts: "S3",
  },
};

/** The points a complete answer needs: how to restart, what happens when an approver is away, and who can do it. */
export const KEY_SOURCES = ["S1", "S2", "S3"];

export type Cell = { x: number; y: number };
export type PlacedSource = Source & Cell;

function parse() {
  const walls = new Set<string>();
  const sources: PlacedSource[] = [];
  let start: Cell = { x: 0, y: 0 };
  let core: Cell = { x: 0, y: 0 };
  MAP.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "#") walls.add(`${x},${y}`);
      else if (ch === "S") start = { x, y };
      else if (ch === "A") core = { x, y };
      else if (SOURCES[ch]) sources.push({ ...SOURCES[ch], x, y });
    })
  );
  return { walls, sources, start, core };
}

export const LEVEL = parse();
export const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= COLS || y >= ROWS || LEVEL.walls.has(`${x},${y}`);
export const sourceById = (id: string) => LEVEL.sources.find((s) => s.id === id)!;

/** Unsupported claims: each patrols a fixed loop of open cells. The third appears later. */
export const DRIFTS: { id: string; patrol: Cell[] }[] = [
  // Back and forth along the upper row, past the pockets holding S1, S2 and a conflicting source.
  { id: "D1", patrol: [5, 6, 7, 8, 9, 8, 7, 6].map((x) => ({ x, y: 2 })) },
  // A loop round the lower right, past S5.
  {
    id: "D2",
    patrol: [
      { x: 8, y: 6 },
      { x: 9, y: 6 },
      { x: 10, y: 6 },
      { x: 10, y: 7 },
      { x: 10, y: 8 },
      { x: 9, y: 8 },
      { x: 8, y: 8 },
      { x: 8, y: 7 },
    ],
  },
  // Appears later: back and forth along the approach to the answer core.
  { id: "D3", patrol: [3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4].map((x) => ({ x, y: 4 })) },
];

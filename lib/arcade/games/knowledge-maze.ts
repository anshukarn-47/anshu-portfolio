/**
 * Knowledge maze: find evidence for one customer question in a fogged 7×7 map
 * of documents, then pick the answer it supports. Fixed fictional data and a
 * pure reducer, so the same moves always give the same result.
 * See docs/arcade-game-rules.md.
 */

export const SIZE = 7;
export const QUESTION = "How do I reset a workflow?";
/** The fictional product the knowledge base belongs to. */
export const PRODUCT = "Flowdesk";
export const EVIDENCE_SLOTS = 3;
export const START = { x: 3, y: 6 };

export type Freshness = "current" | "outdated";
export type Relevance = "high" | "partial" | "none";
export type Doc = { id: string; title: string; source: string; freshness: Freshness; relevance: Relevance };

/** The documents that matter, by position. Everything else is filler (below). */
const PLACED: Record<string, Omit<Doc, "id">> = {
  "0,1": { title: "Reset a workflow to its draft state", source: "Help centre", freshness: "current", relevance: "high" },
  "5,1": { title: "Workflow version history and restore", source: "Admin guide", freshness: "current", relevance: "high" },
  "2,4": { title: "Resetting workflows in the classic editor", source: "Help centre archive", freshness: "outdated", relevance: "high" },
  "4,3": { title: "Workflow troubleshooting FAQ", source: "Community forum", freshness: "current", relevance: "partial" },
  "1,5": { title: "Reset from the old settings page", source: "Release notes", freshness: "outdated", relevance: "partial" },
  "3,2": { title: "Pausing and resuming workflow runs", source: "Help centre", freshness: "current", relevance: "partial" },
  "6,4": { title: "Workflow reset shortcut (beta)", source: "Team wiki", freshness: "outdated", relevance: "partial" },
};

const FILLER_TITLES = [
  "Invoice templates",
  "Team permissions",
  "Exporting reports",
  "Single sign-on setup",
  "Notification settings",
  "Billing and plans",
  "Custom fields",
  "Mobile app overview",
  "Data retention policy",
  "Keyboard shortcuts",
  "Inviting guests",
  "Dashboard widgets",
  "Calendar sync",
  "Tags and labels",
  "Audit log basics",
  "Language settings",
  "File attachments",
  "Approval chains",
  "Two-step sign-in",
  "Archiving projects",
  "Status page",
  "Holiday calendars",
];
const FILLER_SOURCES = ["Help centre", "Admin guide", "Community forum", "Team wiki", "Release notes"];

/** The 7×7 board, row by row. Fixed. */
export const BOARD: Doc[][] = Array.from({ length: SIZE }, (_, y) =>
  Array.from({ length: SIZE }, (_, x) => {
    const n = y * SIZE + x;
    const id = `KB-${String(n + 1).padStart(2, "0")}`;
    const placed = PLACED[`${x},${y}`];
    if (placed) return { id, ...placed };
    return {
      id,
      title: FILLER_TITLES[n % FILLER_TITLES.length],
      source: FILLER_SOURCES[(n * 3) % FILLER_SOURCES.length],
      freshness: n % 5 === 0 ? "outdated" : "current",
      relevance: "none",
    };
  })
);
export const docAt = (x: number, y: number) => BOARD[y][x];
export const docById = (id: string) => BOARD.flat().find((d) => d.id === id)!;

export const RELEVANCE_SCORE: Record<Relevance, number> = { high: 0.9, partial: 0.5, none: 0.1 };

/** Normal mode only: a search budget in moves. Outdated documents take longer to read, and collecting takes a move. */
export const BUDGET = { moves: 22, extraForOutdated: 2, collect: 1 } as const;
export const SEMANTIC_SEARCH = { uses: 2, radius: 2, top: 3 } as const;

export type Answer = { id: string; text: string; cites: string[] };
const at = (x: number, y: number) => docAt(x, y).id;
/** Three pre-written answers, in a fixed order. */
export const ANSWERS: Answer[] = [
  {
    id: "a",
    text: "Go to Settings, open Classic workflows and press Reset. The workflow starts again from scratch.",
    cites: [at(2, 4)],
  },
  {
    id: "b",
    text: "Open the workflow and choose Reset to draft. Runs in progress stop and your steps are kept. To go further back, restore an earlier version from Version history.",
    cites: [at(0, 1), at(5, 1)],
  },
  { id: "c", text: "There's no reset option, so delete the workflow and build it again.", cites: [] },
];
export type AnswerKind = "grounded" | "outdated" | "unsupported";
export function answerKind(a: Answer): AnswerKind {
  if (!a.cites.length) return "unsupported";
  return a.cites.every((id) => docById(id).freshness === "current" && docById(id).relevance === "high") ? "grounded" : "outdated";
}

export const POINTS = {
  relevantCurrent: 10,
  partialCurrent: 4,
  outdatedEvidence: -3,
  noOutdatedEvidence: 6,
  answer: { grounded: 15, outdated: 3, unsupported: 0 } as Record<AnswerKind, number>,
  /** The chosen answer's citations are all in your evidence. */
  backedByEvidence: 5,
} as const;

// --- State ----------------------------------------------------------------------------------------------

export type MazeState = {
  pos: { x: number; y: number };
  visited: string[];
  evidence: string[];
  movesUsed: number;
  searchesLeft: number;
  /** Ids highlighted by the last semantic search. */
  highlighted: string[];
  phase: "search" | "answer";
  note: string;
};

export const initialMaze = (): MazeState => ({
  pos: START,
  visited: [docAt(START.x, START.y).id],
  evidence: [],
  movesUsed: 0,
  searchesLeft: SEMANTIC_SEARCH.uses,
  highlighted: [],
  phase: "search",
  note: "",
});

export const RELEVANCE_LABEL: Record<Relevance, string> = { high: "Highly relevant", partial: "Partly relevant", none: "Not relevant" };

/** Seen: visited, or next to somewhere visited. Everything else is fog. */
export function seenSet(s: MazeState) {
  const seen = new Set<string>();
  for (const id of s.visited) {
    const n = Number(id.slice(3)) - 1;
    const x = n % SIZE;
    const y = Math.floor(n / SIZE);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) seen.add(docAt(nx, ny).id);
    }
  }
  return seen;
}

export type MazeAction = { type: "move"; dx: number; dy: number } | { type: "collect" } | { type: "search" } | { type: "to-answer" };

export function mazeReducer(s: MazeState, a: MazeAction, relaxed: boolean): MazeState {
  if (s.phase !== "search") return s;
  switch (a.type) {
    case "move": {
      const x = s.pos.x + a.dx;
      const y = s.pos.y + a.dy;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || Math.abs(a.dx) + Math.abs(a.dy) !== 1) return s;
      const d = docAt(x, y);
      const first = !s.visited.includes(d.id);
      const cost = 1 + (first && d.freshness === "outdated" ? BUDGET.extraForOutdated : 0);
      const movesUsed = s.movesUsed + cost;
      const note = first
        ? `${d.title} (${d.source}, ${d.freshness}): ${RELEVANCE_LABEL[d.relevance].toLowerCase()}.${cost > 1 && !relaxed ? ` Outdated, so reading it took ${cost} moves.` : ""}`
        : `Back at ${d.title}.`;
      const next: MazeState = { ...s, pos: { x, y }, visited: first ? [...s.visited, d.id] : s.visited, movesUsed, note };
      if (!relaxed && movesUsed >= BUDGET.moves) return { ...next, phase: "answer", note: `${note} Search time is up, so it's time to answer.` };
      return next;
    }
    case "collect": {
      const d = docAt(s.pos.x, s.pos.y);
      if (s.evidence.includes(d.id) || s.evidence.length >= EVIDENCE_SLOTS) return s;
      const evidence = [...s.evidence, d.id];
      const movesUsed = s.movesUsed + BUDGET.collect;
      const out: MazeState = {
        ...s,
        evidence,
        movesUsed,
        note: `${d.title} added as evidence (${evidence.length} of ${EVIDENCE_SLOTS} slots).${d.freshness === "outdated" ? " It's outdated." : d.relevance === "none" ? " It doesn't address the question." : ""}`,
      };
      if (!relaxed && movesUsed >= BUDGET.moves) return { ...out, phase: "answer", note: `${out.note} Search time is up, so it's time to answer.` };
      return out;
    }
    case "search": {
      if (!s.searchesLeft) return s;
      const near = BOARD.flat()
        .map((d, n) => ({ d, x: n % SIZE, y: Math.floor(n / SIZE) }))
        .filter(({ x, y }) => Math.max(Math.abs(x - s.pos.x), Math.abs(y - s.pos.y)) <= SEMANTIC_SEARCH.radius)
        .filter(({ d }) => d.relevance !== "none")
        .sort((p, q) => RELEVANCE_SCORE[q.d.relevance] - RELEVANCE_SCORE[p.d.relevance])
        .slice(0, SEMANTIC_SEARCH.top)
        .map(({ d }) => d.id);
      return {
        ...s,
        searchesLeft: s.searchesLeft - 1,
        highlighted: near,
        note: near.length
          ? `Semantic search highlighted ${near.length} ${near.length === 1 ? "document" : "documents"} nearby. It ranks by meaning, not by date.`
          : "Semantic search found nothing relevant within two steps.",
      };
    }
    case "to-answer":
      return { ...s, phase: "answer", note: "Choose the answer your evidence supports." };
  }
}

export type MazeSummary = {
  score: number;
  maxScore: number;
  relevantCurrent: number;
  outdatedInEvidence: number;
  answer: AnswerKind;
  backed: boolean;
};

export function scoreMaze(s: MazeState, answerId: string): MazeSummary {
  const ev = s.evidence.map(docById);
  const relevantCurrent = ev.filter((d) => d.freshness === "current" && d.relevance === "high").length;
  const partialCurrent = ev.filter((d) => d.freshness === "current" && d.relevance === "partial").length;
  const outdated = ev.filter((d) => d.freshness === "outdated").length;
  const answer = ANSWERS.find((a) => a.id === answerId)!;
  const kind = answerKind(answer);
  const backed = answer.cites.length > 0 && answer.cites.every((id) => s.evidence.includes(id));
  const score =
    relevantCurrent * POINTS.relevantCurrent +
    partialCurrent * POINTS.partialCurrent +
    outdated * POINTS.outdatedEvidence +
    (outdated === 0 && ev.length > 0 ? POINTS.noOutdatedEvidence : 0) +
    POINTS.answer[kind] +
    (backed && kind === "grounded" ? POINTS.backedByEvidence : 0);
  // Best: the two highly relevant current documents plus one partly relevant current one, no outdated, grounded and backed.
  const maxScore = 2 * POINTS.relevantCurrent + POINTS.partialCurrent + POINTS.noOutdatedEvidence + POINTS.answer.grounded + POINTS.backedByEvidence;
  return { score, maxScore, relevantCurrent, outdatedInEvidence: outdated, answer: kind, backed };
}

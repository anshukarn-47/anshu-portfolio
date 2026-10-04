import type { ComponentType } from "react";

/** What a game's play phase receives from the GameShell. */
export type PlayProps = {
  /** No timer and a slower pace. */
  relaxed: boolean;
  /** Paused by the player, or because the tab was hidden. */
  paused: boolean;
  /** Called once, when the run ends. A run always simply finishes; there is no losing state. */
  onFinish: (result: GameResult) => void;
};

/** A finished run, as the debrief shows it. Simulated, and about decisions, not speed. */
export type GameResult = {
  /** Points for decision quality. */
  score: number;
  /** Shown as "score / max" when a fixed maximum exists. */
  maxScore?: number;
  /** Neutral lines describing what happened. */
  lines: { label: string; value: string }[];
  /** An optional table, such as planned vs delivered per sprint. */
  table?: { caption: string; columns: string[]; rows: string[][] };
};

export type GameDefinition = {
  tutorial: { title: string; body: string }[];
  Play: ComponentType<PlayProps>;
  /** What the game demonstrates, for the debrief. */
  demonstrates: string[];
  /** One sentence: what the score rewards. */
  scoreRewards: string;
  /** Approach lines in the work record that match this are shown word for word in the real case, as the part most relevant to the game. */
  caseFocus?: RegExp;
};

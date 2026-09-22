/**
 * Sports data provider interface — CLAUDE_CODE_BUILD_PROMPT.md "Sports data"
 * stack line: `getSchedule()` / `subscribe(eventId, onEvent)` with two
 * implementations (`mock`, `sportsdataio`) swapped behind `FEED_PROVIDER`.
 */
import type { GameState } from "../types.js";

export type PlayType =
  | "kickoff"
  | "run"
  | "pass"
  | "sack"
  | "punt"
  | "field_goal"
  | "touchdown"
  | "extra_point"
  | "two_point"
  | "turnover"
  | "penalty"
  | "final";

export interface FeedPlay {
  /** Monotonic server-time-equivalent stamp for this play, ms epoch. */
  feedTs: number;
  seq: number;
  quarter: number; // 5 = OT
  clockMs: number;
  type: PlayType;
  description: string;
  home: { abbr: string; score: number };
  away: { abbr: string; score: number };
  possession: "home" | "away" | null;
  down: number | null;
  distance: number | null;
  yardline: string | null;
  /** Player credited, for bet-leg tracking / "anytime TD" style markets. */
  player?: string;
  /** Length of a scoring/gain play in yards, used by the FG>=50 moment rule. */
  yards?: number;
  isScoringPlay?: boolean;
  isTurnover?: boolean;
}

export interface ScheduledEvent {
  id: string;
  home: { abbr: string; name: string; color: string };
  away: { abbr: string; name: string; color: string };
  startTime: string; // ISO
  status: GameState["status"];
}

export type Unsubscribe = () => void;

export interface FeedProvider {
  id: "mock" | "sportsdataio" | "sportradar";
  getSchedule(): Promise<ScheduledEvent[]>;
  /**
   * Subscribe to normalized plays for one event. `onPlay` fires once per
   * play in feed order. Returns an unsubscribe function.
   */
  subscribe(eventId: string, onPlay: (play: FeedPlay) => void): Unsubscribe;
}

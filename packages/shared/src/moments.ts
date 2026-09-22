/**
 * Moment detector — CLAUDE_CODE_HANDOFF.md §12 ("Moment detector: TD,
 * turnover, FG >= 50, lead change, final 2:00 score") and §17 trigger #1
 * ("Game event from the feed"). Pure function: feed play in, Moment[] out.
 * Triggers #2 (reaction spike) and #3 (manual "Save that") happen at the
 * room level (participant reactions / a button), not from the feed, so they
 * live in apps/worker's room-level aggregator, not here.
 */
import type { FeedPlay } from "./feed/types.js";

export type GameMomentKind = "touchdown" | "turnover" | "long_field_goal" | "lead_change" | "final_two_minutes_score";

export interface GameMoment {
  id: string;
  kind: GameMomentKind;
  feedTs: number;
  label: string;
  play: FeedPlay;
}

function leader(home: number, away: number): "home" | "away" | "tied" {
  if (home === away) return "tied";
  return home > away ? "home" : "away";
}

function isFinalTwoMinutes(play: FeedPlay): boolean {
  const inLastQuarterOfHalf = play.quarter === 2 || play.quarter === 4 || play.quarter === 5;
  return inLastQuarterOfHalf && play.clockMs <= 2 * 60 * 1000;
}

let momentSeq = 0;

/**
 * Call once per play, in feed order, with the previous play's state (or
 * `null` for the first play of the game) so lead-change can be detected.
 */
export function detectGameMoments(play: FeedPlay, previousPlay: FeedPlay | null): GameMoment[] {
  const moments: GameMoment[] = [];
  const mk = (kind: GameMomentKind, label: string): GameMoment => ({
    id: `moment_${play.seq}_${kind}_${++momentSeq}`,
    kind,
    feedTs: play.feedTs,
    label,
    play,
  });

  if (play.type === "touchdown") {
    moments.push(mk("touchdown", play.description));
  }

  if (play.isTurnover || play.type === "turnover") {
    moments.push(mk("turnover", play.description));
  }

  if (play.type === "field_goal" && (play.yards ?? 0) >= 50) {
    moments.push(mk("long_field_goal", play.description));
  }

  if (previousPlay) {
    const before = leader(previousPlay.home.score, previousPlay.away.score);
    const after = leader(play.home.score, play.away.score);
    if (before !== after && after !== "tied") {
      moments.push(mk("lead_change", `${after === "home" ? play.home.abbr : play.away.abbr} take the lead. ${play.description}`));
    }
  }

  if (play.isScoringPlay && isFinalTwoMinutes(play)) {
    moments.push(mk("final_two_minutes_score", play.description));
  }

  return moments;
}

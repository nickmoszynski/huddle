/**
 * Mock sports feed — replays the seed script from CLAUDE_CODE_HANDOFF.md
 * (Phase 1 / seed data): Monday Night Football, Bills @ Patriots, final 27-24.
 * "Bills drive from Q3 8:42 to the Allen 18-yard TD, 17->24, then a
 * Patriots drive, ending 27-24" (CLAUDE_CODE_BUILD_PROMPT.md Phase 1),
 * matching the score bug shown on the concept boards (BUF 17 - NE 14,
 * Q3 8:42, "2nd & 7 - BUF 43 - Allen complete to Kincaid for 14 yards").
 *
 * Controllable speed via `--speed=N` (N game-seconds per wall-clock second)
 * so a full quarter can be watched in minutes during development.
 */
import type { FeedPlay, FeedProvider, ScheduledEvent, Unsubscribe } from "./types.js";

export const MOCK_EVENT_ID = "evt_buf_ne_2024_wk10";

const HOME = { abbr: "NE", name: "Patriots", color: "#002244" };
const AWAY = { abbr: "BUF", name: "Bills", color: "#00338D" };

// Each entry is a delta from the previous state; clockMs counts DOWN within
// the quarter (15:00 -> 0:00). Scores are cumulative/absolute, not deltas.
interface ScriptStep {
  quarter: number;
  clock: string; // "M:SS"
  type: FeedPlay["type"];
  description: string;
  home: number;
  away: number;
  possession: "home" | "away" | null;
  down?: number | null;
  distance?: number | null;
  yardline?: string | null;
  player?: string;
  yards?: number;
  isScoringPlay?: boolean;
  isTurnover?: boolean;
}

function clockToMs(clock: string): number {
  const [m, s] = clock.split(":").map(Number);
  return ((m ?? 0) * 60 + (s ?? 0)) * 1000;
}

// The script: Q3 8:42, BUF 17 - NE 14 -> BUF drive -> Allen 18yd rushing TD
// (BUF 24) -> NE answers with a TD then a FG (NE 24, tied) -> BUF closes it
// out with a go-ahead FG in the final two minutes -> final BUF 27, NE 24.
const SCRIPT: ScriptStep[] = [
  { quarter: 3, clock: "8:42", type: "pass", description: "Allen complete to Kincaid for 14 yards.", home: 14, away: 17, possession: "away", down: 2, distance: 7, yardline: "BUF 43", player: "Dalton Kincaid", yards: 14 },
  { quarter: 3, clock: "7:58", type: "run", description: "Cook runs for 6 yards.", home: 14, away: 17, possession: "away", down: 1, distance: 10, yardline: "BUF 57", player: "James Cook", yards: 6 },
  { quarter: 3, clock: "7:19", type: "pass", description: "Allen complete to Shakir for 9 yards.", home: 14, away: 17, possession: "away", down: 2, distance: 4, yardline: "NE 37", player: "Khalil Shakir", yards: 9 },
  { quarter: 3, clock: "6:40", type: "run", description: "Cook runs for 5 yards, first down.", home: 14, away: 17, possession: "away", down: 1, distance: 10, yardline: "NE 28", player: "James Cook", yards: 5 },
  { quarter: 3, clock: "6:02", type: "pass", description: "Allen complete to Kincaid for 10 yards.", home: 14, away: 17, possession: "away", down: 2, distance: 5, yardline: "NE 18", player: "Dalton Kincaid", yards: 10 },
  {
    quarter: 3,
    clock: "5:24",
    type: "touchdown",
    description: "Allen rushes for 18 yards. TOUCHDOWN, Bills!",
    home: 14,
    away: 23,
    possession: "away",
    down: null,
    distance: null,
    yardline: "NE 0",
    player: "Josh Allen",
    yards: 18,
    isScoringPlay: true,
  },
  { quarter: 3, clock: "5:24", type: "extra_point", description: "Bass extra point is good.", home: 14, away: 24, possession: null, isScoringPlay: true },
  { quarter: 3, clock: "5:10", type: "kickoff", description: "Bass kicks off, touchback.", home: 14, away: 24, possession: "home", down: null, distance: null, yardline: "NE 25" },
  { quarter: 3, clock: "4:31", type: "pass", description: "Maye complete to Hall for 12 yards.", home: 14, away: 24, possession: "home", down: 1, distance: 10, yardline: "NE 37", player: "Drake Maye", yards: 12 },
  { quarter: 3, clock: "3:48", type: "pass", description: "Maye complete to Boutte for 21 yards.", home: 14, away: 24, possession: "home", down: 1, distance: 10, yardline: "BUF 42", player: "Kayshon Boutte", yards: 21 },
  { quarter: 3, clock: "2:55", type: "run", description: "Henderson runs for 8 yards.", home: 14, away: 24, possession: "home", down: 2, distance: 2, yardline: "BUF 34", player: "TreVeyon Henderson", yards: 8 },
  { quarter: 3, clock: "2:10", type: "pass", description: "Maye complete to Henderson for 14 yards.", home: 14, away: 24, possession: "home", down: 1, distance: 10, yardline: "BUF 20", player: "TreVeyon Henderson", yards: 14 },
  { quarter: 3, clock: "1:22", type: "pass", description: "Maye complete to Hall for 20 yards. TOUCHDOWN, Patriots!", home: 20, away: 24, possession: "home", down: null, distance: null, yardline: "BUF 0", player: "Hunter Henry", yards: 20, isScoringPlay: true },
  { quarter: 3, clock: "1:22", type: "extra_point", description: "Patriots extra point is good.", home: 21, away: 24, possession: null, isScoringPlay: true },
  { quarter: 4, clock: "12:40", type: "field_goal", description: "Aubrey 44-yard field goal is good.", home: 24, away: 24, possession: "home", isScoringPlay: true, yards: 44 },
  { quarter: 4, clock: "1:58", type: "pass", description: "Allen complete to Coleman for 16 yards.", home: 24, away: 24, possession: "away", down: 1, distance: 10, yardline: "NE 33", player: "Keon Coleman", yards: 16 },
  { quarter: 4, clock: "1:15", type: "run", description: "Cook runs for 9 yards.", home: 24, away: 24, possession: "away", down: 1, distance: 8, yardline: "NE 17", player: "James Cook", yards: 9 },
  {
    quarter: 4,
    clock: "0:04",
    type: "field_goal",
    description: "Bass 26-yard field goal is good. Bills go up 27-24.",
    home: 24,
    away: 27,
    possession: "away",
    isScoringPlay: true,
    yards: 26,
  },
  { quarter: 4, clock: "0:00", type: "final", description: "Final: Bills 27, Patriots 24.", home: 24, away: 27, possession: null },
];

function toFeedPlay(step: ScriptStep, seq: number, baseTs: number, stepIndexMs: number): FeedPlay {
  return {
    feedTs: baseTs + stepIndexMs,
    seq,
    quarter: step.quarter,
    clockMs: clockToMs(step.clock),
    type: step.type,
    description: step.description,
    home: { abbr: HOME.abbr, score: step.home },
    away: { abbr: AWAY.abbr, score: step.away },
    possession: step.possession,
    down: step.down ?? null,
    distance: step.distance ?? null,
    yardline: step.yardline ?? null,
    player: step.player,
    yards: step.yards,
    isScoringPlay: step.isScoringPlay ?? false,
    isTurnover: step.isTurnover ?? false,
  };
}

export interface MockFeedOptions {
  /** Game-seconds of feed time advanced per wall-clock second. Default 1 (real time). */
  speed?: number;
}

export function createMockFeedProvider(opts: MockFeedOptions = {}): FeedProvider {
  const speed = Math.max(0.1, opts.speed ?? 1);

  return {
    id: "mock",
    async getSchedule(): Promise<ScheduledEvent[]> {
      return [
        {
          id: MOCK_EVENT_ID,
          home: HOME,
          away: AWAY,
          startTime: new Date().toISOString(),
          status: "live",
        },
      ];
    },
    subscribe(eventId: string, onPlay: (play: FeedPlay) => void): Unsubscribe {
      if (eventId !== MOCK_EVENT_ID) {
        // Unknown event on the mock provider: no-op subscription.
        return () => {};
      }
      const baseTs = Date.now();
      let cancelled = false;
      const timers: ReturnType<typeof setTimeout>[] = [];

      // Space plays ~6 "game seconds" apart by default, compressed by `speed`.
      let cursorMs = 0;
      SCRIPT.forEach((step, i) => {
        const gapMs = i === 0 ? 0 : 6000;
        cursorMs += gapMs;
        const wallDelay = cursorMs / speed;
        const timer = setTimeout(() => {
          if (cancelled) return;
          onPlay(toFeedPlay(step, i + 1, baseTs, cursorMs));
        }, wallDelay);
        timers.push(timer);
      });

      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    },
  };
}

export { SCRIPT as MOCK_SCRIPT };

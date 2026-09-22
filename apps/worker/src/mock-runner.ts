#!/usr/bin/env tsx
/**
 * `pnpm worker:mock --speed=4`
 *
 * Phase 1 deliverable: subscribes to the mock feed provider (the prototype's
 * Bills @ Patriots script, CLAUDE_CODE_HANDOFF.md seed data) and runs the
 * moment detector (§12/§17) against it live, printing normalized game state
 * and detected moments to the console. This is the thing later phases wire
 * into Supabase Realtime (`game.*` events) and the clip pipeline — for now
 * it proves the feed + detector contract end to end with zero external
 * services required.
 */
import { createMockFeedProvider, MOCK_EVENT_ID } from "@huddle/shared/feed";
import { detectGameMoments } from "@huddle/shared";
import type { FeedPlay } from "@huddle/shared/feed";

function parseSpeed(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith("--speed="));
  const value = arg ? Number(arg.split("=")[1]) : 1;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function fmtClock(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function main() {
  const speed = parseSpeed(process.argv.slice(2));
  const provider = createMockFeedProvider({ speed });

  const schedule = await provider.getSchedule();
  const event = schedule[0];
  console.log(`\n huddle worker — mock feed  (speed=${speed}x)`);
  console.log(` event: ${event?.away.name} @ ${event?.home.name}\n`);

  let previous: FeedPlay | null = null;

  const unsubscribe = provider.subscribe(MOCK_EVENT_ID, (play) => {
    const quarterLabel = play.quarter === 5 ? "OT" : `Q${play.quarter}`;
    const scoreLine = `${play.away.abbr} ${play.away.score} - ${play.home.abbr} ${play.home.score}`;
    const situation =
      play.down != null ? `${play.down}${["", "st", "nd", "rd"][play.down] ?? "th"} & ${play.distance} · ${play.yardline}` : play.yardline ?? "";

    console.log(`[${quarterLabel} ${fmtClock(play.clockMs)}] ${scoreLine}  ${situation}`);
    console.log(`   ${play.description}`);

    const moments = detectGameMoments(play, previous);
    for (const moment of moments) {
      console.log(`   >>> MOMENT [${moment.kind}] ${moment.label}`);
    }

    previous = play;

    if (play.type === "final") {
      console.log("\n final whistle — worker:mock done.\n");
      unsubscribe();
      process.exit(0);
    }
  });

  process.on("SIGINT", () => {
    unsubscribe();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

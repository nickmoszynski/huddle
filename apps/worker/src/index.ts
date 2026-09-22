/**
 * Long-running worker entrypoint (Fly.io / Railway — see handoff §16/§19;
 * serverless functions time out and cannot host this).
 *
 * Phase 1 only wires the feed + moment detector, exercised via
 * `pnpm worker:mock` (src/mock-runner.ts). The pieces below are the real
 * shape this file grows into in later phases — each is a stub until its
 * phase lands, listed here (rather than silently absent) so the worker's
 * full responsibility is visible from one file:
 *
 *  - Phase 1: feed ingestor -> normalize -> publish `game.*` (this file)
 *  - Phase 6: pick resolver (subscribes scoring plays, resolves picks)
 *  - Phase 8: bet-leg tracker (updates BetLeg.current from player stats)
 *  - Phase 5: clip composer (FFmpeg queue consumer)
 *  - Phase 10: crowd-pulse aggregator (5s window reaction/poll rollup)
 *
 * Not implemented outside `mock` yet — see DECISIONS.md.
 */
import { getFeedProvider } from "@huddle/shared/feed";
import { detectGameMoments } from "@huddle/shared";
import type { FeedPlay } from "@huddle/shared/feed";

async function main() {
  const provider = getFeedProvider();
  const schedule = await provider.getSchedule();

  console.log(`[worker] provider=${provider.id} events=${schedule.length}`);

  let previous: FeedPlay | null = null;
  for (const event of schedule) {
    provider.subscribe(event.id, (play) => {
      // TODO(phase 1 follow-up): write normalized play to `events`/game_state
      // and publish `game.state` / `game.play` over Supabase Realtime to
      // every room watching `event.id` (fan-out once per game, not per room
      // — handoff §12).
      const moments = detectGameMoments(play, previous);
      previous = play;
      for (const moment of moments) {
        // TODO: publish `moment` event -> triggers client-side capture (§17)
        console.log(`[worker] moment ${moment.kind}: ${moment.label}`);
      }
    });
  }
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});

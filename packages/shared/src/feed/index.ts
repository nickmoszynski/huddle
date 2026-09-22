import { createMockFeedProvider } from "./mock.js";
import type { FeedProvider } from "./types.js";

export * from "./types.js";
export { createMockFeedProvider, MOCK_EVENT_ID, MOCK_SCRIPT } from "./mock.js";

/**
 * Factory switched by `FEED_PROVIDER` env var (mock | sportsdataio).
 * Only `mock` is implemented in Phase 1; `sportsdataio` throws until wired
 * up (Phase 12+, behind a licensed data contract) — see DECISIONS.md.
 */
export function getFeedProvider(env: Record<string, string | undefined> = process.env): FeedProvider {
  const provider = env.FEED_PROVIDER ?? "mock";
  switch (provider) {
    case "mock":
      return createMockFeedProvider({ speed: Number(env.FEED_SPEED ?? 1) });
    case "sportsdataio":
    case "sportradar":
      throw new Error(
        `FEED_PROVIDER=${provider} is not implemented yet — no sports-data license is wired up. ` +
          `Set FEED_PROVIDER=mock (the default) until packages/shared/src/feed/${provider}.ts exists.`
      );
    default:
      throw new Error(`Unknown FEED_PROVIDER "${provider}"`);
  }
}

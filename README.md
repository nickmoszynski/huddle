# Huddle

The digital couch for live events. See `CLAUDE_CODE_HANDOFF.md` (technical spec) and `CLAUDE_CODE_BUILD_PROMPT.md` (build order) for the full product spec — this README is just setup.

> Working name; brand string, domain and colors live entirely in `packages/brand` (see `DECISIONS.md`).

## Status

Phases 0–1 of the build order: monorepo foundation, design tokens, UI primitives, `/dev/states`, the full Drizzle schema, and a mock game feed + moment detector. No routes, auth, video, or realtime yet — see `DECISIONS.md` for exactly what's stubbed and why.

## Requirements

- Node >= 20, pnpm 10 (`corepack enable` will pick up the pinned version from `package.json`)
- A Postgres database for Phase 1+ DB work (Supabase recommended — free tier is enough for dev)

## Setup

```bash
pnpm install
cp .env.example .env        # fill in DATABASE_URL at minimum once you have a Supabase project
```

## Run the app

```bash
pnpm dev                    # apps/web on http://localhost:3000
```

Visit `/dev/states` to see every UI primitive/state side by side.

## Run the mock game feed

No database or external services required — this replays the seed script (Bills @ Patriots, Q3 8:42 → final 27-24) and prints normalized plays + detected Moments to the console.

```bash
pnpm worker:mock --speed=4  # 4x game speed; --speed=1 is real time
```

## Database

```bash
pnpm db:generate             # generate SQL migrations from packages/db/src/schema.ts
pnpm db:migrate              # apply them to DATABASE_URL
```

RLS policies are applied as Supabase SQL separately (not modeled in Drizzle) — see handoff §8.

## Monorepo layout

```
apps/
  web/        Next.js 15 app (App Router, Tailwind, the actual product)
  worker/     Long-running worker — feed ingest, moment detection (Fly.io/Railway later)
packages/
  brand/      Product name, domain, colors, copy — the ONLY place these live
  ui/         Design-system primitives (Button, VideoTile, ScoreBug, PickCard, ...)
  shared/     Cross-cutting types (zod), the sports-feed provider interface + mock
  db/         Drizzle schema + migrations (Postgres/Supabase)
design/
  boards/     Concept board reference images
```

## Environment switch

`FEED_PROVIDER` env var: `mock` (default, no license needed) or `sportsdataio`/`sportradar` (not implemented yet — throws until a real provider lands behind `packages/shared/src/feed/types.ts`'s `FeedProvider` interface).

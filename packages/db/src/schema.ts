/**
 * Drizzle schema — CLAUDE_CODE_HANDOFF.md §8 (Database requirements).
 * Postgres via Supabase. RLS policies are applied in Supabase SQL
 * migrations (not modeled here — Drizzle owns structure, Supabase
 * dashboard/SQL owns policy, per §8 "Row-level security or service-layer
 * checks").
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roomPrivacyEnum = pgEnum("room_privacy", ["private", "fof", "public"]);
export const roomStatusEnum = pgEnum("room_status", ["waiting", "live", "ended"]);
export const participantRoleEnum = pgEnum("participant_role", ["host", "member", "guest", "audience", "cohost"]);
export const connQualityEnum = pgEnum("conn_quality", ["good", "poor", "reconnecting"]);
export const pickKindEnum = pgEnum("pick_kind", ["next_score", "next_scorer", "drive_result", "overtime", "final_score", "custom"]);
export const pickInputEnum = pgEnum("pick_input", ["choice", "score"]);
export const pickStatusEnum = pgEnum("pick_status", ["open", "locked", "resolved", "void"]);
export const betKindEnum = pgEnum("bet_kind", ["single", "parlay"]);
export const betStatusEnum = pgEnum("bet_status", ["pending", "live", "won", "lost", "push"]);
export const clipStatusEnum = pgEnum("clip_status", ["capturing", "uploading", "composing", "ready", "failed"]);
export const clipTrackStatusEnum = pgEnum("clip_track_status", ["pending", "uploaded", "missing"]);
export const momentKindEnum = pgEnum("moment_kind", ["touchdown", "turnover", "long_field_goal", "lead_change", "final_two_minutes_score", "reaction_spike", "manual"]);
export const findableEnum = pgEnum("findable", ["friends", "everyone"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "reviewed", "dismissed", "actioned"]);

// ---------------------------------------------------------------------------
// Users & auth (§9)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: id(),
  // Mirrors the Supabase Auth user id (auth.users.id); kept as a plain
  // column rather than an FK so this schema stays portable off Supabase.
  authId: uuid("auth_id").notNull(),
  // Sleeper-style handle, e.g. "nickm" — claimed once via /signin, on top
  // of anonymous auth (no email/password required to get one). Nullable
  // because a `users` row can also be created in passing by hosting a room
  // (apps/web/app/api/rooms/route.ts POST) without ever visiting /signin;
  // that row just has no username (and can't use Groups/Profile) until its
  // owner claims one. A unique index still works with nulls in Postgres —
  // multiple null usernames don't collide, only real claimed values do.
  username: text("username"),
  displayName: text("display_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
}, (t) => ({
  authIdIdx: uniqueIndex("users_auth_id_idx").on(t.authId),
  usernameIdx: uniqueIndex("users_username_idx").on(t.username),
}));

export const guestSessions = pgTable("guest_sessions", {
  id: id(),
  displayName: text("display_name").notNull(),
  // set when a guest promotes to a full account (§9 "Promotion")
  promotedToUserId: uuid("promoted_to_user_id").references(() => users.id),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const follows = pgTable("follows", {
  followerId: uuid("follower_id").notNull().references(() => users.id),
  followingId: uuid("following_id").notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followerId, t.followingId] }),
}));

export const userPrefs = pgTable("user_prefs", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  camOnJoin: boolean("cam_on_join").notNull().default(true),
  micOnJoin: boolean("mic_on_join").notNull().default(true),
  noiseSuppression: boolean("noise_suppression").notNull().default(true),
  tvAudioFilter: boolean("tv_audio_filter").notNull().default(true),
  notifyGameAlerts: boolean("notify_game_alerts").notNull().default(true),
  notifyMentions: boolean("notify_mentions").notNull().default(true),
  notifyResults: boolean("notify_results").notNull().default(true),
  notifyFriendJoined: boolean("notify_friend_joined").notNull().default(true),
  findable: findableEnum("findable").notNull().default("friends"),
  showBetsToCrew: boolean("show_bets_to_crew").notNull().default(false),
  reduceMotion: boolean("reduce_motion").notNull().default(false),
  autoSyncOnJoin: boolean("auto_sync_on_join").notNull().default(true),
  lowData: boolean("low_data").notNull().default(false),
});

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export const groups = pgTable("groups", {
  id: id(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => ({
  slugIdx: uniqueIndex("groups_slug_idx").on(t.slug),
}));

export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull().references(() => groups.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  joinedAt: createdAt(),
}, (t) => ({
  pk: primaryKey({ columns: [t.groupId, t.userId] }),
}));

// ---------------------------------------------------------------------------
// Events (games) — normalized from the sports data provider (§12)
// ---------------------------------------------------------------------------

export const events = pgTable("events", {
  id: id(),
  // stable id from the feed provider (mock or licensed), not our uuid PK
  providerEventId: text("provider_event_id").notNull(),
  homeAbbr: text("home_abbr").notNull(),
  awayAbbr: text("away_abbr").notNull(),
  homeName: text("home_name").notNull(),
  awayName: text("away_name").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled|pregame|live|halftime|final|overtime
  // Nullable, added for Explore's multi-league schedule (see DECISIONS.md,
  // "Explore: browse by league"). `league` tags which schedule source an
  // event came from ("nfl" | "mlb" | "wwe" | ... — not an enum, so a new
  // league never needs a migration). `title` overrides the default
  // "awayName @ homeName" display for events that aren't a two-team
  // matchup (e.g. "WWE Raw") — every display site falls back to
  // away@home when it's null, so this is fully backward compatible.
  league: text("league"),
  title: text("title"),
}, (t) => ({
  providerIdx: uniqueIndex("events_provider_event_id_idx").on(t.providerEventId),
}));

// Latest normalized game state, one row per event, upserted by the worker.
export const gameState = pgTable("game_state", {
  eventId: uuid("event_id").primaryKey().references(() => events.id),
  quarter: integer("quarter").notNull().default(0),
  clockMs: integer("clock_ms").notNull().default(0),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  possession: text("possession"), // home|away|null
  down: integer("down"),
  distance: integer("distance"),
  yardline: text("yardline"),
  lastPlay: text("last_play"),
  feedTs: timestamp("feed_ts", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const rooms = pgTable("rooms", {
  id: id(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  groupId: uuid("group_id").references(() => groups.id),
  eventId: uuid("event_id").notNull().references(() => events.id),
  privacy: roomPrivacyEnum("privacy").notNull().default("private"),
  hostId: uuid("host_id").notNull().references(() => users.id),
  status: roomStatusEnum("status").notNull().default("waiting"),
  createdAt: createdAt(),
}, (t) => ({
  codeIdx: uniqueIndex("rooms_code_idx").on(t.code),
}));

export const roomParticipants = pgTable("room_participants", {
  id: id(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  userId: uuid("user_id").references(() => users.id),
  guestId: uuid("guest_id").references(() => guestSessions.id),
  displayName: text("display_name").notNull(),
  role: participantRoleEnum("role").notNull().default("member"),
  micOn: boolean("mic_on").notNull().default(true),
  camOn: boolean("cam_on").notNull().default(true),
  conn: connQualityEnum("conn").notNull().default("good"),
  syncOffsetMs: integer("sync_offset_ms").notNull().default(0),
  joinedAt: createdAt(),
  leftAt: timestamp("left_at", { withTimezone: true }),
}, (t) => ({
  // "room_participants(room_id) where left_at is null" (§8 Indexes)
  activeByRoomIdx: index("room_participants_active_room_idx").on(t.roomId).where(sql`${t.leftAt} is null`),
}));

// ---------------------------------------------------------------------------
// Chat & reactions
// ---------------------------------------------------------------------------

export const messages = pgTable("messages", {
  id: id(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  senderId: uuid("sender_id").references(() => users.id),
  senderGuestId: uuid("sender_guest_id").references(() => guestSessions.id),
  senderName: text("sender_name").notNull(),
  text: text("text").notNull(),
  // system messages (pick resolved, bet settled, etc.) vs. user chat
  kind: text("kind").notNull().default("user"), // user|system|reaction
  senderLocalTs: timestamp("sender_local_ts", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => ({
  // "messages(room_id, created_at)" (§8 Indexes)
  roomCreatedIdx: index("messages_room_id_created_at_idx").on(t.roomId, t.createdAt),
}));

// Aggregated counts per room per emoji per minute-bucket; raw per-tap events
// are lossy (LiveKit data channel, §11) and not persisted beyond this
// rollup — "reactions (aggregated, TTL raw)" per §8.
export const reactions = pgTable("reactions", {
  id: id(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  emoji: text("emoji").notNull(),
  bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
}, (t) => ({
  roomBucketIdx: uniqueIndex("reactions_room_emoji_bucket_idx").on(t.roomId, t.emoji, t.bucketStart),
}));

// ---------------------------------------------------------------------------
// Picks
// ---------------------------------------------------------------------------

export const picks = pgTable("picks", {
  id: id(),
  roomId: uuid("room_id").references(() => rooms.id),
  groupId: uuid("group_id").references(() => groups.id),
  publicRoomId: uuid("public_room_id").references(() => rooms.id),
  eventId: uuid("event_id").notNull().references(() => events.id),
  kind: pickKindEnum("kind").notNull(),
  input: pickInputEnum("input").notNull(),
  prompt: text("prompt").notNull(),
  locksAtFeedTs: timestamp("locks_at_feed_ts", { withTimezone: true }).notNull(),
  status: pickStatusEnum("status").notNull().default("open"),
  resultOptionId: uuid("result_option_id"),
  resultHomeScore: integer("result_home_score"),
  resultAwayScore: integer("result_away_score"),
  points: integer("points").notNull().default(10),
  scoring: text("scoring").notNull().default("exact"), // exact|closest
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
});

export const pickOptions = pgTable("pick_options", {
  id: id(),
  pickId: uuid("pick_id").notNull().references(() => picks.id),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const pickEntries = pgTable("pick_entries", {
  id: id(),
  pickId: uuid("pick_id").notNull().references(() => picks.id),
  userId: uuid("user_id").references(() => users.id),
  guestId: uuid("guest_id").references(() => guestSessions.id),
  optionId: uuid("option_id").references(() => pickOptions.id),
  scoreGuessHome: integer("score_guess_home"),
  scoreGuessAway: integer("score_guess_away"),
  pointsAwarded: integer("points_awarded"),
  createdAt: createdAt(),
}, (t) => ({
  // "pick_entries(pick_id)" (§8 Indexes)
  pickIdIdx: index("pick_entries_pick_id_idx").on(t.pickId),
  onePerUserPerPick: uniqueIndex("pick_entries_pick_user_idx").on(t.pickId, t.userId),
}));

// Materialized from entries; group x season x user (§8).
export const seasonScores = pgTable("season_scores", {
  groupId: uuid("group_id").notNull().references(() => groups.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  season: text("season").notNull(), // e.g. "2026"
  points: integer("points").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.groupId, t.userId, t.season] }),
}));

// ---------------------------------------------------------------------------
// Bets (manual tracking only — never a sportsbook integration, §1/§8)
// ---------------------------------------------------------------------------

export const bets = pgTable("bets", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  kind: betKindEnum("kind").notNull().default("single"),
  title: text("title").notNull(),
  odds: text("odds"),
  stake: doublePrecision("stake"), // private to owner unless shared (§8)
  status: betStatusEnum("status").notNull().default("pending"),
  sharedToRoom: boolean("shared_to_room").notNull().default(false),
  createdAt: createdAt(),
});

export const betLegs = pgTable("bet_legs", {
  id: id(),
  betId: uuid("bet_id").notNull().references(() => bets.id),
  market: text("market").notNull(),
  playerId: text("player_id"),
  line: doublePrecision("line").notNull(),
  stat: text("stat").notNull(),
  current: doublePrecision("current").notNull().default(0),
  status: betStatusEnum("status").notNull().default("pending"),
});

// ---------------------------------------------------------------------------
// Moments & clips (§17)
// ---------------------------------------------------------------------------

export const moments = pgTable("moments", {
  id: id(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  eventId: uuid("event_id").references(() => events.id),
  kind: momentKindEnum("kind").notNull(),
  label: text("label").notNull(),
  feedTs: timestamp("feed_ts", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const clips = pgTable("clips", {
  id: id(),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  momentId: uuid("moment_id").notNull().references(() => moments.id),
  startFeedTs: timestamp("start_feed_ts", { withTimezone: true }).notNull(),
  endFeedTs: timestamp("end_feed_ts", { withTimezone: true }).notNull(),
  compositeUrl: text("composite_url"),
  shareCardUrl: text("share_card_url"),
  thumbnailUrl: text("thumbnail_url"),
  status: clipStatusEnum("status").notNull().default("capturing"),
  createdAt: createdAt(),
  // raw per-user tracks expire at 7 days (§17); composites persist until
  // deleted. This column drives the worker's cleanup job.
  rawExpiresAt: timestamp("raw_expires_at", { withTimezone: true }),
});

export const clipTracks = pgTable("clip_tracks", {
  id: id(),
  clipId: uuid("clip_id").notNull().references(() => clips.id),
  userId: uuid("user_id").references(() => users.id),
  guestId: uuid("guest_id").references(() => guestSessions.id),
  url: text("url"),
  status: clipTrackStatusEnum("status").notNull().default("pending"),
  // per-user opt-out: "Include me in Moments" toggle off removes them from
  // the composite without deleting other participants' tracks (§17).
  includeInComposite: boolean("include_in_composite").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Public rooms at scale (§10, §18.4, §18.5)
// ---------------------------------------------------------------------------

export const publicRoomsMeta = pgTable("public_rooms_meta", {
  roomId: uuid("room_id").primaryKey().references(() => rooms.id),
  slug: text("slug").notNull(),
  hostId: uuid("host_id").notNull().references(() => users.id),
  moderatorIds: jsonb("moderator_ids").$type<string[]>().notNull().default([]),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  premium: boolean("premium").notNull().default(false),
  featuredIntervalSec: integer("featured_interval_sec").notNull().default(30),
}, (t) => ({
  slugIdx: uniqueIndex("public_rooms_meta_slug_idx").on(t.slug),
}));

export const featuredSlots = pgTable("featured_slots", {
  id: id(),
  publicRoomId: uuid("public_room_id").notNull().references(() => rooms.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  source: text("source").notNull().default("auto"), // host|auto
});

export const qaItems = pgTable("qa_items", {
  id: id(),
  publicRoomId: uuid("public_room_id").notNull().references(() => rooms.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  votes: integer("votes").notNull().default(0),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const qaVotes = pgTable("qa_votes", {
  qaItemId: uuid("qa_item_id").notNull().references(() => qaItems.id),
  userId: uuid("user_id").notNull().references(() => users.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.qaItemId, t.userId] }),
}));

// ---------------------------------------------------------------------------
// Recaps, reports, blocks
// ---------------------------------------------------------------------------

// Materialized at game end: winner, stats, moments, best messages (§8/§18.8).
export const roomRecaps = pgTable("room_recaps", {
  roomId: uuid("room_id").primaryKey().references(() => rooms.id),
  summary: jsonb("summary").$type<{
    winner: "home" | "away" | "tie";
    finalHomeScore: number;
    finalAwayScore: number;
    durationMinutes: number;
    messageCount: number;
    reactionCount: number;
    pickCount: number;
    picksWinnerUserId?: string;
    mostWrongUserId?: string;
    momentIds: string[];
    bestMessageIds: string[];
  }>().notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: id(),
  roomId: uuid("room_id").references(() => rooms.id),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  targetUserId: uuid("target_user_id").references(() => users.id),
  targetMessageId: uuid("target_message_id").references(() => messages.id),
  reason: text("reason").notNull(),
  status: reportStatusEnum("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const blocks = pgTable("blocks", {
  blockerId: uuid("blocker_id").notNull().references(() => users.id),
  blockedId: uuid("blocked_id").notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => ({
  pk: primaryKey({ columns: [t.blockerId, t.blockedId] }),
}));

// ---------------------------------------------------------------------------
// Relations (for query ergonomics; RLS lives in Supabase SQL, not here)
// ---------------------------------------------------------------------------

export const roomsRelations = relations(rooms, ({ many, one }) => ({
  participants: many(roomParticipants),
  messages: many(messages),
  picks: many(picks),
  bets: many(bets),
  event: one(events, { fields: [rooms.eventId], references: [events.id] }),
}));

export const picksRelations = relations(picks, ({ many }) => ({
  options: many(pickOptions),
  entries: many(pickEntries),
}));

export const betsRelations = relations(bets, ({ many }) => ({
  legs: many(betLegs),
}));

export const clipsRelations = relations(clips, ({ many }) => ({
  tracks: many(clipTracks),
}));

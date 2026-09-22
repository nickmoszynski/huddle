/**
 * Core domain types — ported from CLAUDE_CODE_HANDOFF.md §7 (State model)
 * as zod schemas so the same definitions validate realtime payloads
 * (§11) and API bodies (§15), and infer the TS types everything else uses.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// §7 State model
// ---------------------------------------------------------------------------

export const RoomPrivacy = z.enum(["private", "fof", "public"]);
export type RoomPrivacy = z.infer<typeof RoomPrivacy>;

export const RoomStatus = z.enum(["waiting", "live", "ended"]);
export type RoomStatus = z.infer<typeof RoomStatus>;

export const RoomSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  groupId: z.string().optional(),
  eventId: z.string(),
  privacy: RoomPrivacy,
  hostId: z.string(),
  status: RoomStatus,
});
export type Room = z.infer<typeof RoomSchema>;

export const ParticipantRole = z.enum(["host", "member", "guest", "audience", "cohost"]);
export type ParticipantRole = z.infer<typeof ParticipantRole>;

export const ConnectionQuality = z.enum(["good", "poor", "reconnecting"]);
export type ConnectionQuality = z.infer<typeof ConnectionQuality>;

export const ParticipantSchema = z.object({
  userId: z.string().optional(),
  guestId: z.string().optional(),
  displayName: z.string(),
  role: ParticipantRole,
  media: z.object({ mic: z.boolean(), cam: z.boolean() }),
  conn: ConnectionQuality,
  syncOffsetMs: z.number().int(),
  joinedAt: z.number(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const TeamStateSchema = z.object({
  abbr: z.string(),
  score: z.number().int(),
});

export const GameStatus = z.enum(["scheduled", "pregame", "live", "halftime", "final", "overtime"]);
export type GameStatus = z.infer<typeof GameStatus>;

export const GameStateSchema = z.object({
  eventId: z.string(),
  status: GameStatus,
  quarter: z.number().int().min(0).max(5), // 5 = OT
  clockMs: z.number().int(),
  home: TeamStateSchema,
  away: TeamStateSchema,
  possession: z.enum(["home", "away"]).nullable(),
  down: z.number().int().min(1).max(4).nullable(),
  distance: z.number().int().nullable(),
  yardline: z.string().nullable(), // e.g. "BUF 43"
  lastPlay: z.string().nullable(),
  feedTs: z.number(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export const PickKind = z.enum([
  "next_score",
  "next_scorer",
  "drive_result",
  "overtime",
  "final_score",
  "custom",
]);
export type PickKind = z.infer<typeof PickKind>;

export const PickInput = z.enum(["choice", "score"]);
export const PickStatus = z.enum(["open", "locked", "resolved", "void"]);

export const PickOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const PickSchema = z.object({
  id: z.string(),
  roomId: z.string().optional(),
  groupId: z.string().optional(),
  publicRoomId: z.string().optional(),
  kind: PickKind,
  input: PickInput,
  prompt: z.string(),
  options: z.array(PickOptionSchema),
  locksAtFeedTs: z.number(),
  status: PickStatus,
  resultOptionId: z.string().optional(),
  resultScore: z.object({ home: z.number(), away: z.number() }).optional(),
  points: z.number().int(),
  scoring: z.enum(["exact", "closest"]),
});
export type Pick = z.infer<typeof PickSchema>;

export const PickEntrySchema = z.object({
  pickId: z.string(),
  userId: z.string(),
  optionId: z.string().optional(),
  scoreGuess: z.object({ home: z.number(), away: z.number() }).optional(),
  createdAt: z.number(),
  pointsAwarded: z.number().int().optional(),
});
export type PickEntry = z.infer<typeof PickEntrySchema>;

export const FeaturedSlotSchema = z.object({
  publicRoomId: z.string(),
  userId: z.string(),
  startedAt: z.number(),
  endsAt: z.number(),
  source: z.enum(["host", "auto"]),
});
export type FeaturedSlot = z.infer<typeof FeaturedSlotSchema>;

export const QAItemSchema = z.object({
  id: z.string(),
  publicRoomId: z.string(),
  userId: z.string(),
  text: z.string(),
  votes: z.number().int(),
  answeredAt: z.number().optional(),
});
export type QAItem = z.infer<typeof QAItemSchema>;

export const UserPrefsSchema = z.object({
  camOnJoin: z.boolean(),
  micOnJoin: z.boolean(),
  noiseSuppression: z.boolean(),
  tvAudioFilter: z.boolean(),
  notify: z.object({
    gameAlerts: z.boolean(),
    mentions: z.boolean(),
    results: z.boolean(),
    friendJoined: z.boolean(),
  }),
  findable: z.enum(["friends", "everyone"]),
  showBetsToCrew: z.boolean(),
  reduceMotion: z.boolean(),
  autoSyncOnJoin: z.boolean(),
  lowData: z.boolean(),
});
export type UserPrefs = z.infer<typeof UserPrefsSchema>;

export const BetLegSchema = z.object({
  market: z.string(),
  playerId: z.string().optional(),
  line: z.number(),
  stat: z.string(),
  current: z.number(),
  status: z.enum(["pending", "live", "won", "lost", "push"]),
});
export type BetLeg = z.infer<typeof BetLegSchema>;

export const BetSchema = z.object({
  id: z.string(),
  userId: z.string(),
  roomId: z.string(),
  kind: z.enum(["single", "parlay"]),
  title: z.string(),
  odds: z.string().optional(),
  stake: z.number().optional(), // private to owner
  legs: z.array(BetLegSchema),
  status: z.enum(["pending", "live", "won", "lost", "push"]),
});
export type Bet = z.infer<typeof BetSchema>;

export const ClipTrackSchema = z.object({
  userId: z.string(),
  url: z.string().optional(),
  status: z.enum(["pending", "uploaded", "missing"]),
});

export const ClipSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  momentId: z.string(),
  startFeedTs: z.number(),
  endFeedTs: z.number(),
  tracks: z.array(ClipTrackSchema),
  compositeUrl: z.string().optional(),
  shareCardUrl: z.string().optional(),
  status: z.enum(["capturing", "uploading", "composing", "ready", "failed"]),
});
export type Clip = z.infer<typeof ClipSchema>;

// ---------------------------------------------------------------------------
// §11 Realtime messaging — every event carries feedTs + a server sequence
// ---------------------------------------------------------------------------

const EventEnvelope = z.object({
  feedTs: z.number(),
  seq: z.number().int(),
});

export const RealtimeEventSchema = z.discriminatedUnion("type", [
  EventEnvelope.extend({ type: z.literal("presence.join"), participant: ParticipantSchema }),
  EventEnvelope.extend({ type: z.literal("presence.leave"), userId: z.string() }),
  EventEnvelope.extend({ type: z.literal("presence.update"), participant: ParticipantSchema }),
  EventEnvelope.extend({
    type: z.literal("chat.message"),
    id: z.string(),
    senderId: z.string(),
    senderName: z.string(),
    text: z.string(),
    senderLocalTs: z.number(),
  }),
  EventEnvelope.extend({
    type: z.literal("reaction"),
    emoji: z.string(),
    senderId: z.string(),
  }),
  EventEnvelope.extend({ type: z.literal("pick.opened"), pick: PickSchema }),
  EventEnvelope.extend({ type: z.literal("pick.entry"), entry: PickEntrySchema }),
  EventEnvelope.extend({ type: z.literal("pick.locked"), pickId: z.string() }),
  EventEnvelope.extend({
    type: z.literal("pick.resolved"),
    pickId: z.string(),
    resultOptionId: z.string().optional(),
    resultScore: z.object({ home: z.number(), away: z.number() }).optional(),
  }),
  EventEnvelope.extend({ type: z.literal("bet.updated"), bet: BetSchema }),
  EventEnvelope.extend({ type: z.literal("bet.settled"), betId: z.string(), status: z.enum(["won", "lost", "push"]) }),
  EventEnvelope.extend({ type: z.literal("game.state"), state: GameStateSchema }),
  EventEnvelope.extend({ type: z.literal("game.play"), text: z.string(), state: GameStateSchema }),
  EventEnvelope.extend({
    type: z.literal("moment"),
    momentId: z.string(),
    kind: z.enum(["game_event", "reaction_spike", "manual"]),
    label: z.string(),
  }),
  EventEnvelope.extend({ type: z.literal("sync.updated"), userId: z.string(), offsetMs: z.number() }),
  EventEnvelope.extend({ type: z.literal("room.status"), status: RoomStatus }),
]);
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;

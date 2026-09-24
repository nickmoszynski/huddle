import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, rooms, roomParticipants, picks, pickOptions, pickEntries, users } from "@huddle/db";

/**
 * In-room picks + a room-scoped leaderboard (see DECISIONS.md, "Picks and
 * a leaderboard"). Deliberately the simple version, same spirit as
 * Explore: only `kind: "custom"` / `input: "choice"` picks (a prompt plus
 * 2-4 options) — the schema also supports score-guess picks and
 * feed-driven kinds (next_scorer, drive_result, etc.), neither built here.
 * Only the room's host can create/lock/resolve a pick (role check against
 * `room_participants.role`); any active participant can submit an entry.
 * `locksAtFeedTs` (NOT NULL in the schema, meant for feed-driven auto-lock)
 * is just set to the creation time as a placeholder — this app has no live
 * feed tick to drive it yet, so locking is a manual host action via
 * `status` instead, same as the rest of this pass.
 *
 * The leaderboard here is NOT `season_scores` (that table is group+season
 * scoped, and rooms aren't reliably tied to a group yet) — it's a live
 * SUM(points_awarded) per participant across this room's resolved picks
 * only, computed on read. Good enough for "who's winning tonight"; a real
 * season-long leaderboard is a bigger, separate feature.
 */

interface PickOptionOut {
  id: string;
  label: string;
  votes: number;
  pct: number;
}

async function loadPicksForRoom(roomId: string, myParticipant?: { userId: string | null; guestId: string | null }) {
  const db = getDb();

  const pickRows = await db.select().from(picks).where(eq(picks.roomId, roomId)).orderBy(desc(picks.createdAt));
  if (pickRows.length === 0) return { picks: [], leaderboard: [] };

  const pickIds = pickRows.map((p) => p.id);

  const optionRows = await db
    .select({
      id: pickOptions.id,
      pickId: pickOptions.pickId,
      label: pickOptions.label,
      sortOrder: pickOptions.sortOrder,
    })
    .from(pickOptions)
    .where(sql`${pickOptions.pickId} = ANY(${pickIds})`)
    .orderBy(pickOptions.sortOrder);

  const entryRows = await db
    .select()
    .from(pickEntries)
    .where(sql`${pickEntries.pickId} = ANY(${pickIds})`);

  const out = pickRows.map((pick) => {
    const opts = optionRows.filter((o) => o.pickId === pick.id);
    const entries = entryRows.filter((e) => e.pickId === pick.id);
    const totalVotes = entries.length;

    const options: PickOptionOut[] = opts.map((o) => {
      const votes = entries.filter((e) => e.optionId === o.id).length;
      return { id: o.id, label: o.label, votes, pct: totalVotes ? Math.round((votes / totalVotes) * 100) : 0 };
    });

    const myEntry = myParticipant
      ? entries.find(
          (e) =>
            (myParticipant.userId && e.userId === myParticipant.userId) ||
            (myParticipant.guestId && e.guestId === myParticipant.guestId)
        )
      : undefined;

    return {
      id: pick.id,
      prompt: pick.prompt,
      status: pick.status,
      points: pick.points,
      resultOptionId: pick.resultOptionId,
      options,
      totalVotes,
      myOptionId: myEntry?.optionId ?? null,
    };
  });

  // Room-scoped leaderboard: sum points_awarded across this room's resolved
  // picks, grouped by whoever earned them (real user or guest — a guest's
  // points just don't survive past their guest_sessions row's lifetime,
  // same as everything else about a guest identity in this app).
  const scored = entryRows.filter((e) => e.pointsAwarded !== null);
  const totals = new Map<string, { key: string; name: string; points: number }>();
  for (const e of scored) {
    const key = e.userId ? `u:${e.userId}` : `g:${e.guestId}`;
    const existing = totals.get(key);
    if (existing) {
      existing.points += e.pointsAwarded ?? 0;
    } else {
      // Name filled in below once we know which are real users.
      totals.set(key, { key, name: "", points: e.pointsAwarded ?? 0 });
    }
  }

  if (totals.size > 0) {
    const userIds = Array.from(totals.keys())
      .filter((k) => k.startsWith("u:"))
      .map((k) => k.slice(2));
    const userRows = userIds.length
      ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(sql`${users.id} = ANY(${userIds})`)
      : [];
    const nameByUserId = new Map(userRows.map((u) => [u.id, u.displayName]));

    // Fall back to whatever display name shows up in this room's roster for
    // guests (and for a user row that's somehow gone) rather than leaving a
    // leaderboard row blank.
    const participantRows = await db
      .select({ userId: roomParticipants.userId, guestId: roomParticipants.guestId, displayName: roomParticipants.displayName })
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, roomId));
    const nameByGuestId = new Map(participantRows.filter((p) => p.guestId).map((p) => [p.guestId as string, p.displayName]));

    for (const [key, row] of totals) {
      if (key.startsWith("u:")) {
        row.name = nameByUserId.get(key.slice(2)) ?? "Someone";
      } else {
        row.name = nameByGuestId.get(key.slice(2)) ?? "Someone";
      }
    }
  }

  const leaderboard = Array.from(totals.values()).sort((a, b) => b.points - a.points);

  return { picks: out, leaderboard };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const myParticipantId = req.nextUrl.searchParams.get("participantId");

  try {
    const db = getDb();
    const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    let myParticipant: { userId: string | null; guestId: string | null } | undefined;
    if (myParticipantId) {
      const [row] = await db
        .select({ userId: roomParticipants.userId, guestId: roomParticipants.guestId })
        .from(roomParticipants)
        .where(eq(roomParticipants.id, myParticipantId))
        .limit(1);
      myParticipant = row;
    }

    const result = await loadPicksForRoom(room.id, myParticipant);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/rooms/[code]/picks] failed to load picks", err);
    return NextResponse.json({ error: "Could not load picks." }, { status: 500 });
  }
}

const createSchema = z.object({
  participantId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(140),
  options: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { participantId, prompt, options } = parsed.data;

  try {
    const db = getDb();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const [participant] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.id, participantId), eq(roomParticipants.roomId, room.id), isNull(roomParticipants.leftAt)))
      .limit(1);
    if (!participant) {
      return NextResponse.json({ error: "You're not an active participant in this room." }, { status: 403 });
    }
    if (participant.role !== "host") {
      return NextResponse.json({ error: "Only the host can start a pick." }, { status: 403 });
    }

    const [pick] = await db
      .insert(picks)
      .values({
        roomId: room.id,
        eventId: room.eventId,
        kind: "custom",
        input: "choice",
        prompt,
        locksAtFeedTs: new Date(), // no live feed tick to drive this yet — see doc comment
        createdBy: participant.userId ?? undefined,
      })
      .returning();
    if (!pick) throw new Error("Insert into picks returned no row.");

    await db.insert(pickOptions).values(options.map((label, i) => ({ pickId: pick.id, label, sortOrder: i })));

    return NextResponse.json({ pickId: pick.id });
  } catch (err) {
    console.error("[api/rooms/[code]/picks] failed to create pick", err);
    return NextResponse.json({ error: "Could not start that pick." }, { status: 500 });
  }
}

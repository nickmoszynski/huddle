import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, rooms, events, users, roomParticipants } from "@huddle/db";
import { generateUniqueRoomCode } from "@/lib/roomCode.server";

/**
 * Create a room, for real, in the actual database — see DECISIONS.md
 * ("Real rooms via Supabase" entry). Rooms require a host with a `users`
 * row (rooms.host_id is NOT NULL by design — packages/db/src/schema.ts),
 * so the client signs in anonymously via Supabase Auth first (no
 * email/password) and passes that auth user id here; this route upserts
 * the lightweight `users` row for them. Joining a room (see
 * app/api/rooms/[code]/route.ts) doesn't need any of this — guests join
 * via `guest_sessions` instead, no auth required.
 */

const gameSchema = z.object({
  providerEventId: z.string().min(1),
  homeAbbr: z.string().min(1),
  awayAbbr: z.string().min(1),
  homeName: z.string().min(1),
  awayName: z.string().min(1),
  startTimeISO: z.string().min(1),
  // Which schedule source this came from ("nfl" | "mlb" | "wwe" | ...)
  // and a display-label override for a non-team event like "WWE Raw" —
  // see DECISIONS.md, "Explore: browse by league".
  league: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
});

const bodySchema = z.object({
  authUserId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(40),
  privacy: z.enum(["private", "fof", "public"]).optional(),
  game: gameSchema.optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { authUserId, displayName, game, privacy } = parsed.data;

  try {
    const db = getDb();

    // 1. Find or create the event this room is tied to.
    let eventRow = game
      ? (await db.select().from(events).where(eq(events.providerEventId, game.providerEventId)).limit(1))[0]
      : undefined;
    if (!eventRow) {
      const [inserted] = await db
        .insert(events)
        .values(
          game
            ? {
                providerEventId: game.providerEventId,
                homeAbbr: game.homeAbbr,
                awayAbbr: game.awayAbbr,
                homeName: game.homeName,
                awayName: game.awayName,
                startTime: new Date(game.startTimeISO),
                league: game.league,
                title: game.title,
              }
            : {
                // No specific game — an ad hoc watch party. Each one gets
                // its own throwaway event row rather than sharing one.
                providerEventId: `manual:${crypto.randomUUID()}`,
                homeAbbr: "US",
                awayAbbr: "US",
                homeName: "Watch Party",
                awayName: "Watch Party",
                startTime: new Date(),
                status: "live",
              }
        )
        .returning();
      if (!inserted) throw new Error("Insert into events returned no row.");
      eventRow = inserted;
    }

    // 2. Find or create the host's lightweight user row.
    let userRow = (await db.select().from(users).where(eq(users.authId, authUserId)).limit(1))[0];
    if (!userRow) {
      const [inserted] = await db.insert(users).values({ authId: authUserId, displayName }).returning();
      if (!inserted) throw new Error("Insert into users returned no row.");
      userRow = inserted;
    }

    // 3. Create the room itself. Status starts at "live", not the enum's
    // default "waiting" — there's no "schedule a room for later" flow
    // yet (see DECISIONS.md, "Fix: rooms never actually went live"): the
    // host is seated as a participant in the very next step and lands
    // straight in the live room screen, so "waiting" was dead state that
    // nothing ever advanced out of, and Explore's "Live Now" tab (which
    // filters on this column) could never show anything.
    const code = await generateUniqueRoomCode();
    const roomName = game ? game.title ?? `${game.awayName} @ ${game.homeName}` : "Watch Party";
    const [room] = await db
      .insert(rooms)
      .values({
        code,
        name: roomName,
        eventId: eventRow.id,
        hostId: userRow.id,
        privacy: privacy ?? "private",
        status: "live",
      })
      .returning();
    if (!room) throw new Error("Insert into rooms returned no row.");

    // 4. Seat the host as the first participant. No media pipeline exists
    // yet (LiveKit isn't wired up — DECISIONS.md), so mic/cam start off.
    const [participant] = await db
      .insert(roomParticipants)
      .values({
        roomId: room.id,
        userId: userRow.id,
        displayName,
        role: "host",
        micOn: false,
        camOn: false,
      })
      .returning();
    if (!participant) throw new Error("Insert into room_participants returned no row.");

    return NextResponse.json({ code: room.code, participantId: participant.id });
  } catch (err) {
    console.error("[api/rooms] failed to create room", err);
    return NextResponse.json({ error: "Could not create the room." }, { status: 500 });
  }
}

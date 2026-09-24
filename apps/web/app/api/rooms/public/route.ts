import "server-only";
import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb, rooms, events, roomParticipants } from "@huddle/db";

/**
 * GET /api/rooms/public — Explore's browse list: currently-joinable public
 * rooms (`rooms.privacy = 'public'`, not yet ended). No auth required —
 * browsing and joining stays as frictionless as the code-based join flow;
 * this just gives you a code to hand to /join instead of needing one
 * texted to you. Deliberately the simple version: the schema also has a
 * fuller "creator rooms" system (public_rooms_meta — tags, moderators,
 * premium; featured_slots for rotating a spotlighted room) that nothing
 * populates yet, so this route ignores both tables rather than building
 * against data that doesn't exist. Revisit once that's worth the surface
 * area — see DECISIONS.md.
 *
 * Two additions on top of the original version (see DECISIONS.md,
 * "Explore: a unified browse screen"): `watching`, a live count of active
 * participants (answers Mo's "how many people are actually in there"),
 * and `event.providerEventId`, which Explore uses to nest a room under
 * its matching game card from /api/games instead of showing two
 * disconnected lists — the two share the same id whenever a room was
 * started from a game card (see app/create/page.tsx).
 */
export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({ room: rooms, event: events })
      .from(rooms)
      .innerJoin(events, eq(rooms.eventId, events.id))
      .where(and(eq(rooms.privacy, "public"), ne(rooms.status, "ended")))
      .orderBy(desc(rooms.createdAt))
      .limit(30);

    const roomIds = rows.map((r) => r.room.id);
    const counts = roomIds.length
      ? await db
          .select({ roomId: roomParticipants.roomId, count: sql<number>`count(*)::int` })
          .from(roomParticipants)
          .where(and(inArray(roomParticipants.roomId, roomIds), isNull(roomParticipants.leftAt)))
          .groupBy(roomParticipants.roomId)
      : [];
    const countByRoom = new Map(counts.map((c) => [c.roomId, Number(c.count)]));

    return NextResponse.json({
      rooms: rows.map(({ room, event }) => ({
        code: room.code,
        name: room.name,
        status: room.status,
        watching: countByRoom.get(room.id) ?? 0,
        event: {
          providerEventId: event.providerEventId,
          homeName: event.homeName,
          awayName: event.awayName,
          startTimeISO: event.startTime.toISOString(),
          league: event.league,
          title: event.title,
        },
      })),
    });
  } catch (err) {
    console.error("[api/rooms/public] failed to list public rooms", err);
    return NextResponse.json({ error: "Could not load public rooms." }, { status: 500 });
  }
}

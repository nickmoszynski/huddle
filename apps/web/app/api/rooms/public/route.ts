import "server-only";
import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb, rooms, events } from "@huddle/db";

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

    return NextResponse.json({
      rooms: rows.map(({ room, event }) => ({
        code: room.code,
        name: room.name,
        status: room.status,
        event: { homeName: event.homeName, awayName: event.awayName, startTimeISO: event.startTime.toISOString() },
      })),
    });
  } catch (err) {
    console.error("[api/rooms/public] failed to list public rooms", err);
    return NextResponse.json({ error: "Could not load public rooms." }, { status: 500 });
  }
}

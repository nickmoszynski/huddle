import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, rooms, events, guestSessions, roomParticipants } from "@huddle/db";

/** GET: look up a room by code, with its event and current (active) participants. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();

  try {
    const db = getDb();
    const [row] = await db
      .select({ room: rooms, event: events })
      .from(rooms)
      .innerJoin(events, eq(rooms.eventId, events.id))
      .where(eq(rooms.code, code))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const participants = await db
      .select({
        id: roomParticipants.id,
        displayName: roomParticipants.displayName,
        role: roomParticipants.role,
        micOn: roomParticipants.micOn,
        camOn: roomParticipants.camOn,
        conn: roomParticipants.conn,
      })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, row.room.id), isNull(roomParticipants.leftAt)));

    return NextResponse.json({
      room: {
        id: row.room.id,
        code: row.room.code,
        name: row.room.name,
        status: row.room.status,
        event: {
          homeName: row.event.homeName,
          awayName: row.event.awayName,
          startTimeISO: row.event.startTime.toISOString(),
        },
      },
      participants,
    });
  } catch (err) {
    console.error("[api/rooms/[code]] failed to fetch room", err);
    return NextResponse.json({ error: "Could not load the room." }, { status: 500 });
  }
}

const joinSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
});

/**
 * POST: join a room as a guest. No auth needed — this is the frictionless
 * path (see DECISIONS.md): a `guest_sessions` row plus a `room_participants`
 * row, matching the schema's guest/user dual-identity pattern used
 * throughout (messages, picks, etc. all support a guest sender the same way).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const json = await req.json().catch(() => null);
  const parsed = joinSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { displayName } = parsed.data;

  try {
    const db = getDb();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [guest] = await db.insert(guestSessions).values({ displayName, expiresAt }).returning();
    if (!guest) throw new Error("Insert into guest_sessions returned no row.");

    const [participant] = await db
      .insert(roomParticipants)
      .values({
        roomId: room.id,
        guestId: guest.id,
        displayName,
        role: "guest",
        micOn: false,
        camOn: false,
      })
      .returning();
    if (!participant) throw new Error("Insert into room_participants returned no row.");

    return NextResponse.json({ code: room.code, participantId: participant.id });
  } catch (err) {
    console.error("[api/rooms/[code]] failed to join room", err);
    return NextResponse.json({ error: "Could not join the room." }, { status: 500 });
  }
}

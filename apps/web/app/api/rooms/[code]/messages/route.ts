import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, rooms, roomParticipants, messages } from "@huddle/db";

/**
 * In-room chat — `messages` has existed in the schema since Phase 0–1
 * (senderId/senderGuestId dual-identity, same pattern as room_participants),
 * this is just the first thing to actually read/write it. See DECISIONS.md.
 *
 * GET: the room's message history (last 200, oldest first — a watch party
 * chat doesn't need real pagination yet).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();

  try {
    const db = getDb();
    const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const rows = await db
      .select({
        id: messages.id,
        senderName: messages.senderName,
        senderId: messages.senderId,
        senderGuestId: messages.senderGuestId,
        text: messages.text,
        kind: messages.kind,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.roomId, room.id))
      .orderBy(asc(messages.createdAt))
      .limit(200);

    return NextResponse.json({
      messages: rows.map((m) => ({
        id: m.id,
        senderName: m.senderName,
        text: m.text,
        kind: m.kind,
        createdAtISO: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[api/rooms/[code]/messages] failed to fetch messages", err);
    return NextResponse.json({ error: "Could not load chat." }, { status: 500 });
  }
}

/**
 * POST: send a message. Identifies the sender by `participantId` — same
 * trust model as /api/rooms/[code]/state and /leave (no server-verified
 * session yet). Resolves the active room_participants row to fill in
 * senderId (real user) or senderGuestId (guest), matching whichever one
 * they actually have set, and denormalizes senderName the same way that
 * row itself does, so a chat message still reads right even if someone
 * later changes their display name.
 */
const bodySchema = z.object({
  participantId: z.string().uuid(),
  text: z.string().trim().min(1).max(1000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { participantId, text } = parsed.data;

  try {
    const db = getDb();
    const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const [participant] = await db
      .select()
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.id, participantId),
          eq(roomParticipants.roomId, room.id),
          isNull(roomParticipants.leftAt)
        )
      )
      .limit(1);
    if (!participant) {
      return NextResponse.json({ error: "You're not an active participant in this room." }, { status: 403 });
    }

    const [inserted] = await db
      .insert(messages)
      .values({
        roomId: room.id,
        senderId: participant.userId ?? undefined,
        senderGuestId: participant.guestId ?? undefined,
        senderName: participant.displayName,
        text,
        kind: "user",
      })
      .returning();
    if (!inserted) throw new Error("Insert into messages returned no row.");

    return NextResponse.json({
      message: {
        id: inserted.id,
        senderName: inserted.senderName,
        text: inserted.text,
        kind: inserted.kind,
        createdAtISO: inserted.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[api/rooms/[code]/messages] failed to send message", err);
    return NextResponse.json({ error: "Could not send that message." }, { status: 500 });
  }
}

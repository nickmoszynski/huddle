import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, rooms, roomParticipants, picks } from "@huddle/db";

/** POST — host locks a pick: no new entries accepted, but not yet resolved. */
const bodySchema = z.object({ participantId: z.string().uuid() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; pickId: string }> }
) {
  const { code: rawCode, pickId } = await params;
  const code = rawCode.toUpperCase();
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const [participant] = await db
      .select({ role: roomParticipants.role })
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.id, parsed.data.participantId),
          eq(roomParticipants.roomId, room.id),
          isNull(roomParticipants.leftAt)
        )
      )
      .limit(1);
    if (!participant || participant.role !== "host") {
      return NextResponse.json({ error: "Only the host can lock a pick." }, { status: 403 });
    }

    const [pick] = await db.select({ status: picks.status }).from(picks).where(and(eq(picks.id, pickId), eq(picks.roomId, room.id))).limit(1);
    if (!pick) {
      return NextResponse.json({ error: "Pick not found." }, { status: 404 });
    }
    if (pick.status !== "open") {
      return NextResponse.json({ error: "This pick isn't open." }, { status: 409 });
    }

    await db.update(picks).set({ status: "locked" }).where(eq(picks.id, pickId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/rooms/[code]/picks/[pickId]/lock] failed to lock pick", err);
    return NextResponse.json({ error: "Could not lock that pick." }, { status: 500 });
  }
}

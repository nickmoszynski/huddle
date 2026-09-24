import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, rooms, roomParticipants, picks, pickOptions, pickEntries } from "@huddle/db";

/**
 * POST — host marks the correct answer. Awards `pick.points` to every
 * entry that matched, 0 to everyone else; feeds the room-scoped
 * leaderboard in GET /api/rooms/[code]/picks (see that route's doc
 * comment — not `season_scores`, which is group+season scoped).
 */
const bodySchema = z.object({
  participantId: z.string().uuid(),
  resultOptionId: z.string().uuid(),
});

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
  const { participantId, resultOptionId } = parsed.data;

  try {
    const db = getDb();
    const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const [participant] = await db
      .select({ role: roomParticipants.role })
      .from(roomParticipants)
      .where(and(eq(roomParticipants.id, participantId), eq(roomParticipants.roomId, room.id), isNull(roomParticipants.leftAt)))
      .limit(1);
    if (!participant || participant.role !== "host") {
      return NextResponse.json({ error: "Only the host can resolve a pick." }, { status: 403 });
    }

    const [pick] = await db.select().from(picks).where(and(eq(picks.id, pickId), eq(picks.roomId, room.id))).limit(1);
    if (!pick) {
      return NextResponse.json({ error: "Pick not found." }, { status: 404 });
    }
    if (pick.status === "resolved" || pick.status === "void") {
      return NextResponse.json({ error: "This pick is already settled." }, { status: 409 });
    }

    const [option] = await db
      .select({ id: pickOptions.id })
      .from(pickOptions)
      .where(and(eq(pickOptions.id, resultOptionId), eq(pickOptions.pickId, pickId)))
      .limit(1);
    if (!option) {
      return NextResponse.json({ error: "Invalid option." }, { status: 400 });
    }

    await db.update(picks).set({ status: "resolved", resultOptionId }).where(eq(picks.id, pickId));

    const entries = await db.select().from(pickEntries).where(eq(pickEntries.pickId, pickId));
    for (const entry of entries) {
      const pointsAwarded = entry.optionId === resultOptionId ? pick.points : 0;
      await db.update(pickEntries).set({ pointsAwarded }).where(eq(pickEntries.id, entry.id));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/rooms/[code]/picks/[pickId]/resolve] failed to resolve pick", err);
    return NextResponse.json({ error: "Could not resolve that pick." }, { status: 500 });
  }
}

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, rooms, roomParticipants, picks, pickOptions, pickEntries } from "@huddle/db";

/**
 * POST — submit or change my answer to a pick, while it's still open.
 * "One entry per participant per pick" isn't fully enforced by the schema's
 * own unique index (`pick_entries_pick_user_idx` only covers `user_id`, not
 * `guest_id` — a pre-existing gap, not introduced here), so this checks for
 * an existing row by whichever identity the participant actually has
 * (userId or guestId) and updates it in place rather than relying on the
 * DB to reject a duplicate.
 */
const bodySchema = z.object({
  participantId: z.string().uuid(),
  optionId: z.string().uuid(),
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
  const { participantId, optionId } = parsed.data;

  try {
    const db = getDb();
    const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const [pick] = await db.select().from(picks).where(and(eq(picks.id, pickId), eq(picks.roomId, room.id))).limit(1);
    if (!pick) {
      return NextResponse.json({ error: "Pick not found." }, { status: 404 });
    }
    if (pick.status !== "open") {
      return NextResponse.json({ error: "This pick isn't open anymore." }, { status: 409 });
    }

    const [option] = await db
      .select({ id: pickOptions.id })
      .from(pickOptions)
      .where(and(eq(pickOptions.id, optionId), eq(pickOptions.pickId, pickId)))
      .limit(1);
    if (!option) {
      return NextResponse.json({ error: "Invalid option." }, { status: 400 });
    }

    const [participant] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.id, participantId), eq(roomParticipants.roomId, room.id), isNull(roomParticipants.leftAt)))
      .limit(1);
    if (!participant) {
      return NextResponse.json({ error: "You're not an active participant in this room." }, { status: 403 });
    }

    const [existing] = await db
      .select()
      .from(pickEntries)
      .where(
        and(
          eq(pickEntries.pickId, pickId),
          participant.userId ? eq(pickEntries.userId, participant.userId) : eq(pickEntries.guestId, participant.guestId as string)
        )
      )
      .limit(1);

    if (existing) {
      await db.update(pickEntries).set({ optionId }).where(eq(pickEntries.id, existing.id));
    } else {
      await db.insert(pickEntries).values({
        pickId,
        userId: participant.userId ?? undefined,
        guestId: participant.guestId ?? undefined,
        optionId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/rooms/[code]/picks/[pickId]/entry] failed to save entry", err);
    return NextResponse.json({ error: "Could not save your pick." }, { status: 500 });
  }
}

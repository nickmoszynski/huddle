import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, rooms, roomParticipants } from "@huddle/db";

/**
 * POST: a participant reports their own mic/camera on-off state (driven by
 * the LiveKit toggle buttons on the room screen — see DECISIONS.md, "LiveKit
 * for real video/audio"). This is the ONLY write path for `mic_on`/`cam_on`;
 * LiveKit itself has no idea this database exists. Writing here is what
 * makes the change visible to everyone else in the room: it's a normal
 * UPDATE on `room_participants`, which Realtime (migration 0002) already
 * broadcasts to every subscribed client, so no separate signaling is needed
 * on top of what joins/leaves already use.
 *
 * Deliberately trusts the caller's own participantId the same way
 * /api/rooms/[code]/leave already does (no session token exists yet for
 * guests) — worth revisiting alongside the RLS hardening pass.
 */

const bodySchema = z.object({
  participantId: z.string().uuid(),
  micOn: z.boolean().optional(),
  camOn: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { participantId, micOn, camOn } = parsed.data;
  if (micOn === undefined && camOn === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const patch: Partial<typeof roomParticipants.$inferInsert> = {};
    if (micOn !== undefined) patch.micOn = micOn;
    if (camOn !== undefined) patch.camOn = camOn;

    const [updated] = await db
      .update(roomParticipants)
      .set(patch)
      .where(
        and(
          eq(roomParticipants.id, participantId),
          eq(roomParticipants.roomId, room.id),
          isNull(roomParticipants.leftAt)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "You're not an active participant in this room." }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/rooms/[code]/state] failed to update participant state", err);
    return NextResponse.json({ error: "Could not update your mic/camera state." }, { status: 500 });
  }
}

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, roomParticipants } from "@huddle/db";

const bodySchema = z.object({ participantId: z.string().uuid() });

/** Marks a participant as having left (room_participants.left_at). */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const db = getDb();
    await db
      .update(roomParticipants)
      .set({ leftAt: new Date() })
      .where(eq(roomParticipants.id, parsed.data.participantId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/rooms/[code]/leave] failed to mark participant left", err);
    return NextResponse.json({ error: "Could not leave the room." }, { status: 500 });
  }
}

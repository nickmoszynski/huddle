import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { AccessToken } from "livekit-server-sdk";
import { getDb, rooms, roomParticipants } from "@huddle/db";

/**
 * Mints a LiveKit access token for a participant who has already joined a
 * room via /api/rooms (POST) or /api/rooms/[code] (POST) — see DECISIONS.md,
 * "LiveKit for real video/audio". `participantId` doubles as the identity
 * this app already uses everywhere else (the ?pid= query param, the
 * room_participants row) and as the LiveKit room participant identity, so
 * there's one id per person per room, not two.
 *
 * This route checks the participant row actually exists, is still active
 * (hasn't left), and belongs to the room named by `roomCode`, before
 * minting anything — without that check anyone could mint a token to join
 * any room's LiveKit session by guessing a room code, bypassing the
 * (admittedly thin) participant-tracking this app already has.
 */

const bodySchema = z.object({
  roomCode: z.string().min(1),
  participantId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const roomCode = parsed.data.roomCode.toUpperCase();
  const { participantId } = parsed.data;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !serverUrl) {
    return NextResponse.json({ error: "Video/audio isn't configured on this server yet." }, { status: 500 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ participant: roomParticipants, room: rooms })
      .from(roomParticipants)
      .innerJoin(rooms, eq(roomParticipants.roomId, rooms.id))
      .where(
        and(
          eq(roomParticipants.id, participantId),
          eq(rooms.code, roomCode),
          isNull(roomParticipants.leftAt)
        )
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "You're not an active participant in this room." }, { status: 403 });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: row.participant.id,
      name: row.participant.displayName,
      ttl: "4h",
    });
    token.addGrant({
      room: roomCode,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    return NextResponse.json({ token: await token.toJwt(), serverUrl });
  } catch (err) {
    console.error("[api/livekit/token] failed to mint token", err);
    return NextResponse.json({ error: "Could not start video/audio." }, { status: 500 });
  }
}

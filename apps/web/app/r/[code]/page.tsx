"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Pill, VideoTile } from "@huddle/ui";
import { useMockRoomStore } from "@/lib/mockRooms";

/**
 * The room shell. Phase 2 routing/UI proof — real video (LiveKit), chat and
 * live scoring (Supabase Realtime + the feed worker) aren't wired up yet,
 * see DECISIONS.md, so this deliberately doesn't pretend those work. It's
 * here so the room screen exists as a real route with a real code, ready
 * for those pieces to be dropped in.
 */
export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const room = useMockRoomStore((s) => s.rooms[code]);
  const guestName = useMockRoomStore((s) => s.guestName);
  const ensureRoom = useMockRoomStore((s) => s.ensureRoom);
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    if (!room) {
      ensureRoom(code, guestName ?? "You");
    }
  }, [room, code, guestName, ensureRoom]);

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/join?code=${code}`);
  }, [code]);

  const displayName = guestName ?? room?.hostName ?? "You";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (permissions, older browser) — the code
      // is already visible on screen, so this is a soft failure.
    }
  }

  function handleLeave() {
    router.push("/");
  }

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-10 pt-14">
      <div className="flex items-center justify-between">
        <button onClick={handleLeave} className="font-ui text-[13px] font-semibold text-mu">
          &larr; Leave
        </button>
        <Pill tone="accent">{code}</Pill>
      </div>

      {room?.gameLabel && <p className="mt-4 font-ui text-[15px] font-semibold text-tx">{room.gameLabel}</p>}

      <Button variant="secondary" fullWidth className="mt-4" onClick={handleCopy}>
        {copied ? "Invite link copied" : "Copy invite link"}
      </Button>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <VideoTile name={displayName} micOn={false} camOn={false} conn="good" />
      </div>

      <div className="mt-8 rounded-tile border border-line bg-s1 p-4">
        <Pill tone="neutral">Preview</Pill>
        <p className="mt-2 font-ui text-[13px] text-mu">
          Video, chat, and live scores connect here once LiveKit and Supabase Realtime are wired up. Right now this
          room only exists on this device.
        </p>
      </div>

      <Button variant="danger" fullWidth className="mt-8" onClick={handleLeave}>
        Leave room
      </Button>
    </div>
  );
}

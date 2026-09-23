"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@huddle/ui";
import { useMockRoomStore } from "@/lib/mockRooms";

/**
 * Join a room by code. Phase 2 routing/UI shell — see DECISIONS.md: without
 * Supabase Realtime, this only works if the room was created on this same
 * device/browser; it can't reach a room someone else actually started.
 */
export default function JoinRoomPage() {
  return (
    <Suspense fallback={null}>
      <JoinRoomForm />
    </Suspense>
  );
}

function JoinRoomForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get("code") ?? "";

  const ensureRoom = useMockRoomStore((s) => s.ensureRoom);
  const storedName = useMockRoomStore((s) => s.guestName);
  const [name, setName] = useState(storedName ?? "");
  const [code, setCode] = useState(prefillCode.toUpperCase());

  function handleJoin() {
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) return;
    const guestName = name.trim() || "You";
    ensureRoom(roomCode, guestName);
    router.push(`/r/${roomCode}`);
  }

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-10 pt-14">
      <button onClick={() => router.back()} className="mb-6 self-start font-ui text-[13px] font-semibold text-mu">
        &larr; Back
      </button>

      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Join a room</h1>

      <label className="mt-8 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu" htmlFor="guest-name">
        Your name
      </label>
      <input
        id="guest-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nick"
        maxLength={40}
        className="mt-2 h-[52px] rounded-control border border-line2 bg-s2 px-4 font-ui text-[15px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
      />

      <label className="mt-6 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu" htmlFor="room-code">
        Room code
      </label>
      <input
        id="room-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABC123"
        maxLength={8}
        className="mt-2 h-[52px] rounded-control border border-line2 bg-s2 px-4 font-ui text-[20px] font-bold uppercase tracking-[0.2em] text-tx outline-none placeholder:font-bold placeholder:tracking-[0.2em] placeholder:text-mu2 focus:border-ac"
      />

      <Button variant="primary" fullWidth className="mt-8" onClick={handleJoin} disabled={!code.trim()}>
        Join room
      </Button>

      <p className="mt-4 font-ui text-[12px] text-mu2">
        Only works for rooms created on this device for now — joining a friend&apos;s real room needs Supabase
        Realtime, which isn&apos;t wired up yet.
      </p>
    </div>
  );
}

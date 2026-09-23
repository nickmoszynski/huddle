"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@huddle/ui";
import { useMockRoomStore } from "@/lib/mockRooms";

/**
 * Start a room. Phase 2 routing/UI shell — see DECISIONS.md: there's no
 * Supabase Auth/Realtime yet, so this generates a room code held only in
 * this browser (via zustand + localStorage), not a real backend room.
 */
export default function CreateRoomPage() {
  return (
    <Suspense fallback={null}>
      <CreateRoomForm />
    </Suspense>
  );
}

function CreateRoomForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameLabel = searchParams.get("game") ?? undefined;

  const createRoom = useMockRoomStore((s) => s.createRoom);
  const storedName = useMockRoomStore((s) => s.guestName);
  const [name, setName] = useState(storedName ?? "");

  function handleCreate() {
    const hostName = name.trim() || "You";
    const code = createRoom({ hostName, gameLabel });
    router.push(`/r/${code}`);
  }

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-10 pt-14">
      <button onClick={() => router.back()} className="mb-6 self-start font-ui text-[13px] font-semibold text-mu">
        &larr; Back
      </button>

      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Start a room</h1>
      {gameLabel && <p className="mt-2 font-ui text-[14px] text-mu">{gameLabel}</p>}

      <label className="mt-8 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu" htmlFor="host-name">
        Your name
      </label>
      <input
        id="host-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nick"
        maxLength={40}
        className="mt-2 h-[52px] rounded-control border border-line2 bg-s2 px-4 font-ui text-[15px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
      />

      <Button variant="primary" fullWidth className="mt-8" onClick={handleCreate}>
        Create room
      </Button>

      <p className="mt-4 font-ui text-[12px] text-mu2">
        This creates a room code on this device. Real cross-device syncing needs Supabase Realtime, which isn&apos;t
        wired up yet.
      </p>
    </div>
  );
}

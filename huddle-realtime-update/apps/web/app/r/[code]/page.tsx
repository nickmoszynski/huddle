"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Pill, VideoTile } from "@huddle/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

/**
 * The room screen — backed by the real database now (see DECISIONS.md,
 * "Real rooms via Supabase"). Live updates come from Supabase Realtime
 * (see DECISIONS.md, "Realtime for room_participants"): subscribed to
 * postgres_changes on `room_participants` for this room's id, and any
 * insert/update/delete triggers an immediate refetch of the room query.
 * `refetchInterval` below is kept as a slow safety-net poll (not the
 * primary update path anymore) in case a Realtime subscription silently
 * drops — belt and suspenders, not a second copy of the same mechanism.
 * Video, audio, and chat still aren't wired up (LiveKit isn't connected
 * yet) — this deliberately says so rather than faking a live multi-person
 * call.
 */

interface RoomParticipant {
  id: string;
  displayName: string;
  role: string;
  micOn: boolean;
  camOn: boolean;
  conn: "good" | "poor" | "reconnecting";
}

interface RoomResponse {
  room: {
    id: string;
    code: string;
    name: string;
    status: string;
    event: { homeName: string; awayName: string; startTimeISO: string };
  };
  participants: RoomParticipant[];
}

async function fetchRoom(code: string): Promise<RoomResponse> {
  const res = await fetch(`/api/rooms/${code}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Could not load the room.");
  return data;
}

export default function RoomPage() {
  return (
    <Suspense fallback={null}>
      <RoomView />
    </Suspense>
  );
}

function RoomView() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const code = (params.code ?? "").toUpperCase();
  const myParticipantId = searchParams.get("pid");

  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["room", code],
    queryFn: () => fetchRoom(code),
    refetchInterval: 20000, // safety-net poll — Realtime (below) is the primary path
    retry: false,
  });

  const roomId = data?.room.id;

  // Live updates: subscribe to changes on this room's participants and
  // refetch immediately when someone joins/leaves, instead of waiting on
  // the slow poll above. Requires the "Public read (realtime)" policy from
  // migration 0002 — without it Realtime silently delivers nothing.
  useEffect(() => {
    if (!roomId) return;

    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return; // Supabase env vars missing — safety-net poll still works
    }

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["room", code] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, code, queryClient]);

  async function handleCopy() {
    try {
      const url = `${window.location.origin}/join?code=${code}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the code is already visible on screen.
    }
  }

  async function handleLeave() {
    if (myParticipantId) {
      setLeaving(true);
      try {
        await fetch(`/api/rooms/${code}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: myParticipantId }),
        });
      } catch {
        // Best-effort — still leave locally even if this fails.
      }
    }
    router.push("/");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-gutter">
        <p className="font-ui text-[14px] text-mu">Loading room…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-gutter text-center">
        <p className="font-ui text-[15px] font-semibold text-tx">Room not found</p>
        <p className="font-ui text-[13px] text-mu">
          {error instanceof Error ? error.message : "That room code doesn't exist."}
        </p>
        <Button variant="secondary" onClick={() => router.push("/")}>
          Back home
        </Button>
      </div>
    );
  }

  const { room, participants } = data;

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-10 pt-14">
      <div className="flex items-center justify-between">
        <button onClick={handleLeave} className="font-ui text-[13px] font-semibold text-mu" disabled={leaving}>
          &larr; Leave
        </button>
        <Pill tone="accent">{code}</Pill>
      </div>

      <p className="mt-4 font-ui text-[15px] font-semibold text-tx">{room.name}</p>

      {!myParticipantId && (
        <div className="mt-4 rounded-tile border border-line bg-s1 p-4">
          <p className="font-ui text-[13px] text-mu">You're viewing this room without having joined it.</p>
          <Button
            variant="primary"
            fullWidth
            className="mt-3 h-11"
            onClick={() => router.push(`/join?code=${code}`)}
          >
            Join this room
          </Button>
        </div>
      )}

      <Button variant="secondary" fullWidth className="mt-4" onClick={handleCopy}>
        {copied ? "Invite link copied" : "Copy invite link"}
      </Button>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {participants.map((p) => (
          <VideoTile key={p.id} name={p.displayName} micOn={p.micOn} camOn={p.camOn} conn={p.conn} />
        ))}
      </div>

      <div className="mt-8 rounded-tile border border-line bg-s1 p-4">
        <Pill tone="neutral">Preview</Pill>
        <p className="mt-2 font-ui text-[13px] text-mu">
          This room is real — anyone with the code {code} can join it from any device, and the list above updates
          live. Video, audio, and chat aren't connected yet (LiveKit isn't wired up), so mic/camera stay off for now.
        </p>
      </div>

      <Button variant="danger" fullWidth className="mt-8" onClick={handleLeave} disabled={leaving}>
        Leave room
      </Button>
    </div>
  );
}

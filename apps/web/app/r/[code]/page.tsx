"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Track } from "livekit-client";
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useLocalParticipant, useTracks } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
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
 *
 * Video and audio are real now too (see DECISIONS.md, "LiveKit for real
 * video/audio"): once a participant has joined (myParticipantId is set),
 * this fetches a LiveKit token and wraps the participant grid in a
 * <LiveKitRoom>. Nothing auto-publishes on connect (audio/video both
 * `false`) — camera/mic only turn on when the person taps the toggle
 * buttons, matching the `mic_on`/`cam_on` defaulting to false at join.
 * Toggling calls LiveKit directly (so this device reacts instantly) AND
 * POSTs to /api/rooms/[code]/state (so everyone else's tile updates via
 * the same Realtime path joins/leaves already use) — two separate systems,
 * kept in sync by this one call site rather than by LiveKit and Postgres
 * somehow agreeing on their own. Chat still isn't wired up.
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

interface LiveKitTokenResponse {
  token: string;
  serverUrl: string;
}

async function fetchRoom(code: string): Promise<RoomResponse> {
  const res = await fetch(`/api/rooms/${code}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Could not load the room.");
  return data;
}

async function fetchLiveKitToken(code: string, participantId: string): Promise<LiveKitTokenResponse> {
  const res = await fetch("/api/livekit/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: code, participantId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Could not start video/audio.");
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
  // refetch immediately when someone joins/leaves/toggles mic or camera,
  // instead of waiting on the slow poll above. Requires the "Public read
  // (realtime)" policy from migration 0002 — without it Realtime silently
  // delivers nothing.
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

  // LiveKit token — only once we're actually a participant. A token is
  // good for its full 4h ttl (see the token route), so there's no reason
  // to ever refetch it on its own.
  const { data: liveKit } = useQuery({
    queryKey: ["livekit-token", code, myParticipantId],
    queryFn: () => fetchLiveKitToken(code, myParticipantId as string),
    enabled: !!myParticipantId,
    retry: false,
    staleTime: Infinity,
  });

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

      {myParticipantId && liveKit ? (
        <LiveKitRoom
          serverUrl={liveKit.serverUrl}
          token={liveKit.token}
          connect
          audio={false}
          video={false}
          onError={(err) => console.error("[LiveKit] room connection error", err)}
        >
          <RoomAudioRenderer />
          <LiveParticipantGrid participants={participants} myParticipantId={myParticipantId} code={code} />
        </LiveKitRoom>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3">
          {participants.map((p) => (
            <VideoTile key={p.id} name={p.displayName} micOn={p.micOn} camOn={p.camOn} conn={p.conn} />
          ))}
        </div>
      )}

      <div className="mt-8 rounded-tile border border-line bg-s1 p-4">
        <Pill tone="neutral">Preview</Pill>
        <p className="mt-2 font-ui text-[13px] text-mu">
          {myParticipantId
            ? `This room is real — anyone with the code ${code} can join it from any device. Turn on your mic and camera above to be seen and heard. Chat isn't connected yet.`
            : `This room is real — anyone with the code ${code} can join it from any device, and the list above updates live. Join to turn on your mic and camera.`}
        </p>
      </div>

      <Button variant="danger" fullWidth className="mt-8" onClick={handleLeave} disabled={leaving}>
        Leave room
      </Button>
    </div>
  );
}

/**
 * Lives inside <LiveKitRoom> — useTracks/useLocalParticipant both need the
 * room context that provides. Matches each DB participant to their LiveKit
 * camera track by identity (the token route mints identity = participant
 * row id, so this is a plain equality check, not a name-matching heuristic).
 */
function LiveParticipantGrid({
  participants,
  myParticipantId,
  code,
}: {
  participants: RoomParticipant[];
  myParticipantId: string;
  code: string;
}) {
  const cameraTracks = useTracks([Track.Source.Camera]);
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [toggling, setToggling] = useState(false);

  async function reportState(patch: { micOn?: boolean; camOn?: boolean }) {
    try {
      await fetch(`/api/rooms/${code}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: myParticipantId, ...patch }),
      });
    } catch {
      // Best-effort — this device already reflects the change via LiveKit
      // directly; only everyone else's view of it would be missed.
    }
  }

  async function toggleMic() {
    setToggling(true);
    try {
      const next = !isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(next);
      await reportState({ micOn: next });
    } catch (err) {
      console.error("[LiveKit] could not toggle microphone", err);
    } finally {
      setToggling(false);
    }
  }

  async function toggleCam() {
    setToggling(true);
    try {
      const next = !isCameraEnabled;
      await localParticipant.setCameraEnabled(next);
      await reportState({ camOn: next });
    } catch (err) {
      console.error("[LiveKit] could not toggle camera", err);
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3">
        {participants.map((p) => {
          const isMe = p.id === myParticipantId;
          const trackRef = cameraTracks.find((t) => t.participant.identity === p.id);
          return (
            <VideoTile
              key={p.id}
              name={isMe ? `${p.displayName} (you)` : p.displayName}
              micOn={isMe ? isMicrophoneEnabled : p.micOn}
              camOn={isMe ? isCameraEnabled : p.camOn}
              conn={p.conn}
              videoElement={trackRef ? <VideoTrack trackRef={trackRef} /> : undefined}
            />
          );
        })}
      </div>

      <div className="mt-4 flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={toggleMic}
          disabled={toggling}
          icon={isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        >
          {isMicrophoneEnabled ? "Mute" : "Unmute"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={toggleCam}
          disabled={toggling}
          icon={isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
        >
          {isCameraEnabled ? "Stop video" : "Start video"}
        </Button>
      </div>
    </>
  );
}

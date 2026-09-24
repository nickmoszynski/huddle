"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Track } from "livekit-client";
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useLocalParticipant, useTracks } from "@livekit/components-react";
import { Mic, MicOff, Plus, Video, VideoOff, X } from "lucide-react";
import {
  Button,
  ChatPanel,
  Leaderboard,
  PickCard,
  Pill,
  VideoTile,
  type ChatMessageItem,
  type ChoiceOption,
} from "@huddle/ui";
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
 * somehow agreeing on their own.
 *
 * Chat (see DECISIONS.md, "In-room chat") is a second, independent
 * Realtime subscription on the same channel/`messages` table — same
 * public-read-for-realtime pattern as 0002, added in migration 0004. Only
 * shown once you've joined (myParticipantId set), same gate as video.
 * "Is this my own message" is tracked client-side by the ids returned from
 * my own successful sends (`myMessageIds`), not by matching sender_id —
 * simpler, but means your own messages from a *previous* page load (e.g.
 * after a refresh) show up unstyled as "someone else's" until you send a
 * new one. A minor cosmetic gap, not a functional one — fine for a first
 * pass.
 *
 * Picks + a room-scoped leaderboard (see DECISIONS.md, "Picks and a
 * leaderboard") round out this pass. The host starts a pick (a prompt +
 * 2-4 options), anyone can answer while it's open, the host locks then
 * resolves it, and points land in the leaderboard below the chat panel.
 * Realtime here (migration 0005) invalidates-and-refetches on any change
 * to picks/pick_options/pick_entries rather than the surgical
 * setQueryData chat uses — pick_options/pick_entries have no room_id
 * column to filter Realtime's subscription on directly, so this just
 * refetches the whole picks list on any change to any of the three
 * tables. Fine at this scale; revisit if a room ever has dozens of picks.
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

interface RawMessage {
  id: string;
  senderName: string;
  text: string;
  kind: string;
  createdAtISO: string;
}

interface RawPickOption {
  id: string;
  label: string;
  votes: number;
  pct: number;
}

interface RawPick {
  id: string;
  prompt: string;
  status: "open" | "locked" | "resolved" | "void";
  points: number;
  resultOptionId: string | null;
  options: RawPickOption[];
  totalVotes: number;
  myOptionId: string | null;
}

interface LeaderboardEntry {
  key: string;
  name: string;
  points: number;
}

interface PicksResponse {
  picks: RawPick[];
  leaderboard: LeaderboardEntry[];
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

async function fetchMessages(code: string): Promise<RawMessage[]> {
  const res = await fetch(`/api/rooms/${code}/messages`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Could not load chat.");
  return data.messages;
}

async function fetchPicks(code: string, myParticipantId: string | null): Promise<PicksResponse> {
  const qs = myParticipantId ? `?participantId=${myParticipantId}` : "";
  const res = await fetch(`/api/rooms/${code}/picks${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Could not load picks.");
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
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [myMessageIds, setMyMessageIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["room", code],
    queryFn: () => fetchRoom(code),
    refetchInterval: 20000, // safety-net poll — Realtime (below) is the primary path
    retry: false,
  });

  const roomId = data?.room.id;

  // Chat history — refetchInterval here is the same belt-and-suspenders
  // safety net as the room poll above, in case the Realtime subscription
  // below silently drops; new messages normally arrive via that instead.
  const { data: rawMessages } = useQuery({
    queryKey: ["messages", code],
    queryFn: () => fetchMessages(code),
    refetchInterval: 15000,
  });

  const { data: picksData } = useQuery({
    queryKey: ["picks", code, myParticipantId],
    queryFn: () => fetchPicks(code, myParticipantId),
    refetchInterval: 15000,
  });

  // Live updates: subscribe to changes on this room's participants (join/
  // leave/mic/camera) and to new chat messages, on one channel. Requires
  // the "Public read (realtime)" policies from migrations 0002 (rooms/
  // room_participants) and 0004 (messages) — without them Realtime
  // silently delivers nothing.
  useEffect(() => {
    if (!roomId) return;

    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return; // Supabase env vars missing — safety-net polls still work
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_name: string;
            text: string;
            kind: string;
            created_at: string;
          };
          queryClient.setQueryData<RawMessage[]>(["messages", code], (prev) => {
            const next = prev ?? [];
            if (next.some((m) => m.id === row.id)) return next; // already have it (e.g. our own send below)
            return [
              ...next,
              { id: row.id, senderName: row.sender_name, text: row.text, kind: row.kind, createdAtISO: row.created_at },
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "picks", filter: `room_id=eq.${roomId}` },
        () => queryClient.invalidateQueries({ queryKey: ["picks", code] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "pick_options" }, () =>
        queryClient.invalidateQueries({ queryKey: ["picks", code] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "pick_entries" }, () =>
        queryClient.invalidateQueries({ queryKey: ["picks", code] })
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

  async function handleSendChat() {
    const text = chatInput.trim();
    if (!text || !myParticipantId) return;
    setChatInput("");
    setSendingChat(true);
    try {
      const res = await fetch(`/api/rooms/${code}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: myParticipantId, text }),
      });
      const resData = await res.json();
      if (res.ok && resData.message) {
        setMyMessageIds((prev) => new Set(prev).add(resData.message.id));
        // Append immediately rather than waiting on the Realtime round-trip
        // (which will also deliver this same insert — the dedup check in
        // that handler above is what keeps this from showing up twice).
        queryClient.setQueryData<RawMessage[]>(["messages", code], (prev) => {
          const next = prev ?? [];
          if (next.some((m) => m.id === resData.message.id)) return next;
          return [...next, resData.message];
        });
      }
    } catch {
      // Best-effort — the safety-net poll above will pick it up if this
      // silently failed to reach the server but actually landed.
    } finally {
      setSendingChat(false);
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

      {myParticipantId && (
        <ChatPanel
          className="mt-6"
          messages={(rawMessages ?? []).map(
            (m): ChatMessageItem => ({
              id: m.id,
              senderName: m.senderName,
              text: m.text,
              kind: m.kind,
              isMe: myMessageIds.has(m.id),
            })
          )}
          value={chatInput}
          onChange={setChatInput}
          onSend={handleSendChat}
          sending={sendingChat}
        />
      )}

      {myParticipantId && (
        <PicksSection
          code={code}
          myParticipantId={myParticipantId}
          isHost={participants.find((p) => p.id === myParticipantId)?.role === "host"}
          data={picksData}
        />
      )}

      <div className="mt-6 rounded-tile border border-line bg-s1 p-4">
        <Pill tone="neutral">Preview</Pill>
        <p className="mt-2 font-ui text-[13px] text-mu">
          {myParticipantId
            ? `This room is real — anyone with the code ${code} can join it from any device. Turn on your mic and camera above to be seen and heard, chat below, and the host can start picks.`
            : `This room is real — anyone with the code ${code} can join it from any device, and the list above updates live. Join to turn on your mic and camera, chat, and answer picks.`}
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

/**
 * Picks + the room-scoped leaderboard — see this file's top doc comment
 * and api/rooms/[code]/picks's doc comment for the full reasoning (simple
 * "custom"/"choice" picks only, host-run, no `season_scores` tie-in).
 * `data` comes from the parent's react-query cache (kept live by both the
 * safety-net poll and the Realtime subscription up there) rather than
 * this component fetching its own copy.
 */
function PicksSection({
  code,
  myParticipantId,
  isHost,
  data,
}: {
  code: string;
  myParticipantId: string;
  isHost: boolean;
  data: PicksResponse | undefined;
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["picks", code] });

  const [creating, setCreating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [optionInputs, setOptionInputs] = useState(["", ""]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingPickId, setActingPickId] = useState<string | null>(null);

  function updateOption(i: number, value: string) {
    setOptionInputs((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  async function handleCreate() {
    const options = optionInputs.map((o) => o.trim()).filter(Boolean);
    if (!prompt.trim() || options.length < 2) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: myParticipantId, prompt: prompt.trim(), options }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData?.error ?? "Could not start that pick.");
      setPrompt("");
      setOptionInputs(["", ""]);
      setCreating(false);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  async function handleSelect(pickId: string, optionId: string) {
    setActingPickId(pickId);
    try {
      await fetch(`/api/rooms/${code}/picks/${pickId}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: myParticipantId, optionId }),
      });
      invalidate();
    } catch {
      // Best-effort — the safety-net poll picks this up if it silently failed.
    } finally {
      setActingPickId(null);
    }
  }

  async function handleLock(pickId: string) {
    setActingPickId(pickId);
    try {
      await fetch(`/api/rooms/${code}/picks/${pickId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: myParticipantId }),
      });
      invalidate();
    } finally {
      setActingPickId(null);
    }
  }

  async function handleResolve(pickId: string, resultOptionId: string) {
    setActingPickId(pickId);
    try {
      await fetch(`/api/rooms/${code}/picks/${pickId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: myParticipantId, resultOptionId }),
      });
      invalidate();
    } finally {
      setActingPickId(null);
    }
  }

  const picks = data?.picks ?? [];
  const leaderboard = data?.leaderboard ?? [];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu">Picks</p>
        {isHost && (
          <button
            onClick={() => setCreating((v) => !v)}
            className="flex items-center gap-1 font-ui text-[12px] font-semibold text-ac"
          >
            {creating ? (
              <>
                <X size={14} /> Cancel
              </>
            ) : (
              <>
                <Plus size={14} /> Start a pick
              </>
            )}
          </button>
        )}
      </div>

      {creating && (
        <div className="mt-3 rounded-tile border border-line bg-s1 p-4">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Next score: TD or FG?"
            maxLength={140}
            className="h-[44px] w-full rounded-control border border-line2 bg-s2 px-3 font-ui text-[14px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
          />
          <div className="mt-2 flex flex-col gap-2">
            {optionInputs.map((opt, i) => (
              <input
                key={i}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                maxLength={40}
                className="h-[40px] rounded-control border border-line2 bg-s2 px-3 font-ui text-[13px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            {optionInputs.length < 4 ? (
              <button
                onClick={() => setOptionInputs((prev) => [...prev, ""])}
                className="font-ui text-[12px] font-semibold text-mu"
              >
                + Add option
              </button>
            ) : (
              <span />
            )}
            {optionInputs.length > 2 && (
              <button
                onClick={() => setOptionInputs((prev) => prev.slice(0, -1))}
                className="font-ui text-[12px] font-semibold text-mu"
              >
                Remove last
              </button>
            )}
          </div>
          <Button
            variant="primary"
            fullWidth
            className="mt-3 h-11"
            onClick={handleCreate}
            disabled={working || !prompt.trim() || optionInputs.filter((o) => o.trim()).length < 2}
          >
            {working ? "Starting…" : "Start pick"}
          </Button>
          {error && <p className="mt-2 font-ui text-[12px] text-live">{error}</p>}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {picks.map((pick) => {
          const options: ChoiceOption[] = pick.options.map((o) => ({
            id: o.id,
            label: o.label,
            pct: o.pct,
            selected: o.id === pick.myOptionId,
          }));
          return (
            <div key={pick.id}>
              <PickCard
                kind="choice"
                prompt={pick.prompt}
                options={options}
                totalVotes={pick.totalVotes}
                locked={pick.status === "locked"}
                resolved={pick.status === "resolved"}
                resultOptionId={pick.resultOptionId ?? undefined}
                onSelect={(optionId) => handleSelect(pick.id, optionId)}
              />
              {isHost && pick.status === "open" && (
                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-2 h-10"
                  onClick={() => handleLock(pick.id)}
                  disabled={actingPickId === pick.id}
                >
                  Lock picks
                </Button>
              )}
              {isHost && pick.status === "locked" && (
                <div className="mt-2 rounded-tile border border-line bg-s1 p-3">
                  <p className="mb-2 font-ui text-[12px] font-semibold text-mu">Mark the correct answer:</p>
                  <div className="flex flex-wrap gap-2">
                    {pick.options.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => handleResolve(pick.id, o.id)}
                        disabled={actingPickId === pick.id}
                        className="rounded-control border border-line2 bg-s2 px-3 py-1.5 font-ui text-[13px] font-medium text-tx disabled:opacity-40"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {leaderboard.length > 0 && (
        <Leaderboard
          className="mt-4"
          title="Leaderboard"
          rows={leaderboard.map((row, i) => ({ rank: i + 1, name: row.name, points: row.points }))}
        />
      )}
    </div>
  );
}

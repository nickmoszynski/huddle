"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, Button } from "@huddle/ui";
import { getStoredDisplayName, storeDisplayName } from "@/lib/guestName";
import { useSession } from "@/lib/session";

/**
 * Join a room by code — for real now (see DECISIONS.md). No auth needed:
 * joining creates a `guest_sessions` row and seats you as a participant via
 * /api/rooms/[code]. Works for any room that actually exists in the
 * database, created from any device.
 *
 * If you've already claimed a username, this skips asking for your name —
 * same reasoning as /create. Joining still works with zero sign-in at all
 * (that's the point of guest_sessions), this just avoids re-asking someone
 * who's already told the app who they are.
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

  const { isSignedIn, user } = useSession();
  const [name, setName] = useState(() => getStoredDisplayName());
  const [code, setCode] = useState(prefillCode.toUpperCase());
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) return;
    const displayName = isSignedIn && user ? user.displayName : name.trim() || "You";

    setStatus("working");
    setError(null);
    try {
      storeDisplayName(displayName);
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not join that room.");

      router.push(`/r/${data.code}?pid=${data.participantId}`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-gutter pb-10 pt-14">
      <button onClick={() => router.back()} className="mb-6 self-start font-ui text-[13px] font-semibold text-mu">
        &larr; Back
      </button>

      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Join a room</h1>

      {isSignedIn && user ? (
        <div className="mt-8 flex items-center gap-3 rounded-tile border border-line bg-s1 p-4">
          <Avatar name={user.displayName} size={40} />
          <div>
            <p className="font-ui text-[13px] text-mu">Joining as</p>
            <p className="font-ui text-[15px] font-semibold text-tx">{user.displayName}</p>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}

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

      <Button
        variant="primary"
        fullWidth
        className="mt-8"
        onClick={handleJoin}
        disabled={!code.trim() || status === "working"}
      >
        {status === "working" ? "Joining…" : "Join room"}
      </Button>

      {error && (
        <p className="mt-4 rounded-control border border-live/30 bg-live/10 p-3 font-ui text-[13px] text-live">
          {error}
        </p>
      )}

      <p className="mt-4 font-ui text-[12px] text-mu2">
        Works for any room that's actually been created — including from a friend's phone.
      </p>
    </div>
  );
}

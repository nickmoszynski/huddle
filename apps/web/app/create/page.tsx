"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, Button } from "@huddle/ui";
import { ensureAnonymousUserId } from "@/lib/supabaseClient";
import { getStoredDisplayName, storeDisplayName } from "@/lib/guestName";
import { useSession } from "@/lib/session";

/**
 * Start a room — for real now (see DECISIONS.md, "Real rooms via
 * Supabase"). Creating a room needs a host with a lightweight `users` row
 * (the schema requires it), so this signs the host in anonymously via
 * Supabase Auth first — no email/password — then creates the room in the
 * actual database via /api/rooms. Requires Anonymous Sign-Ins to be
 * turned on in Supabase (Authentication -> Sign In / Providers).
 *
 * If you've already claimed a username (see DECISIONS.md, "Username
 * sign-in"), there's no reason to ask for your name again — it just
 * confirms who you're starting as and skips straight to the button. Only
 * an unclaimed visitor (or someone who's never signed in at all) sees the
 * name field, same as before.
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

  const providerEventId = searchParams.get("providerEventId");
  const homeAbbr = searchParams.get("homeAbbr");
  const awayAbbr = searchParams.get("awayAbbr");
  const homeName = searchParams.get("homeName");
  const awayName = searchParams.get("awayName");
  const startTime = searchParams.get("startTime");
  const hasGame = Boolean(providerEventId && homeAbbr && awayAbbr && homeName && awayName && startTime);
  const gameLabel = hasGame ? `${awayName} @ ${homeName}` : undefined;

  const { isSignedIn, user } = useSession();
  const [name, setName] = useState(() => getStoredDisplayName());
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const displayName = isSignedIn && user ? user.displayName : name.trim() || "You";
    setStatus("working");
    setError(null);
    try {
      const authUserId = await ensureAnonymousUserId();
      storeDisplayName(displayName);

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authUserId,
          displayName,
          game: hasGame
            ? { providerEventId, homeAbbr, awayAbbr, homeName, awayName, startTimeISO: startTime }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not create the room.");

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

      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Start a room</h1>
      {gameLabel && <p className="mt-2 font-ui text-[14px] text-mu">{gameLabel}</p>}

      {isSignedIn && user ? (
        <div className="mt-8 flex items-center gap-3 rounded-tile border border-line bg-s1 p-4">
          <Avatar name={user.displayName} size={40} />
          <div>
            <p className="font-ui text-[13px] text-mu">Starting as</p>
            <p className="font-ui text-[15px] font-semibold text-tx">{user.displayName}</p>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}

      <Button variant="primary" fullWidth className="mt-8" onClick={handleCreate} disabled={status === "working"}>
        {status === "working" ? "Creating…" : "Create room"}
      </Button>

      {error && (
        <p className="mt-4 rounded-control border border-live/30 bg-live/10 p-3 font-ui text-[13px] text-live">
          {error}
        </p>
      )}

      <p className="mt-4 font-ui text-[12px] text-mu2">
        This creates a real room in the database that anyone with the code can join from any device.
      </p>
    </div>
  );
}

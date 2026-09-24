"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@huddle/ui";
import { ensureAnonymousUserId } from "@/lib/supabaseClient";
import { useInvalidateSession } from "@/lib/session";
import { normalizeUsername, usernameError } from "@/lib/username";

/**
 * Claim a username — turns an anonymous Supabase session into a real
 * Huddle identity, no email/password (see DECISIONS.md, "Username
 * sign-in"). This is what unlocks Groups and Profile; joining/hosting a
 * room never requires it. `?next=` sends you back to whatever screen sent
 * you here (Groups/Profile link to /signin?next=/groups etc.) — defaults
 * to /profile.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";
  const invalidateSession = useInvalidateSession();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [availability, setAvailability] = useState<
    { status: "idle" | "checking" | "available" | "taken" | "invalid"; reason?: string }
  >({ status: "idle" });
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Debounced live availability check as they type — see /api/auth/username-available.
  useEffect(() => {
    const formatErr = usernameError(username);
    if (!username) {
      setAvailability({ status: "idle" });
      return;
    }
    if (formatErr) {
      setAvailability({ status: "invalid", reason: formatErr });
      return;
    }
    setAvailability({ status: "checking" });
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/username-available?u=${encodeURIComponent(username)}`);
        const data = await res.json();
        setAvailability({ status: data.available ? "available" : "taken", reason: data.reason ?? undefined });
      } catch {
        setAvailability({ status: "idle" });
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [username]);

  const canSubmit = availability.status === "available" && displayName.trim().length > 0 && status !== "working";

  async function handleClaim() {
    if (!canSubmit) return;
    setStatus("working");
    setError(null);
    try {
      const authUserId = await ensureAnonymousUserId();
      const res = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUserId, username: normalizeUsername(username), displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not claim that username.");

      invalidateSession();
      router.push(next);
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

      <h1 className="font-display text-[34px] font-extrabold uppercase leading-none text-tx">Claim your @</h1>
      <p className="mt-3 font-ui text-[15px] text-mu">
        One handle, no password. This is what your friends see in Groups and on the leaderboard.
      </p>

      <label className="mt-8 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu" htmlFor="username">
        Username
      </label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-ui text-[15px] text-mu2">
          @
        </span>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="nickm"
          maxLength={20}
          autoCapitalize="none"
          autoCorrect="off"
          className="h-[52px] w-full rounded-control border border-line2 bg-s2 pl-8 pr-4 font-ui text-[15px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
        />
      </div>
      {availability.status !== "idle" && (
        <p
          className={
            "mt-2 font-ui text-[12px] " +
            (availability.status === "available"
              ? "text-ac"
              : availability.status === "checking"
                ? "text-mu2"
                : "text-live")
          }
        >
          {availability.status === "checking" && "Checking…"}
          {availability.status === "available" && "Available"}
          {(availability.status === "taken" || availability.status === "invalid") && availability.reason}
        </p>
      )}

      <label className="mt-6 font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-mu" htmlFor="display-name">
        Display name
      </label>
      <input
        id="display-name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Nick"
        maxLength={40}
        className="mt-2 h-[52px] rounded-control border border-line2 bg-s2 px-4 font-ui text-[15px] text-tx outline-none placeholder:text-mu2 focus:border-ac"
      />

      <Button variant="primary" fullWidth className="mt-8" onClick={handleClaim} disabled={!canSubmit}>
        {status === "working" ? "Claiming…" : "Claim @" + (username || "username")}
      </Button>

      {error && (
        <p className="mt-4 rounded-control border border-live/30 bg-live/10 p-3 font-ui text-[13px] text-live">
          {error}
        </p>
      )}

      <p className="mt-4 font-ui text-[12px] text-mu2">
        No email needed for now — you can add one later to keep your account if you switch phones.
      </p>
    </div>
  );
}

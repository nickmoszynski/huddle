"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentAuthUserId } from "./supabaseClient";

/**
 * "Am I signed in, and have I claimed a username yet?" — the one check
 * every gated screen (Groups, Profile, and eventually Explore's "create a
 * room from here") needs before deciding what to render. Two layers:
 * 1. A Supabase auth session on this device (read-only check — doesn't
 *    create one; see getCurrentAuthUserId's doc comment).
 * 2. A `users` row for that auth id with a non-null username (POST
 *    /api/auth/me) — someone can have layer 1 without layer 2 if they
 *    only ever hosted a room and never visited /signin.
 */

export interface AppUser {
  id: string;
  username: string | null;
  displayName: string;
}

interface SessionResult {
  authUserId: string | null;
  user: AppUser | null;
  isSignedIn: boolean; // has a claimed username — the gate every screen actually checks
  isLoading: boolean;
}

async function fetchMe(authUserId: string): Promise<AppUser | null> {
  const res = await fetch("/api/auth/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authUserId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user ?? null;
}

export function useSession(): SessionResult {
  const { data: authUserId, isLoading: authLoading } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      try {
        return await getCurrentAuthUserId();
      } catch {
        return null; // Supabase env vars missing — treat as signed out rather than crashing
      }
    },
    staleTime: 60_000,
  });

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["me", authUserId],
    queryFn: () => fetchMe(authUserId as string),
    enabled: !!authUserId,
  });

  return {
    authUserId: authUserId ?? null,
    user: user ?? null,
    isSignedIn: !!user?.username,
    isLoading: authLoading || (!!authUserId && userLoading),
  };
}

/** Call after /signin's claim succeeds, or after signing out, to refresh every screen's session state. */
export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["auth-user-id"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };
}

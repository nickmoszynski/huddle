"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser-only Supabase client, used for two things: anonymous auth (both
 * for whoever creates a room, and now for the username sign-in flow — see
 * DECISIONS.md, "Username sign-in") and the room screen's Realtime
 * subscription (apps/web/app/r/[code]/page.tsx). It is NOT used to query
 * the database directly for anything else — every table has RLS enabled
 * with close to zero policies (packages/db/migrations/0001, 0002), so an
 * anon-key client can't read/write most of it. All real reads/writes go
 * through apps/web/app/api/* route handlers, server-side, via @huddle/db
 * (DATABASE_URL).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Add them as Netlify environment variables."
    );
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/**
 * Returns the current Supabase auth user id, signing in anonymously first
 * if there isn't one yet. Anonymous sign-ins must be turned on in the
 * Supabase dashboard (Authentication -> Sign In / Providers -> Anonymous)
 * or this throws.
 */
export async function ensureAnonymousUserId(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.id) {
    return sessionData.session.user.id;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not start a session. Is Anonymous Sign-In enabled in Supabase?");
  }
  return data.user.id;
}

/**
 * Returns the current Supabase auth user id WITHOUT signing in — unlike
 * ensureAnonymousUserId, a casual visitor who's never claimed a username
 * or hosted a room stays fully anonymous (no throwaway Supabase auth user
 * created just from loading a page). Used by useSession() (lib/session.ts)
 * to answer "is this device already signed in?" on load.
 */
export async function getCurrentAuthUserId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Signs out of the local Supabase session — see the /profile screen. */
export async function signOutLocally(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
}

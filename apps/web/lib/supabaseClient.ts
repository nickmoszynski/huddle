"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser-only Supabase client, used for exactly one thing right now:
 * anonymous auth for whoever creates a room (see DECISIONS.md — "hosting a
 * room" section). It is NOT used to query the database directly — every
 * table has RLS enabled with zero policies (packages/db/migrations/0001),
 * so an anon-key client can't read/write anything. All real reads/writes go
 * through apps/web/app/api/rooms/* route handlers, server-side, via
 * @huddle/db (DATABASE_URL).
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

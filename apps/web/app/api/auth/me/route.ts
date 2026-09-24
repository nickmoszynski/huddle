import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, users } from "@huddle/db";

/**
 * POST /api/auth/me — resolves a Supabase auth id to this app's own
 * `users` row, if one exists. Used on load by useSession() (lib/session.ts)
 * to figure out "am I signed in, and have I claimed a username yet." Takes
 * authUserId as a POST body rather than reading a server-side session
 * cookie because nothing in this app verifies Supabase JWTs server-side
 * yet — every route trusts a client-supplied id the same way
 * /api/rooms/[code]/leave and /api/rooms/[code]/state already do. Revisit
 * alongside the RLS hardening pass.
 */

const bodySchema = z.object({ authUserId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.authId, parsed.data.authUserId))
      .limit(1);
    return NextResponse.json({ user: row ?? null });
  } catch (err) {
    console.error("[api/auth/me] failed to look up user", err);
    return NextResponse.json({ error: "Could not load your account." }, { status: 500 });
  }
}

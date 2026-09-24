import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { getDb, users, userPrefs } from "@huddle/db";
import { normalizeUsername, usernameError } from "@/lib/username";

/**
 * POST /api/auth/claim — the one step that turns an anonymous Supabase
 * session into a real Huddle identity: a username, on top of anonymous
 * auth, no email/password required (see DECISIONS.md, "Username sign-in").
 * `authUserId` is the id from supabase.auth.signInAnonymously() (or an
 * existing session — see ensureAnonymousUserId in lib/supabaseClient.ts),
 * done client-side by /signin before this call.
 *
 * Also works for a rename: if this authUserId already has a `users` row
 * (e.g. from having hosted a room, or from an earlier claim), this updates
 * it in place rather than erroring — Profile reuses this same route for
 * "change your username." A `user_prefs` row is created alongside a
 * brand-new user (all columns have schema defaults), matching what the
 * room-hosting path never needed to do since it doesn't touch prefs.
 */

const bodySchema = z.object({
  authUserId: z.string().uuid(),
  username: z.string().min(1),
  displayName: z.string().trim().min(1).max(40),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { authUserId, displayName } = parsed.data;
  const username = normalizeUsername(parsed.data.username);

  const formatErr = usernameError(username);
  if (formatErr) {
    return NextResponse.json({ error: formatErr }, { status: 400 });
  }

  try {
    const db = getDb();

    const [takenByOther] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, username), ne(users.authId, authUserId)))
      .limit(1);
    if (takenByOther) {
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }

    const [existing] = await db.select().from(users).where(eq(users.authId, authUserId)).limit(1);

    let userRow;
    if (existing) {
      [userRow] = await db
        .update(users)
        .set({ username, displayName })
        .where(eq(users.id, existing.id))
        .returning();
    } else {
      [userRow] = await db.insert(users).values({ authId: authUserId, username, displayName }).returning();
      if (userRow) {
        await db.insert(userPrefs).values({ userId: userRow.id });
      }
    }
    if (!userRow) throw new Error("Upsert into users returned no row.");

    return NextResponse.json({
      user: { id: userRow.id, username: userRow.username, displayName: userRow.displayName },
    });
  } catch (err) {
    // The select-then-write above isn't atomic, so two people claiming the
    // same username at the same instant both pass the check and race to
    // insert/update — the unique index (`users_username_idx`) is the real
    // guarantee, and a violation lands here as a Postgres 23505 rather than
    // the 409 above. Surface it the same friendly way either way.
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }
    console.error("[api/auth/claim] failed to claim username", err);
    return NextResponse.json({ error: "Could not claim that username right now." }, { status: 500 });
  }
}

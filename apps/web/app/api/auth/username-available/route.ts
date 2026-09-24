import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users } from "@huddle/db";
import { normalizeUsername, usernameError } from "@/lib/username";

/**
 * GET /api/auth/username-available?u=nickm — live-check for the /signin
 * form's inline "taken/available" feedback as someone types. Read-only;
 * the real uniqueness guarantee is the `users_username_idx` unique index,
 * which /api/auth/claim relies on for the actual race-safe check at
 * submit time — this route is just UX, not the source of truth.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u") ?? "";
  const err = usernameError(raw);
  if (err) {
    return NextResponse.json({ available: false, reason: err });
  }

  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, normalizeUsername(raw)))
      .limit(1);
    return NextResponse.json({ available: !existing, reason: existing ? "That username is taken." : null });
  } catch (err) {
    console.error("[api/auth/username-available] failed to check username", err);
    return NextResponse.json({ available: false, reason: "Could not check that right now." }, { status: 500 });
  }
}

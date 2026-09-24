import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, users, userPrefs } from "@huddle/db";

/**
 * GET /api/auth/prefs?authUserId=... — this user's `user_prefs` row.
 * POST /api/auth/prefs — patches one or more of the (small, deliberately
 * limited-for-now) settings the Profile screen exposes: camOnJoin,
 * micOnJoin, notifyGameAlerts. The `user_prefs` table has more columns
 * than that (noise suppression, low-data mode, findability, etc.) — those
 * just keep their schema defaults until a settings screen actually needs
 * them; this route only ever touches the fields it's given.
 */

async function findPrefsRow(authUserId: string) {
  const db = getDb();
  const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.authId, authUserId)).limit(1);
  if (!userRow) return { userRow: null, prefs: null };
  const [prefs] = await db.select().from(userPrefs).where(eq(userPrefs.userId, userRow.id)).limit(1);
  return { userRow, prefs: prefs ?? null };
}

export async function GET(req: NextRequest) {
  const authUserId = req.nextUrl.searchParams.get("authUserId");
  if (!authUserId) {
    return NextResponse.json({ error: "Missing authUserId." }, { status: 400 });
  }
  try {
    const { userRow, prefs } = await findPrefsRow(authUserId);
    if (!userRow) {
      return NextResponse.json({ error: "No account for this session yet." }, { status: 404 });
    }
    return NextResponse.json({ prefs });
  } catch (err) {
    console.error("[api/auth/prefs] failed to load prefs", err);
    return NextResponse.json({ error: "Could not load your settings." }, { status: 500 });
  }
}

const bodySchema = z.object({
  authUserId: z.string().uuid(),
  camOnJoin: z.boolean().optional(),
  micOnJoin: z.boolean().optional(),
  notifyGameAlerts: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { authUserId, ...rest } = parsed.data;
  const patch: Partial<typeof userPrefs.$inferInsert> = {};
  if (rest.camOnJoin !== undefined) patch.camOnJoin = rest.camOnJoin;
  if (rest.micOnJoin !== undefined) patch.micOnJoin = rest.micOnJoin;
  if (rest.notifyGameAlerts !== undefined) patch.notifyGameAlerts = rest.notifyGameAlerts;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const { userRow } = await findPrefsRow(authUserId);
    if (!userRow) {
      return NextResponse.json({ error: "No account for this session yet." }, { status: 404 });
    }
    const db = getDb();
    const [updated] = await db
      .update(userPrefs)
      .set(patch)
      .where(eq(userPrefs.userId, userRow.id))
      .returning();
    return NextResponse.json({ prefs: updated ?? null });
  } catch (err) {
    console.error("[api/auth/prefs] failed to update prefs", err);
    return NextResponse.json({ error: "Could not save your settings." }, { status: 500 });
  }
}

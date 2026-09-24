import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb, users, groups, groupMembers } from "@huddle/db";
import { generateUniqueGroupSlug } from "@/lib/groupSlug.server";

/**
 * GET /api/groups?authUserId=... — the groups this person belongs to,
 * with a member count each (cheap `count(*)` per group via a join —
 * nobody has more than a handful of groups yet, no need for anything
 * fancier). Requires a claimed username (see /signin) because
 * `groups.created_by` / `group_members.user_id` both reference `users`,
 * not `guest_sessions` — unlike rooms, groups were never designed to
 * support a guest identity.
 */
export async function GET(req: NextRequest) {
  const authUserId = req.nextUrl.searchParams.get("authUserId");
  if (!authUserId) {
    return NextResponse.json({ error: "Missing authUserId." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.authId, authUserId)).limit(1);
    if (!userRow) {
      return NextResponse.json({ groups: [] });
    }

    const myGroupIds = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userRow.id));
    if (myGroupIds.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const ids = myGroupIds.map((g) => g.groupId);
    const rows = await db
      .select({
        id: groups.id,
        slug: groups.slug,
        name: groups.name,
        memberCount: sql<number>`count(${groupMembers.userId})`.mapWith(Number),
      })
      .from(groups)
      .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .where(inArray(groups.id, ids))
      .groupBy(groups.id, groups.slug, groups.name);

    return NextResponse.json({ groups: rows });
  } catch (err) {
    console.error("[api/groups] failed to list groups", err);
    return NextResponse.json({ error: "Could not load your groups." }, { status: 500 });
  }
}

const createSchema = z.object({
  authUserId: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
});

/** POST /api/groups — create a group; the creator is seated as its first member. */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { authUserId, name } = parsed.data;

  try {
    const db = getDb();
    const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.authId, authUserId)).limit(1);
    if (!userRow) {
      return NextResponse.json({ error: "Claim a username before creating a group." }, { status: 403 });
    }

    const slug = await generateUniqueGroupSlug(name);
    const [group] = await db.insert(groups).values({ slug, name, createdBy: userRow.id }).returning();
    if (!group) throw new Error("Insert into groups returned no row.");

    await db.insert(groupMembers).values({ groupId: group.id, userId: userRow.id });

    return NextResponse.json({ group: { id: group.id, slug: group.slug, name: group.name } });
  } catch (err) {
    console.error("[api/groups] failed to create group", err);
    return NextResponse.json({ error: "Could not create the group." }, { status: 500 });
  }
}

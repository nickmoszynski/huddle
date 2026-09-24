import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, users, groups, groupMembers } from "@huddle/db";

/** POST /api/groups/join — join an existing group by its slug (its invite code). */
const bodySchema = z.object({
  authUserId: z.string().uuid(),
  slug: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { authUserId, slug } = parsed.data;
  const normalizedSlug = slug.toLowerCase().trim();

  try {
    const db = getDb();
    const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.authId, authUserId)).limit(1);
    if (!userRow) {
      return NextResponse.json({ error: "Claim a username before joining a group." }, { status: 403 });
    }

    const [group] = await db.select().from(groups).where(eq(groups.slug, normalizedSlug)).limit(1);
    if (!group) {
      return NextResponse.json({ error: "No group with that code." }, { status: 404 });
    }

    const [existing] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userRow.id)))
      .limit(1);
    if (!existing) {
      await db.insert(groupMembers).values({ groupId: group.id, userId: userRow.id });
    }

    return NextResponse.json({ group: { id: group.id, slug: group.slug, name: group.name } });
  } catch (err) {
    console.error("[api/groups/join] failed to join group", err);
    return NextResponse.json({ error: "Could not join that group." }, { status: 500 });
  }
}

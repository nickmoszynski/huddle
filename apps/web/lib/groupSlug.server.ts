import "server-only";
import { eq } from "drizzle-orm";
import { getDb, groups } from "@huddle/db";

const SUFFIX_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o or 1/l/i — easy to read aloud, matches roomCode.server.ts

function randomSuffix(length = 4): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return s;
}

function slugifyBase(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "group";
}

/**
 * Turns a group's display name into a URL/invite-safe slug that isn't
 * already taken in the real `groups` table — same "generate, check,
 * retry" pattern as generateUniqueRoomCode. The base slug is tried first
 * (so a first "Fantasy Crew" gets the clean slug "fantasy-crew"); a taken
 * base gets a short random suffix rather than a numeric counter, since a
 * counter would leak how many other groups share that name.
 */
export async function generateUniqueGroupSlug(name: string): Promise<string> {
  const db = getDb();
  const base = slugifyBase(name);

  const [existingBase] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, base)).limit(1);
  if (!existingBase) return base;

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${base}-${randomSuffix()}`;
    const [existing] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, candidate)).limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique group slug — this should be astronomically rare.");
}

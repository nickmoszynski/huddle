import "server-only";
import { eq } from "drizzle-orm";
import { getDb, rooms } from "@huddle/db";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I — easy to read aloud

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** Generates a room code that isn't already taken in the real `rooms` table. */
export async function generateUniqueRoomCode(): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const [existing] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique room code — this should be astronomically rare.");
}

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Lazy singleton so importing this package doesn't require DATABASE_URL to
 * be set (e.g. `apps/web` pages that don't touch the DB, or unit tests).
 */
export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env and point it at your Supabase Postgres connection string.");
    }
    _client = postgres(url, { prepare: false });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

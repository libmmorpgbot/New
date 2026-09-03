import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

/**
 * Returns null when DATABASE_URL is not set, so the game server and API can run
 * fully in-memory during local development.
 */
export function createDb(url: string | undefined) {
  if (!url) return null;
  const sql = postgres(url, { max: 10 });
  return drizzle(sql, { schema });
}

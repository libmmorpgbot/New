import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";

/** `packages/db/migrations`, resolved relative to this file so it works from any cwd. */
export const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/**
 * Applies pending migrations. Drizzle records what it has run in
 * `__drizzle_migrations`, so this is safe to call on every boot — which is the
 * point: a deploy that needs a remembered manual step is a deploy that breaks.
 */
export async function runMigrations(db: NonNullable<Db>): Promise<void> {
  await migrate(db, { migrationsFolder });
}

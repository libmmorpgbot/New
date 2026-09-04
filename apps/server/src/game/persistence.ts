import {
  createDb,
  loadOrCreateCharacter,
  runMigrations,
  saveCharacter,
  type CharacterProgress,
} from "@tg-mmo/db";
import { env } from "../env";

const db = createDb(env.DATABASE_URL);

export const persistenceEnabled = Boolean(db);

/**
 * Brings the schema up to date at boot. Doing it here rather than as a manual
 * step means a fresh database just works — forgetting `pnpm db:push` used to
 * surface as a failed insert on the first login, long after the deploy looked fine.
 */
export async function prepareDatabase(): Promise<void> {
  if (!db) return;
  await runMigrations(db);
}

/** Dev logins carry a non-numeric subject and are never persisted. */
export function userIdFromSubject(sub: string): number | null {
  const id = Number(sub);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function loadProgress(
  userId: number,
  cls: string,
): Promise<CharacterProgress | null> {
  if (!db) return null;
  const row = await loadOrCreateCharacter(db, userId, cls);
  return { level: row.level, xp: row.xp, gold: row.gold, x: row.x, y: row.y };
}

export async function storeProgress(
  userId: number,
  cls: string,
  progress: CharacterProgress,
): Promise<void> {
  if (!db) return;
  await saveCharacter(db, userId, cls, progress);
}

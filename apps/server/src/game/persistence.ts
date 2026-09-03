import {
  createDb,
  loadOrCreateCharacter,
  saveCharacter,
  type CharacterProgress,
} from "@tg-mmo/db";
import { env } from "../env";

const db = createDb(env.DATABASE_URL);

export const persistenceEnabled = Boolean(db);

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
  return { level: row.level, xp: row.xp, x: row.x, y: row.y };
}

export async function storeProgress(
  userId: number,
  cls: string,
  progress: CharacterProgress,
): Promise<void> {
  if (!db) return;
  await saveCharacter(db, userId, cls, progress);
}

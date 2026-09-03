import { and, eq, sql } from "drizzle-orm";
import { characters, users, type CharacterRow } from "./schema";
import type { Db } from "./client";

export interface TelegramProfile {
  telegramId: number;
  firstName: string;
  username?: string | undefined;
  languageCode?: string | undefined;
}

/** Creates the account on first login and refreshes the profile on every later one. */
export async function upsertUser(db: NonNullable<Db>, profile: TelegramProfile) {
  const [row] = await db
    .insert(users)
    .values({
      telegramId: profile.telegramId,
      firstName: profile.firstName,
      username: profile.username ?? null,
      languageCode: profile.languageCode ?? null,
    })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: {
        firstName: profile.firstName,
        username: profile.username ?? null,
        languageCode: profile.languageCode ?? null,
        lastSeenAt: sql`now()`,
      },
    })
    .returning();

  return row!;
}

export async function listCharacters(db: NonNullable<Db>, userId: number) {
  return db.select().from(characters).where(eq(characters.userId, userId));
}

export async function loadOrCreateCharacter(
  db: NonNullable<Db>,
  userId: number,
  cls: string,
): Promise<CharacterRow> {
  const existing = await db
    .select()
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.class, cls)))
    .limit(1);
  if (existing[0]) return existing[0];

  const [row] = await db.insert(characters).values({ userId, class: cls }).returning();
  return row!;
}

export interface CharacterProgress {
  level: number;
  xp: number;
  x: number;
  y: number;
}

export async function saveCharacter(
  db: NonNullable<Db>,
  userId: number,
  cls: string,
  progress: CharacterProgress,
): Promise<void> {
  await db
    .update(characters)
    .set({ ...progress, lastPlayedAt: sql`now()` })
    .where(and(eq(characters.userId, userId), eq(characters.class, cls)));
}

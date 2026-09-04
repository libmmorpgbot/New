import {
  bigint,
  bigserial,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Telegram's numeric user id — the identity we actually trust. */
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    username: text("username"),
    firstName: text("first_name").notNull(),
    languageCode: text("language_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_telegram_id_key").on(t.telegramId)],
);

export const characters = pgTable(
  "characters",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** One character per class per account, for now. */
    class: text("class").notNull(),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    gold: integer("gold").notNull().default(0),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("characters_user_class_key").on(t.userId, t.class),
    index("characters_user_idx").on(t.userId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type CharacterRow = typeof characters.$inferSelect;

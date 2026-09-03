import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  GAME_PORT: z.coerce.number().int().default(2567),
  JWT_SECRET: z.string().min(8).default("dev-only-secret-change-me"),
  /** When 1, unsigned dev tokens are accepted. Never enable in production. */
  DEV_LOGIN: z.enum(["0", "1"]).default("0"),
  /** Optional: without it the server runs fully in memory and saves nothing. */
  DATABASE_URL: z.string().optional(),
  /** How often character progress is flushed to Postgres, in milliseconds. */
  AUTOSAVE_MS: z.coerce.number().int().min(5000).default(30000),
  NODE_ENV: z.string().default("development"),
});

export const env = Env.parse(process.env);
export const isDevLogin = env.DEV_LOGIN === "1";

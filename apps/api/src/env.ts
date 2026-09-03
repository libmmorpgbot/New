import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  /** Injected by most PaaS hosts (Railway, Render, Fly). Wins over API_PORT. */
  PORT: z.coerce.number().int().optional(),
  API_PORT: z.coerce.number().int().default(3001),
  BOT_TOKEN: z.string().default(""),
  JWT_SECRET: z.string().min(8).default("dev-only-secret-change-me"),
  JWT_TTL: z.string().default("1h"),
  DATABASE_URL: z.string().optional(),
  /** Seconds an initData payload stays acceptable. */
  INIT_DATA_TTL: z.coerce.number().int().default(3600),
  NODE_ENV: z.string().default("development"),
});

const parsed = Env.parse(process.env);

export const env = { ...parsed, API_PORT: parsed.PORT ?? parsed.API_PORT };

import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  /** Injected by most PaaS hosts (Railway, Render, Fly). Everything runs on this one port. */
  PORT: z.coerce.number().int().default(2567),

  JWT_SECRET: z.string().min(8).default("dev-only-secret-change-me"),
  JWT_TTL: z.string().default("1h"),

  /** Without a bot token the Telegram login route and the bot both stay off. */
  BOT_TOKEN: z.string().default(""),
  /** Public https address of the Mini App; the bot needs it for its launch button. */
  WEBAPP_URL: z.string().default(""),
  /** Seconds an initData payload stays acceptable. */
  INIT_DATA_TTL: z.coerce.number().int().default(3600),

  /** When 1, unsigned `dev:<name>` tokens are accepted. Never enable in production. */
  DEV_LOGIN: z.enum(["0", "1"]).default("0"),

  /** Optional: without it the server runs fully in memory and saves nothing. */
  DATABASE_URL: z.string().optional(),
  AUTOSAVE_MS: z.coerce.number().int().min(5000).default(30000),

  /** Set to 0 to run the API and game without serving the built client. */
  SERVE_CLIENT: z.enum(["0", "1"]).default("1"),
  /** Set to 0 to keep the bot from starting in this process. */
  RUN_BOT: z.enum(["0", "1"]).default("1"),

  NODE_ENV: z.string().default("development"),
});

export const env = Env.parse(process.env);

export const isDevLogin = env.DEV_LOGIN === "1";
export const canVerifyTelegram = env.BOT_TOKEN.length > 0;
export const shouldRunBot = env.RUN_BOT === "1" && Boolean(env.BOT_TOKEN) && Boolean(env.WEBAPP_URL);
export const shouldServeClient = env.SERVE_CLIENT === "1";

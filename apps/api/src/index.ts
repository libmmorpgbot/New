import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { createDb, listCharacters, upsertUser } from "@tg-mmo/db";
import { CLASS_IDS } from "@tg-mmo/shared";
import { env } from "./env";
import { displayName, verifyInitData } from "./telegram";

const app = Fastify({ logger: { level: env.NODE_ENV === "production" ? "info" : "debug" } });
const db = createDb(env.DATABASE_URL);

await app.register(cors, { origin: true });

const AuthBody = z.object({ initData: z.string().min(1) });

app.get("/health", async () => ({ ok: true, db: Boolean(db) }));

/**
 * The only place Telegram's signature is checked. Everything downstream —
 * including the game server — trusts our own JWT instead.
 */
app.post("/auth/telegram", async (request, reply) => {
  const parsed = AuthBody.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "initData обязателен" });

  if (!env.BOT_TOKEN) {
    return reply.code(503).send({ error: "BOT_TOKEN не настроен на сервере" });
  }

  let verified;
  try {
    verified = verifyInitData(parsed.data.initData, env.BOT_TOKEN, env.INIT_DATA_TTL);
  } catch (err) {
    request.log.warn({ err }, "initData rejected");
    return reply.code(401).send({ error: "Не удалось проверить данные Telegram" });
  }

  const name = displayName(verified.user);

  if (!db) {
    // No database configured: hand out a token keyed on the Telegram id alone.
    const token = jwt.sign({ sub: `tg-${verified.user.id}`, name, telegramId: verified.user.id }, env.JWT_SECRET, {
      expiresIn: env.JWT_TTL as jwt.SignOptions["expiresIn"],
    });
    return { token, name, characters: [] };
  }

  const user = await upsertUser(db, {
    telegramId: verified.user.id,
    firstName: name,
    username: verified.user.username,
    languageCode: verified.user.language_code,
  });

  const token = jwt.sign({ sub: String(user.id), name, telegramId: verified.user.id }, env.JWT_SECRET, {
    expiresIn: env.JWT_TTL as jwt.SignOptions["expiresIn"],
  });

  return { token, name, characters: await listCharacters(db, user.id) };
});

app.get("/me", async (request, reply) => {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return reply.code(401).send({ error: "Нужен Bearer-токен" });

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    return reply.code(401).send({ error: "Токен недействителен" });
  }

  const userId = Number(payload.sub);
  const characters = db && Number.isFinite(userId) ? await listCharacters(db, userId) : [];
  return { id: payload.sub, name: payload.name, classes: CLASS_IDS, characters };
});

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });

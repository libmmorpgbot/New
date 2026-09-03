import { Router, json, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { createDb, listCharacters, upsertUser } from "@tg-mmo/db";
import { CLASS_IDS } from "@tg-mmo/shared";
import { canVerifyTelegram, env, isDevLogin } from "../env";
import { signToken } from "../auth/jwt";
import { displayName, verifyInitData } from "../auth/telegram";

const db = createDb(env.DATABASE_URL);

const AuthBody = z.object({ initData: z.string().min(1) });

/**
 * Mounted at `/api`. The client is served from the same origin, so there is no
 * CORS to configure and no cross-service token hand-off to get wrong.
 */
export function apiRoutes(): Router {
  const router = Router();
  router.use(json({ limit: "16kb" }));

  /**
   * Also the client's capability probe: the browser must not offer a dev login
   * the server would reject, so this endpoint is the single source of truth.
   */
  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      db: Boolean(db),
      telegram: canVerifyTelegram,
      devLogin: isDevLogin,
      uptime: process.uptime(),
    });
  });

  /** The only place Telegram's signature is checked. */
  router.post("/auth/telegram", async (req: Request, res: Response) => {
    const parsed = AuthBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "initData обязателен" });
      return;
    }

    if (!canVerifyTelegram) {
      res.status(503).json({ error: "BOT_TOKEN не настроен на сервере" });
      return;
    }

    let verified;
    try {
      verified = verifyInitData(parsed.data.initData, env.BOT_TOKEN, env.INIT_DATA_TTL);
    } catch {
      res.status(401).json({ error: "Не удалось проверить данные Telegram" });
      return;
    }

    const name = displayName(verified.user);

    if (!db) {
      // No database configured: the token is keyed on the Telegram id alone.
      res.json({
        token: signToken({ sub: `tg-${verified.user.id}`, name, telegramId: verified.user.id }),
        name,
        characters: [],
      });
      return;
    }

    const user = await upsertUser(db, {
      telegramId: verified.user.id,
      firstName: name,
      username: verified.user.username,
      languageCode: verified.user.language_code,
    });

    res.json({
      token: signToken({ sub: String(user.id), name, telegramId: verified.user.id }),
      name,
      characters: await listCharacters(db, user.id),
    });
  });

  router.get("/me", async (req: Request, res: Response) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "Нужен Bearer-токен" });
      return;
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    } catch {
      res.status(401).json({ error: "Токен недействителен" });
      return;
    }

    const userId = Number(payload.sub);
    const characters = db && Number.isFinite(userId) ? await listCharacters(db, userId) : [];
    res.json({ id: payload.sub, name: payload.name, classes: CLASS_IDS, characters });
  });

  return router;
}

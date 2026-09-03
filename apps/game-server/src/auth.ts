import jwt from "jsonwebtoken";
import { z } from "zod";
import { env, isDevLogin } from "./env";

export const TokenPayload = z.object({
  sub: z.string(),
  name: z.string(),
  telegramId: z.number().optional(),
});
export type TokenPayload = z.infer<typeof TokenPayload>;

/**
 * Verifies the JWT minted by the API after it validated Telegram's initData.
 * The game server never sees initData itself — it only trusts our own signature.
 */
export function verifyToken(token: string | undefined): TokenPayload {
  if (!token) throw new Error("missing token");

  if (isDevLogin && token.startsWith("dev:")) {
    const name = token.slice(4).trim() || "Гость";
    return { sub: `dev-${name.toLowerCase()}`, name };
  }

  const decoded = jwt.verify(token, env.JWT_SECRET);
  return TokenPayload.parse(decoded);
}

import jwt from "jsonwebtoken";
import { z } from "zod";
import { env, isDevLogin } from "../env";

export const TokenPayload = z.object({
  sub: z.string(),
  name: z.string(),
  telegramId: z.number().optional(),
});
export type TokenPayload = z.infer<typeof TokenPayload>;

/** Mints the token the client presents when it opens the game socket. */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_TTL as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Verifies the token minted by `signToken` after initData was validated. The
 * game side never sees initData itself — it only trusts our own signature.
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

import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
}

/**
 * Validates Telegram Mini App `initData` exactly as documented:
 * secret = HMAC_SHA256("WebAppData", botToken), then the signature over the
 * sorted `key=value` lines. Anything that fails here is not a Telegram user.
 *
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  ttlSeconds: number,
): VerifiedInitData {
  const params = new URLSearchParams(initData);

  const hash = params.get("hash");
  if (!hash) throw new Error("initData: hash отсутствует");
  params.delete("hash");
  // `signature` is Telegram's newer Ed25519 field and is excluded from the HMAC check.
  params.delete("signature");

  const checkString = [...params.entries()]
    .map(([key, value]) => [key, value] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest("hex");

  const given = Buffer.from(hash, "hex");
  const want = Buffer.from(expected, "hex");
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    throw new Error("initData: подпись не совпадает");
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate) throw new Error("initData: нет auth_date");
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > ttlSeconds) throw new Error("initData: устарел");

  const rawUser = params.get("user");
  if (!rawUser) throw new Error("initData: нет user");

  const user = JSON.parse(rawUser) as TelegramUser;
  if (typeof user.id !== "number") throw new Error("initData: некорректный user");

  return { user, authDate };
}

export function displayName(user: TelegramUser): string {
  return (user.first_name || user.username || `Игрок${user.id}`).slice(0, 24);
}

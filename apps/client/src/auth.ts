import { isInsideTelegram, telegramDisplayName, tg } from "./telegram";
import { config } from "./config";

export interface Session {
  token: string;
  name: string;
}

/**
 * Trades Telegram's signed `initData` for our own JWT. The raw initData string is
 * the only thing the API trusts — never `initDataUnsafe`, which the page can forge.
 */
export async function login(): Promise<Session> {
  const initData = tg()?.initData;

  if (!initData) {
    if (!config().devLogin) {
      throw new Error("Открой игру через Telegram — вне Telegram вход недоступен.");
    }
    // Local browser testing: the game server accepts `dev:<name>` when DEV_LOGIN=1.
    const name = localStorage.getItem("devName") ?? `Гость${Math.floor(Math.random() * 900 + 100)}`;
    localStorage.setItem("devName", name);
    return { token: `dev:${name}`, name };
  }

  const res = await fetch(`${config().apiUrl}/auth/telegram`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData }),
  });

  if (!res.ok) {
    throw new Error(`Не удалось авторизоваться (${res.status})`);
  }

  const data = (await res.json()) as { token: string; name?: string };
  return { token: data.token, name: data.name ?? telegramDisplayName() };
}

export { isInsideTelegram };

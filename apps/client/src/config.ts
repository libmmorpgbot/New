/**
 * Where the client talks to, and what that server allows.
 *
 * In the default deployment one process serves this bundle, the API and the game
 * socket, so everything is same-origin and there is nothing to configure.
 * `VITE_SERVER_URL` exists only for local development, where Vite runs on its
 * own port, and for anyone who splits the server back out into services.
 */
const serverUrl = (import.meta.env.VITE_SERVER_URL || location.origin).replace(/\/$/, "");

export const apiUrl = serverUrl;
export const gameWsUrl = serverUrl.replace(/^http/, "ws");

export interface ServerInfo {
  /** True when the server accepts unsigned `dev:<name>` tokens. */
  devLogin: boolean;
  /** True when BOT_TOKEN is configured and Telegram logins can be verified. */
  telegram: boolean;
}

let info: ServerInfo = { devLogin: false, telegram: false };

export const serverInfo = (): ServerInfo => info;

/**
 * Asks the server what it supports. Whether a dev login is possible is the
 * server's decision — a build-time flag on the client could disagree with it.
 */
export async function loadServerInfo(): Promise<ServerInfo> {
  const res = await fetch(`${apiUrl}/api/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Сервер ответил ${res.status}`);

  const raw = (await res.json()) as Partial<ServerInfo>;
  info = { devLogin: raw.devLogin === true, telegram: raw.telegram === true };
  return info;
}

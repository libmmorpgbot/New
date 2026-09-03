/**
 * Where the client should talk to.
 *
 * Vite bakes `import.meta.env.*` into the bundle at build time, which on a PaaS
 * means changing a service domain would force a rebuild. So the built app also
 * asks its own static server for `/config.json` (generated from env at startup)
 * and lets that win. Locally there is no such file, the fetch fails, and the
 * `.env` values are used as-is.
 */
export interface RuntimeConfig {
  apiUrl: string;
  gameWsUrl: string;
  devLogin: boolean;
}

const fallback: RuntimeConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  gameWsUrl: import.meta.env.VITE_GAME_WS_URL ?? "ws://localhost:2567",
  devLogin: import.meta.env.VITE_DEV_LOGIN === "1",
};

let current: RuntimeConfig = fallback;

export function config(): RuntimeConfig {
  return current;
}

export async function loadConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch("config.json", { cache: "no-store" });
    if (!res.ok) return current;

    const raw = (await res.json()) as Partial<Record<keyof RuntimeConfig, unknown>>;
    current = {
      apiUrl: typeof raw.apiUrl === "string" && raw.apiUrl ? raw.apiUrl : fallback.apiUrl,
      gameWsUrl:
        typeof raw.gameWsUrl === "string" && raw.gameWsUrl ? raw.gameWsUrl : fallback.gameWsUrl,
      devLogin: raw.devLogin === true,
    };
  } catch {
    // No config.json (local dev, or the file is not served) — keep build-time values.
  }
  return current;
}

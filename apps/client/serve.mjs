/**
 * Production static server for the built Mini App.
 *
 * `vite preview` is a dev convenience and not meant to face the internet, and a
 * PaaS hands the port in via $PORT rather than a flag — so this is a small
 * static server instead of a shell one-liner that only works on Linux.
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sirv from "sirv";

const root = join(dirname(fileURLToPath(import.meta.url)), "dist");
if (!existsSync(root)) {
  console.error("dist/ не найден — сначала `pnpm --filter @tg-mmo/client build`");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4173);

/**
 * Endpoints handed to the app at runtime rather than baked into the bundle, so
 * moving the API or game server is a restart instead of a rebuild. Values here
 * override whatever `vite build` compiled in.
 */
const runtimeConfig = JSON.stringify({
  apiUrl: process.env.API_URL ?? process.env.VITE_API_URL ?? "",
  gameWsUrl: process.env.GAME_WS_URL ?? process.env.VITE_GAME_WS_URL ?? "",
  devLogin: (process.env.DEV_LOGIN ?? process.env.VITE_DEV_LOGIN) === "1",
});

/** Vite emits `name-<hash>.js`; only those filenames are safe to cache forever. */
const HASHED = /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/;
const YEAR = 31536000;

const assets = sirv(root, {
  single: true, // unknown paths fall back to index.html
  etag: true,
  gzip: true,
  brotli: true,
  setHeaders(res, pathname) {
    if (HASHED.test(pathname)) {
      res.setHeader("cache-control", `public, max-age=${YEAR}, immutable`);
      return;
    }
    // The entry document and the SPA fallback must never be cached, or a
    // redeploy keeps serving a page that points at deleted bundles.
    const isDocument = pathname.endsWith(".html") || !pathname.split("/").pop()?.includes(".");
    if (isDocument || pathname.endsWith("manifest.json")) {
      res.setHeader("cache-control", "no-cache");
      return;
    }
    res.setHeader("cache-control", "public, max-age=3600, must-revalidate");
  },
});

createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/config.json") {
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(runtimeConfig);
    return;
  }

  assets(req, res, () => {
    res.statusCode = 404;
    res.end("not found");
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`[client] serving dist/ on :${port}`);
  console.log(`[client] runtime config: ${runtimeConfig}`);
});

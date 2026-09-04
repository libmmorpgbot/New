import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RequestHandler } from "express";
import sirv from "sirv";
import { env } from "./env";

const here = dirname(fileURLToPath(import.meta.url));
export const CLIENT_DIST = join(here, "../../client/dist");

/** Vite emits `name-<hash>.js`; only those filenames are safe to cache forever. */
const HASHED = /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/;
const YEAR = 31536000;

export const clientBuilt = () => existsSync(join(CLIENT_DIST, "index.html"));

/**
 * Serves the built Mini App. Cache policy is per file kind: hashed bundles are
 * immutable, but sprites live at stable paths, so a permanent cache would leave
 * players on stale art after the assets are replaced.
 */
export function clientStatic(): RequestHandler {
  const serve = sirv(CLIENT_DIST, {
    // `dev` re-reads the directory per request; without it a rebuild while the
    // server is up keeps 404-ing the new bundles.
    dev: env.NODE_ENV !== "production",
    etag: true,
    gzip: true,
    brotli: true,
    setHeaders(res, pathname) {
      if (HASHED.test(pathname)) {
        res.setHeader("cache-control", `public, max-age=${YEAR}, immutable`);
        return;
      }
      const isDocument = pathname.endsWith(".html") || !pathname.split("/").pop()?.includes(".");
      if (isDocument || pathname.endsWith("manifest.json")) {
        res.setHeader("cache-control", "no-cache");
        return;
      }
      res.setHeader("cache-control", "public, max-age=3600, must-revalidate");
    },
  });

  return (req, res, next) => {
    serve(req, res, () => {
      const path = (req.path || "/").split("?")[0] ?? "/";
      const looksLikeFile = /\.[a-z0-9]+$/i.test(path.split("/").pop() ?? "");

      // Only navigation falls back to the app shell. Handing index.html to a
      // request for a missing .js or .css just turns a 404 into a MIME error.
      if (looksLikeFile) {
        next();
        return;
      }
      res.setHeader("cache-control", "no-cache");
      res.sendFile(join(CLIENT_DIST, "index.html"));
    });
  };
}

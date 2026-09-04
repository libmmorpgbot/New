import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import express from "express";
import { apiRoutes } from "./api/routes";
import { startBot } from "./bot/bot";
import {
  canVerifyTelegram,
  env,
  isDevLogin,
  shouldRunBot,
  shouldServeClient,
} from "./env";
import { GameRoom } from "./game/rooms/GameRoom";
import { prepareDatabase } from "./game/persistence";
import { clientBuilt, clientStatic } from "./static";

if (env.DATABASE_URL) {
  try {
    await prepareDatabase();
    console.log("[server] схема БД актуальна");
  } catch (err) {
    // Starting without a usable schema would only fail later, on the first login.
    console.error("[server] не удалось применить миграции:", err);
    process.exit(1);
  }
}

const app = express();

app.use("/api", apiRoutes());

// Room inspector — handy in development, gate it behind auth before shipping.
if (env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

/**
 * The built client is served from this same process, which is what makes the
 * whole game a single deployable: same origin means no CORS and no endpoint
 * configuration for the browser to get wrong. It stays a catch-all, so it is
 * mounted after every real route.
 */
if (shouldServeClient) {
  if (clientBuilt()) {
    app.use(clientStatic());
  } else {
    console.warn("[server] apps/client/dist не собран — отдаю только API и игру");
  }
}

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("world", GameRoom);

await gameServer.listen(env.PORT, "0.0.0.0");

console.log(`[server] listening on :${env.PORT}`);
console.log(
  `[server] client=${shouldServeClient && clientBuilt() ? "on" : "off"} ` +
    `telegram-auth=${canVerifyTelegram ? "on" : "off"} ` +
    `dev-login=${isDevLogin ? "ON (небезопасно для продакшена)" : "off"} ` +
    `db=${env.DATABASE_URL ? "on" : "off"}`,
);

if (shouldRunBot) {
  startBot(env.BOT_TOKEN, env.WEBAPP_URL).catch((err) =>
    console.error("[bot] не удалось запустить", err),
  );
} else if (env.RUN_BOT === "1") {
  console.log("[server] бот выключен: нужны BOT_TOKEN и WEBAPP_URL");
}

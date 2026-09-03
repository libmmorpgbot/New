import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import express from "express";
import { env } from "./env";
import { GameRoom } from "./rooms/GameRoom";

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Room inspector — handy in development, gate it behind auth before shipping.
if (env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("world", GameRoom);

await gameServer.listen(env.GAME_PORT, "0.0.0.0");
console.log(`[game-server] listening on :${env.GAME_PORT}`);

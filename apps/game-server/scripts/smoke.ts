/**
 * Connects a headless bot to the running game server, walks it around and
 * swings at whatever is nearby. Use it to sanity-check the room, and as the
 * starting point for a load test (`BOTS=50 pnpm smoke`).
 */
import { Client } from "colyseus.js";
import { INPUT_SEND_HZ, MSG, type ClassId } from "@tg-mmo/shared";

const endpoint = process.env.GAME_WS_URL ?? "ws://localhost:2567";
const botCount = Number(process.env.BOTS ?? 1);
const runMs = Number(process.env.RUN_MS ?? 6000);
const classes: ClassId[] = ["mage", "ranger", "deathknight"];

async function runBot(index: number) {
  const client = new Client(endpoint);
  const room = await client.joinOrCreate("world", {
    token: `dev:bot${index}`,
    cls: classes[index % classes.length],
  });

  let seq = 0;
  let hits = 0;
  room.onMessage(MSG.attack, () => {});
  room.onMessage("hit", () => hits++);

  const angle = (index / Math.max(1, botCount)) * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  const interval = setInterval(() => {
    room.send(MSG.input, { seq: seq++, dx, dy, dt: 1000 / INPUT_SEND_HZ });
    if (seq % 10 === 0) room.send(MSG.attack, {});
  }, 1000 / INPUT_SEND_HZ);

  await new Promise((resolve) => setTimeout(resolve, runMs));
  clearInterval(interval);

  const me = room.state.players.get(room.sessionId);
  const report = {
    bot: index,
    sessionId: room.sessionId,
    players: room.state.players.size,
    monsters: room.state.monsters.size,
    pos: me ? { x: Math.round(me.x), y: Math.round(me.y) } : null,
    dir: me?.dir,
    action: me?.action,
    hp: me ? `${me.hp}/${me.maxHp}` : null,
    xp: me?.xp,
    lastSeq: me?.lastSeq,
    hitEvents: hits,
  };
  await room.leave();
  return report;
}

const results = await Promise.all(
  Array.from({ length: botCount }, (_, i) => runBot(i)),
);
console.log(JSON.stringify(results, null, 2));
process.exit(0);

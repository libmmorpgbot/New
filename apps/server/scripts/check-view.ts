/**
 * Checks the area-of-interest filter end-to-end, over real connections: that a
 * client is sent only the entities near its own player, that both edges of the
 * hysteresis band hold, and that players drop out of each other's view as they
 * separate and come back once they close again.
 *
 * Needs a server running with DEV_LOGIN=1 (`pnpm start`), same as `smoke`.
 */
import { Client, type Room } from "colyseus.js";
import {
  EVT,
  INPUT_SEND_HZ,
  MAP_HEIGHT,
  MAP_WIDTH,
  MSG,
  SPAWN_POINT,
  SPAWN_ZONES,
  TILE_SIZE,
  VIEW_HYSTERESIS,
  VIEW_RADIUS,
  VIEW_REFRESH_MS,
} from "@tg-mmo/shared";

const endpoint = process.env.GAME_WS_URL ?? "ws://localhost:2567";
const LEAVE_RADIUS = VIEW_RADIUS + VIEW_HYSTERESIS;
const TOTAL_MONSTERS = SPAWN_ZONES.reduce((n, zone) => n + zone.count, 0);

/**
 * Positions read by the harness are a patch old and views refresh only every
 * `VIEW_REFRESH_MS`, so samples close to either edge of the band say nothing.
 * Only what is comfortably inside or outside is worth asserting on.
 */
const SETTLE_MARGIN = 140;
const CERTAINLY_SEEN = VIEW_RADIUS - SETTLE_MARGIN;
const CERTAINLY_UNSEEN = LEAVE_RADIUS + SETTLE_MARGIN;

const STEP_MS = 1000 / INPUT_SEND_HZ;

interface Entity {
  x: number;
  y: number;
}
interface WorldState {
  players: Map<string, Entity>;
  monsters: Map<string, Entity>;
}
type WorldRoom = Room<WorldState>;

let failures = 0;

function check(ok: boolean, label: string, detail = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function join(name: string): Promise<WorldRoom> {
  const room = await new Client(endpoint).joinOrCreate<WorldState>("world", {
    token: `dev:${name}`,
    cls: "mage",
  });
  // The bots do nothing with these, but an unhandled type logs on every arrival.
  for (const type of Object.values(EVT)) room.onMessage(type, () => {});
  // The first patch is what carries the seeded view.
  for (let i = 0; i < 60 && !room.state?.players?.get(room.sessionId); i++) await sleep(50);
  return room;
}

const self = (room: WorldRoom) => room.state.players.get(room.sessionId);
const sees = (room: WorldRoom, other: WorldRoom) => !!room.state.players.get(other.sessionId);

function furthestMonster(room: WorldRoom): { count: number; distance: number } {
  const me = self(room);
  const monsters = [...(room.state.monsters?.values() ?? [])];
  if (!me) return { count: monsters.length, distance: NaN };
  return {
    count: monsters.length,
    distance: monsters.reduce((max, m) => Math.max(max, Math.hypot(m.x - me.x, m.y - me.y)), 0),
  };
}

/**
 * The heading out of spawn with the most room between the spawn zones. Nothing
 * about the walk needs it to be exact — it just keeps the bots alive long
 * enough to separate, on whatever layout `SPAWN_ZONES` currently describes.
 */
function clearestHeading(reach: number): number {
  const centres = SPAWN_ZONES.map((zone) => ({
    x: zone.tx * TILE_SIZE + TILE_SIZE / 2,
    y: zone.ty * TILE_SIZE + TILE_SIZE / 2,
    r: zone.radius * TILE_SIZE,
  }));

  let best = 0;
  let bestClearance = -Infinity;
  for (let i = 0; i < 360; i++) {
    const angle = (i / 360) * Math.PI * 2;
    let clearance = Infinity;
    for (let d = 0; d <= reach; d += 16) {
      const x = SPAWN_POINT.x + Math.cos(angle) * d;
      const y = SPAWN_POINT.y + Math.sin(angle) * d;
      if (x < TILE_SIZE || y < TILE_SIZE || x > MAP_WIDTH - TILE_SIZE || y > MAP_HEIGHT - TILE_SIZE) {
        clearance = -Infinity;
        break;
      }
      for (const zone of centres) {
        clearance = Math.min(clearance, Math.hypot(x - zone.x, y - zone.y) - zone.r);
      }
    }
    if (clearance > bestClearance) {
      bestClearance = clearance;
      best = angle;
    }
  }
  return best;
}

interface Sample {
  distance: number;
  mutual: boolean;
  either: boolean;
}

function sample(a: WorldRoom, b: WorldRoom): Sample | null {
  const pa = self(a);
  const pb = self(b);
  if (!pa || !pb) return null;
  const aSeesB = sees(a, b);
  const bSeesA = sees(b, a);
  return {
    distance: Math.hypot(pa.x - pb.x, pa.y - pb.y),
    mutual: aSeesB && bSeesA,
    either: aSeesB || bSeesA,
  };
}

let seq = 1;

function push(room: WorldRoom, dx: number, dy: number): void {
  room.send(MSG.input, { seq, dx, dy, dt: STEP_MS });
}

/**
 * Walks the pair apart along opposite headings, collecting samples. Monsters
 * will kill a level 1 bot on the way out; that is fine and even helps — a
 * corpse holds its position for the whole respawn delay.
 */
async function separate(a: WorldRoom, b: WorldRoom, samples: Sample[]): Promise<number> {
  const heading = clearestHeading(LEAVE_RADIUS / 2);
  const [dx, dy] = [Math.cos(heading), Math.sin(heading)];
  let reached = 0;
  let settled = 0;

  for (let step = 0; step < 900; step++) {
    push(a, dx, dy);
    push(b, -dx, -dy);
    seq++;

    const now = sample(a, b);
    if (now) {
      samples.push(now);
      reached = Math.max(reached, now.distance);
      if (now.distance >= CERTAINLY_UNSEEN && ++settled >= 8) return reached;
    }
    await sleep(STEP_MS);
  }
  return reached;
}

/** Walks the pair back together until they are well inside the view radius. */
async function reunite(a: WorldRoom, b: WorldRoom, samples: Sample[]): Promise<number> {
  let closest = Infinity;

  for (let step = 0; step < 900; step++) {
    const pa = self(a);
    const pb = self(b);
    if (pa && pb) {
      const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
      const dx = (pb.x - pa.x) / len;
      const dy = (pb.y - pa.y) / len;
      push(a, dx, dy);
      push(b, -dx, -dy);
      seq++;
    }

    const now = sample(a, b);
    if (now) {
      samples.push(now);
      closest = Math.min(closest, now.distance);
      if (now.distance <= CERTAINLY_SEEN && now.mutual) return closest;
    }
    await sleep(STEP_MS);
  }
  return closest;
}

async function main(): Promise<void> {
  const alice = await join("view-alice");

  check(!!self(alice), "own player is always in view");
  check(!!alice.state.monsters, "monsters map reaches a client that can see some");

  const atSpawn = furthestMonster(alice);
  check(
    atSpawn.count > 0 && atSpawn.count < TOTAL_MONSTERS,
    "only part of the world is streamed",
    `${atSpawn.count} of ${TOTAL_MONSTERS} monsters`,
  );
  check(
    atSpawn.distance <= LEAVE_RADIUS,
    "no monster past the leave radius is streamed",
    `furthest ${atSpawn.distance.toFixed(0)}px, limit ${LEAVE_RADIUS}px`,
  );

  const bob = await join("view-bob");
  await sleep(VIEW_REFRESH_MS * 3);
  check(
    sees(alice, bob) && sees(bob, alice),
    "players spawned together see each other",
    `${(sample(alice, bob)?.distance ?? NaN).toFixed(0)}px apart`,
  );

  const samples: Sample[] = [];
  const furthestApart = await separate(alice, bob, samples);
  check(
    furthestApart >= CERTAINLY_UNSEEN,
    "the bots got far enough apart to exercise the far band",
    `reached ${furthestApart.toFixed(0)}px, needed ${CERTAINLY_UNSEEN}px`,
  );

  const moved = furthestMonster(bob);
  check(
    Number.isNaN(moved.distance) || moved.distance <= LEAVE_RADIUS,
    "the view follows a player as it moves",
    `${moved.count} monsters, furthest ${moved.distance.toFixed(0)}px`,
  );

  const closest = await reunite(alice, bob, samples);
  check(
    closest <= CERTAINLY_SEEN && sees(alice, bob) && sees(bob, alice),
    "players coming back together re-enter each other's view",
    `closed to ${closest.toFixed(0)}px`,
  );

  const nearMisses = samples.filter((s) => s.distance <= CERTAINLY_SEEN && !s.mutual).length;
  const farLeaks = samples.filter((s) => s.distance >= CERTAINLY_UNSEEN && s.either).length;

  check(
    nearMisses === 0,
    "every close-range sample had both players in view",
    `${samples.length} samples, ${nearMisses} missing`,
  );
  check(
    farLeaks === 0,
    "no long-range sample leaked a player into view",
    `${samples.length} samples, ${farLeaks} leaked`,
  );

  await alice.leave();
  await bob.leave();

  console.log(failures === 0 ? "\narea of interest ok" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

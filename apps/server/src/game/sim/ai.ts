import {
  SAFE_ZONE_RADIUS,
  SPAWN_POINT,
  dir4Index,
  distance,
  findFreeSpot,
  moveWithCollision,
} from "@tg-mmo/shared";
import { damagePlayer } from "./combat";
import type { SimContext } from "./context";
import type { MonsterRuntime, PlayerRuntime } from "./types";

const ATTACK_ANIM_MS = 520;
const WANDER_RADIUS = 90;

/**
 * One AI step for every monster. States are implicit: a monster with a target
 * chases and swings, one without wanders near its anchor and looks for prey.
 */
export function updateMonsters(ctx: SimContext, dtSec: number): void {
  for (const monster of ctx.monsters.values()) {
    if (monster.state.hp <= 0) {
      handleCorpse(ctx, monster);
      continue;
    }

    const target = pickTarget(ctx, monster);

    if (!target) {
      monster.targetSessionId = null;
      wander(ctx, monster, dtSec);
      continue;
    }

    monster.targetSessionId = target.sessionId;
    const dist = distance(monster.state.x, monster.state.y, target.state.x, target.state.y);
    const dx = target.state.x - monster.state.x;
    const dy = target.state.y - monster.state.y;
    monster.state.dir = dir4Index(dx, dy);

    if (ctx.now < monster.busyUntil) {
      monster.state.action = "attack";
      continue;
    }

    const reach = monster.def.attackRange + monster.def.radius;
    if (dist <= reach) {
      if (ctx.now >= monster.attackReadyAt) {
        monster.attackReadyAt = ctx.now + monster.def.attackCooldownMs;
        monster.busyUntil = ctx.now + ATTACK_ANIM_MS;
        monster.state.action = "attack";
        damagePlayer(ctx, target, monster);
      } else {
        monster.state.action = "idle";
      }
      continue;
    }

    if (monster.def.moveSpeed === 0) {
      monster.state.action = "idle";
      continue;
    }

    step(ctx, monster, dx / dist, dy / dist, monster.def.moveSpeed * dtSec);
    monster.state.action = "run";
  }
}

function handleCorpse(ctx: SimContext, monster: MonsterRuntime): void {
  if (monster.removeAt !== 0 && ctx.now >= monster.removeAt) {
    monster.removeAt = 0;
    monster.state.action = "idle";
  }
  if (ctx.now >= monster.respawnAt && monster.respawnAt !== 0) {
    monster.respawnAt = 0;
    monster.state.hp = monster.def.maxHp;
    monster.state.x = monster.homeX;
    monster.state.y = monster.homeY;
    monster.state.action = "idle";
    monster.attackReadyAt = 0;
    monster.busyUntil = 0;
  }
}

/** Keeps the current target while it stays in leash range; otherwise looks for the closest player in aggro range. */
function pickTarget(ctx: SimContext, monster: MonsterRuntime): PlayerRuntime | null {
  const leash = monster.def.leashRadius;

  if (monster.targetSessionId) {
    const current = ctx.players.get(monster.targetSessionId);
    if (current && !current.state.dead && !inSafeZone(current.state.x, current.state.y)) {
      const fromHome = distance(monster.state.x, monster.state.y, monster.homeX, monster.homeY);
      const toTarget = distance(monster.state.x, monster.state.y, current.state.x, current.state.y);
      const stillEngaged = leash === 0 ? toTarget <= monster.def.aggroRadius : fromHome <= leash;
      if (stillEngaged && toTarget <= monster.def.aggroRadius * 1.8) return current;
    }
  }

  let best: PlayerRuntime | null = null;
  let bestDist = monster.def.aggroRadius;
  for (const player of ctx.players.values()) {
    if (player.state.dead || inSafeZone(player.state.x, player.state.y)) continue;
    const d = distance(monster.state.x, monster.state.y, player.state.x, player.state.y);
    if (d < bestDist) {
      bestDist = d;
      best = player;
    }
  }
  return best;
}

function wander(ctx: SimContext, monster: MonsterRuntime, dtSec: number): void {
  if (monster.def.moveSpeed === 0) {
    monster.state.action = "idle";
    return;
  }

  const home = distance(monster.state.x, monster.state.y, monster.homeX, monster.homeY);
  if (home > 8 && (monster.def.leashRadius === 0 || home > WANDER_RADIUS)) {
    // Walk back to the anchor before idling again.
    const dx = monster.homeX - monster.state.x;
    const dy = monster.homeY - monster.state.y;
    monster.state.dir = dir4Index(dx, dy);
    step(ctx, monster, dx / home, dy / home, monster.def.moveSpeed * dtSec);
    monster.state.action = "run";
    return;
  }

  if (ctx.now >= monster.wanderUntil) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * WANDER_RADIUS;
    monster.wanderX = monster.homeX + Math.cos(angle) * radius;
    monster.wanderY = monster.homeY + Math.sin(angle) * radius;
    monster.wanderUntil = ctx.now + 2500 + Math.random() * 4000;
  }

  const d = distance(monster.state.x, monster.state.y, monster.wanderX, monster.wanderY);
  if (d < 6) {
    monster.state.action = "idle";
    return;
  }

  const dx = (monster.wanderX - monster.state.x) / d;
  const dy = (monster.wanderY - monster.state.y) / d;
  monster.state.dir = dir4Index(dx, dy);
  step(ctx, monster, dx, dy, monster.def.moveSpeed * 0.45 * dtSec);
  monster.state.action = "run";
}

function step(ctx: SimContext, monster: MonsterRuntime, nx: number, ny: number, dist: number): void {
  const next = moveWithCollision(
    ctx.tiles,
    monster.state.x,
    monster.state.y,
    nx * dist,
    ny * dist,
    monster.def.radius,
  );
  // Block only crossings into the plaza — a monster that somehow starts inside can still leave.
  if (!inSafeZone(monster.state.x, monster.state.y) && inSafeZone(next.x, next.y)) return;
  monster.state.x = next.x;
  monster.state.y = next.y;
}

/** The spawn plaza is off limits to monsters, so respawning is never a death loop. */
function inSafeZone(x: number, y: number): boolean {
  return distance(x, y, SPAWN_POINT.x, SPAWN_POINT.y) < SAFE_ZONE_RADIUS;
}

/** Re-anchors a monster if its spawn point ended up inside geometry. */
export function ensureAnchor(tiles: Uint8Array, monster: MonsterRuntime): void {
  const spot = findFreeSpot(tiles, monster.homeX, monster.homeY, monster.def.radius);
  monster.homeX = spot.x;
  monster.homeY = spot.y;
  monster.state.x = spot.x;
  monster.state.y = spot.y;
}

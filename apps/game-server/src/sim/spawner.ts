import {
  MONSTERS,
  SPAWN_ZONES,
  TILE_SIZE,
  findFreeSpot,
  mulberry32,
  WORLD_SEED,
} from "@tg-mmo/shared";
import { MonsterState } from "../rooms/schema";
import type { MonsterRuntime } from "./types";

/**
 * Builds the full monster population once at room start. Individual monsters are
 * respawned in place afterwards rather than re-rolled, so a zone keeps its shape.
 */
export function spawnAll(tiles: Uint8Array): Map<string, MonsterRuntime> {
  const rnd = mulberry32(WORLD_SEED ^ 0x5f3759df);
  const out = new Map<string, MonsterRuntime>();
  let n = 0;

  for (const zone of SPAWN_ZONES) {
    for (let i = 0; i < zone.count; i++) {
      const kind = zone.monsters[Math.floor(rnd() * zone.monsters.length)]!;
      const def = MONSTERS[kind];
      if (!def) continue;

      const angle = rnd() * Math.PI * 2;
      const dist = Math.sqrt(rnd()) * zone.radius * TILE_SIZE;
      const spot = findFreeSpot(
        tiles,
        zone.tx * TILE_SIZE + Math.cos(angle) * dist,
        zone.ty * TILE_SIZE + Math.sin(angle) * dist,
        def.radius,
      );

      const id = `m${n++}`;
      const state = new MonsterState();
      state.id = id;
      state.kind = kind;
      state.x = spot.x;
      state.y = spot.y;
      state.hp = def.maxHp;
      state.maxHp = def.maxHp;
      state.level = def.level;
      state.action = "idle";

      out.set(id, {
        state,
        def,
        homeX: spot.x,
        homeY: spot.y,
        targetSessionId: null,
        attackReadyAt: 0,
        busyUntil: 0,
        removeAt: 0,
        respawnAt: 0,
        wanderUntil: 0,
        wanderX: spot.x,
        wanderY: spot.y,
      });
    }
  }

  return out;
}

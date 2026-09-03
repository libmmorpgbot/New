/**
 * Sanity-checks the generated world: that no spawn zone reaches into the safe
 * plaza, that zones do not overlap each other, and that every zone has room to
 * actually place its monsters. Run it after touching SPAWN_ZONES or the map.
 */
import {
  MAP_TILES_X,
  MAP_TILES_Y,
  MONSTERS,
  SAFE_ZONE_RADIUS,
  SPAWN_ZONES,
  TILE_SIZE,
  generateTiles,
  isSolidAt,
} from "@tg-mmo/shared";

const tiles = generateTiles();
let problems = 0;

for (const zone of SPAWN_ZONES) {
  const distTiles = Math.hypot(zone.tx - MAP_TILES_X / 2, zone.ty - MAP_TILES_Y / 2);
  const nearestPx = (distTiles - zone.radius) * TILE_SIZE;
  const levels = zone.monsters.map((id) => MONSTERS[id]?.level ?? 0);

  let cells = 0;
  let solid = 0;
  for (let y = -zone.radius; y <= zone.radius; y++) {
    for (let x = -zone.radius; x <= zone.radius; x++) {
      if (Math.hypot(x, y) > zone.radius) continue;
      cells++;
      const px = (zone.tx + x) * TILE_SIZE + TILE_SIZE / 2;
      const py = (zone.ty + y) * TILE_SIZE + TILE_SIZE / 2;
      if (isSolidAt(tiles, px, py)) solid++;
    }
  }

  const tooClose = nearestPx <= SAFE_ZONE_RADIUS;
  const tooSolid = cells - solid < zone.count * 2;
  if (tooClose || tooSolid) problems++;

  console.log(
    `${zone.id.padEnd(9)} dist=${distTiles.toFixed(1)}t  nearest=${nearestPx.toFixed(0)}px ` +
      `${tooClose ? "<< INSIDE SAFE ZONE" : "ok"}  levels=${Math.min(...levels)}-${Math.max(...levels)} ` +
      `free=${cells - solid}/${cells}${tooSolid ? " << TOO CROWDED" : ""}`,
  );
}

for (let i = 0; i < SPAWN_ZONES.length; i++) {
  for (let j = i + 1; j < SPAWN_ZONES.length; j++) {
    const a = SPAWN_ZONES[i]!;
    const b = SPAWN_ZONES[j]!;
    const d = Math.hypot(a.tx - b.tx, a.ty - b.ty);
    if (d < a.radius + b.radius) {
      problems++;
      console.log(`OVERLAP ${a.id}/${b.id}: distance ${d.toFixed(1)} < ${a.radius + b.radius}`);
    }
  }
}

const total = SPAWN_ZONES.reduce((n, z) => n + z.count, 0);
console.log(`\n${SPAWN_ZONES.length} zones, ${total} monsters, ${MAP_TILES_X}x${MAP_TILES_Y} tiles`);
console.log(problems === 0 ? "world layout ok" : `${problems} problem(s) found`);
process.exit(problems === 0 ? 0 : 1);

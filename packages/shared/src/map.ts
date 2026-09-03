import { MAP_TILES_X, MAP_TILES_Y, TILE_SIZE } from "./constants";
import { mulberry32 } from "./math";

export const TILE_GRASS = 0;
export const TILE_DIRT = 1;
export const TILE_ROCK = 2;
export const TILE_WATER = 3;

export const SOLID_TILES = new Set<number>([TILE_ROCK, TILE_WATER]);

export const WORLD_SEED = 20260903;

/**
 * The world is generated from a seed rather than shipped as a Tiled file so the
 * server and the client agree on collision without an asset round-trip. Swap this
 * for a real `.tmj` import once there is tileset art — `isSolidAt` is the only
 * thing the simulation depends on.
 */
export function generateTiles(seed = WORLD_SEED): Uint8Array {
  const rnd = mulberry32(seed);
  const tiles = new Uint8Array(MAP_TILES_X * MAP_TILES_Y);

  for (let y = 0; y < MAP_TILES_Y; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      tiles[y * MAP_TILES_X + x] = rnd() < 0.07 ? TILE_DIRT : TILE_GRASS;
    }
  }

  // A lake along the northern edge, clear of every spawn zone.
  const lakeX = Math.floor(MAP_TILES_X * 0.5);
  const lakeY = 6;
  for (let y = -3; y <= 3; y++) {
    for (let x = -8; x <= 8; x++) {
      if ((x * x) / 64 + (y * y) / 9 <= 1) setTile(tiles, lakeX + x, lakeY + y, TILE_WATER);
    }
  }

  // Scattered rock clusters, kept clear of the central spawn plaza.
  for (let i = 0; i < 90; i++) {
    const cx = Math.floor(rnd() * MAP_TILES_X);
    const cy = Math.floor(rnd() * MAP_TILES_Y);
    if (Math.hypot(cx - MAP_TILES_X / 2, cy - MAP_TILES_Y / 2) < 8) continue;
    const size = 1 + Math.floor(rnd() * 3);
    for (let y = -size; y <= size; y++) {
      for (let x = -size; x <= size; x++) {
        if (Math.hypot(x, y) <= size && rnd() > 0.25) setTile(tiles, cx + x, cy + y, TILE_ROCK);
      }
    }
  }

  // Solid border so nothing can wander off the edge of the world.
  for (let x = 0; x < MAP_TILES_X; x++) {
    setTile(tiles, x, 0, TILE_ROCK);
    setTile(tiles, x, MAP_TILES_Y - 1, TILE_ROCK);
  }
  for (let y = 0; y < MAP_TILES_Y; y++) {
    setTile(tiles, 0, y, TILE_ROCK);
    setTile(tiles, MAP_TILES_X - 1, y, TILE_ROCK);
  }

  return tiles;
}

function setTile(tiles: Uint8Array, x: number, y: number, value: number): void {
  if (x < 0 || y < 0 || x >= MAP_TILES_X || y >= MAP_TILES_Y) return;
  tiles[y * MAP_TILES_X + x] = value;
}

export function tileAt(tiles: Uint8Array, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= MAP_TILES_X || ty >= MAP_TILES_Y) return TILE_ROCK;
  return tiles[ty * MAP_TILES_X + tx]!;
}

/** Pixel-space solidity test. */
export function isSolidAt(tiles: Uint8Array, x: number, y: number): boolean {
  return SOLID_TILES.has(tileAt(tiles, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)));
}

/**
 * Axis-separated circle sweep. Moving each axis independently means brushing a
 * wall slides along it instead of sticking, which is what players expect.
 */
export function moveWithCollision(
  tiles: Uint8Array,
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius: number,
): { x: number; y: number } {
  let nx = x;
  let ny = y;

  if (dx !== 0) {
    const probe = nx + dx + Math.sign(dx) * radius;
    if (!isSolidAt(tiles, probe, ny - radius * 0.6) && !isSolidAt(tiles, probe, ny + radius * 0.6)) {
      nx += dx;
    }
  }
  if (dy !== 0) {
    const probe = ny + dy + Math.sign(dy) * radius;
    if (!isSolidAt(tiles, nx - radius * 0.6, probe) && !isSolidAt(tiles, nx + radius * 0.6, probe)) {
      ny += dy;
    }
  }
  return { x: nx, y: ny };
}

export const SPAWN_POINT = {
  x: (MAP_TILES_X / 2) * TILE_SIZE,
  y: (MAP_TILES_Y / 2) * TILE_SIZE,
};

/** Finds a walkable pixel position near `x,y`, spiralling outwards. */
export function findFreeSpot(tiles: Uint8Array, x: number, y: number, radius = 12): { x: number; y: number } {
  if (!isSolidAt(tiles, x, y)) return { x, y };
  for (let ring = 1; ring < 20; ring++) {
    for (let a = 0; a < 12; a++) {
      const angle = (a / 12) * Math.PI * 2;
      const px = x + Math.cos(angle) * ring * TILE_SIZE;
      const py = y + Math.sin(angle) * ring * TILE_SIZE;
      if (!isSolidAt(tiles, px, py) && !isSolidAt(tiles, px, py + radius)) return { x: px, y: py };
    }
  }
  return { ...SPAWN_POINT };
}

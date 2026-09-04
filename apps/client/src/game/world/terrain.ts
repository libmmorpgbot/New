import Phaser from "phaser";
import {
  MAP_HEIGHT,
  MAP_TILES_X,
  MAP_TILES_Y,
  MAP_WIDTH,
  TILE_DIRT,
  TILE_GRASS,
  TILE_ROCK,
  TILE_SIZE,
  TILE_WATER,
  mulberry32,
} from "@tg-mmo/shared";

const TERRAIN_KEY = "terrain-map";

const PALETTE: Record<number, { base: number; speckle: number }> = {
  [TILE_GRASS]: { base: 0x2f5d3a, speckle: 0x3a7047 },
  [TILE_DIRT]: { base: 0x4e4130, speckle: 0x5c4d39 },
  [TILE_ROCK]: { base: 0x4a4f5c, speckle: 0x5d6373 },
  [TILE_WATER]: { base: 0x1d3f63, speckle: 0x27527f },
};

/**
 * The art pack ships characters only, so the ground is generated: one 32px tile
 * per terrain type, speckled so large fields do not read as flat colour.
 *
 * The whole map is baked into a single texture once, rather than kept as a live
 * tilemap layer. A tilemap re-submits one quad per visible tile every frame —
 * with the camera pulled back that is around a thousand quads, and on a phone
 * that alone eats the frame. Baked, the ground costs exactly one quad.
 *
 * Replace with a real tileset image and this is the only function that changes.
 */
function bakeTerrain(scene: Phaser.Scene, tiles: Uint8Array): boolean {
  if (scene.textures.exists(TERRAIN_KEY)) return true;

  const canvas = scene.textures.createCanvas(TERRAIN_KEY, MAP_WIDTH, MAP_HEIGHT);
  const ctx = canvas?.context;
  if (!canvas || !ctx) return false;

  const rnd = mulberry32(0xc0ffee);

  for (let ty = 0; ty < MAP_TILES_Y; ty++) {
    for (let tx = 0; tx < MAP_TILES_X; tx++) {
      const id = tiles[ty * MAP_TILES_X + tx]!;
      const { base, speckle } = PALETTE[id] ?? PALETTE[TILE_GRASS]!;
      const ox = tx * TILE_SIZE;
      const oy = ty * TILE_SIZE;

      ctx.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
      ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);

      ctx.fillStyle = `#${speckle.toString(16).padStart(6, "0")}`;
      for (let i = 0; i < 12; i++) {
        ctx.fillRect(ox + Math.floor(rnd() * TILE_SIZE), oy + Math.floor(rnd() * TILE_SIZE), 2, 2);
      }

      if (id === TILE_ROCK) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(ox, oy + TILE_SIZE - 5, TILE_SIZE, 5);
      }
    }
  }

  canvas.refresh();
  return true;
}

/** Builds the static ground as one baked image. */
export function createTerrain(scene: Phaser.Scene, tiles: Uint8Array): Phaser.GameObjects.Image | null {
  if (!bakeTerrain(scene, tiles)) return null;

  return scene.add.image(0, 0, TERRAIN_KEY).setOrigin(0, 0).setDepth(-1000);
}

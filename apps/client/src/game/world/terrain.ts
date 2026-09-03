import Phaser from "phaser";
import {
  MAP_TILES_X,
  MAP_TILES_Y,
  TILE_GRASS,
  TILE_DIRT,
  TILE_ROCK,
  TILE_SIZE,
  TILE_WATER,
  mulberry32,
} from "@tg-mmo/shared";

const TILESET_KEY = "terrain-tiles";

const PALETTE: Record<number, { base: number; speckle: number }> = {
  [TILE_GRASS]: { base: 0x2f5d3a, speckle: 0x3a7047 },
  [TILE_DIRT]: { base: 0x4e4130, speckle: 0x5c4d39 },
  [TILE_ROCK]: { base: 0x4a4f5c, speckle: 0x5d6373 },
  [TILE_WATER]: { base: 0x1d3f63, speckle: 0x27527f },
};

/**
 * The art pack ships characters only, so the ground is generated: one 32px tile
 * per terrain type, speckled so large fields do not read as flat colour.
 * Replace with a real tileset image and this is the only function that changes.
 */
function buildTilesetTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TILESET_KEY)) return;

  const ids = [TILE_GRASS, TILE_DIRT, TILE_ROCK, TILE_WATER];
  const canvas = scene.textures.createCanvas(TILESET_KEY, TILE_SIZE * ids.length, TILE_SIZE);
  const ctx = canvas?.context;
  if (!canvas || !ctx) return;

  const rnd = mulberry32(0xc0ffee);
  ids.forEach((id, index) => {
    const { base, speckle } = PALETTE[id]!;
    const ox = index * TILE_SIZE;
    ctx.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
    ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = `#${speckle.toString(16).padStart(6, "0")}`;
    for (let i = 0; i < 34; i++) {
      const x = ox + Math.floor(rnd() * TILE_SIZE);
      const y = Math.floor(rnd() * TILE_SIZE);
      ctx.fillRect(x, y, 2, 2);
    }
    if (id === TILE_ROCK) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(ox, TILE_SIZE - 5, TILE_SIZE, 5);
    }
  });

  canvas.refresh();
}

/** Builds the static ground layer. Phaser culls off-screen tiles for us. */
export function createTerrain(scene: Phaser.Scene, tiles: Uint8Array): Phaser.Tilemaps.TilemapLayer | null {
  buildTilesetTexture(scene);

  const data: number[][] = [];
  for (let y = 0; y < MAP_TILES_Y; y++) {
    const row: number[] = new Array(MAP_TILES_X);
    for (let x = 0; x < MAP_TILES_X; x++) row[x] = tiles[y * MAP_TILES_X + x]!;
    data.push(row);
  }

  const map = scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
  const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
  if (!tileset) return null;

  const layer = map.createLayer(0, tileset, 0, 0);
  layer?.setDepth(-1000);
  return layer;
}

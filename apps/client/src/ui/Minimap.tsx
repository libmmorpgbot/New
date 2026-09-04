import { useEffect, useRef } from "react";
import {
  MAP_TILES_X,
  MAP_TILES_Y,
  SOLID_TILES,
  TILE_SIZE,
  TILE_WATER,
  generateTiles,
} from "@tg-mmo/shared";
import { getRoom, type MonsterView, type PlayerView } from "../net/net";

const SIZE = 92;
/** How much of the world the minimap covers, in pixels. */
const SPAN = 900;

/** The terrain never changes, so it is rasterised once and reused every frame. */
function buildTerrain(): HTMLCanvasElement {
  const tiles = generateTiles();
  const canvas = document.createElement("canvas");
  canvas.width = MAP_TILES_X;
  canvas.height = MAP_TILES_Y;
  const ctx = canvas.getContext("2d")!;

  for (let y = 0; y < MAP_TILES_Y; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      const tile = tiles[y * MAP_TILES_X + x]!;
      ctx.fillStyle = tile === TILE_WATER ? "#16324f" : SOLID_TILES.has(tile) ? "#2b3446" : "#1b2c22";
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

let terrain: HTMLCanvasElement | null = null;

export default function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    terrain ??= buildTerrain();
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // The minimap is glanceable, not a viewport — redrawing it every frame just
    // steals time from the game loop.
    const draw = () => {
      const room = getRoom();
      const self = room?.state?.players?.get(room.sessionId) as PlayerView | undefined;
      if (!self) return;

      const scale = SIZE / SPAN;
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Terrain, centred on the player.
      ctx.imageSmoothingEnabled = false;
      const worldToPx = SIZE / (SPAN / TILE_SIZE);
      ctx.save();
      ctx.translate(SIZE / 2 - (self.x / TILE_SIZE) * worldToPx, SIZE / 2 - (self.y / TILE_SIZE) * worldToPx);
      ctx.drawImage(terrain!, 0, 0, MAP_TILES_X * worldToPx, MAP_TILES_Y * worldToPx);
      ctx.restore();

      const plot = (x: number, y: number, color: string, r: number) => {
        const px = SIZE / 2 + (x - self.x) * scale;
        const py = SIZE / 2 + (y - self.y) * scale;
        if (px < -r || py < -r || px > SIZE + r || py > SIZE + r) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      };

      room!.state.monsters.forEach((m: MonsterView) => {
        if (m.hp > 0) plot(m.x, m.y, "#e0733f", 1.6);
      });
      room!.state.players.forEach((p: PlayerView, id: string) => {
        if (id !== room!.sessionId && !p.dead) plot(p.x, p.y, "#e9b949", 2);
      });

      // Self last, so nothing can cover it.
      ctx.shadowColor = "#5ef08a";
      ctx.shadowBlur = 6;
      plot(self.x, self.y, "#7df5a4", 2.6);
      ctx.shadowBlur = 0;
    };

    draw();
    const timer = setInterval(draw, 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="panel bevel px-1.5 pb-2 pt-1.5">
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        className="block bevel bg-[#0a1220]"
        style={{ width: SIZE, height: SIZE }}
      />
      <p className="mt-1.5 text-center text-[11px] font-semibold leading-none glow-text">Пустоши</p>
    </div>
  );
}

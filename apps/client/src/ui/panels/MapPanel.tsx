import { useEffect, useRef } from "react";
import {
  MAP_TILES_X,
  MAP_TILES_Y,
  MONSTERS,
  SAFE_ZONE_RADIUS,
  SOLID_TILES,
  SPAWN_POINT,
  SPAWN_ZONES,
  TILE_SIZE,
  TILE_WATER,
  generateTiles,
} from "@tg-mmo/shared";
import { getRoom, type PlayerView } from "../../net/net";
import Panel from "./Panel";

const CANVAS = 320;

export default function MapPanel() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;

    const tiles = generateTiles();
    const scale = CANVAS / MAP_TILES_X;

    const draw = () => {
      for (let y = 0; y < MAP_TILES_Y; y++) {
        for (let x = 0; x < MAP_TILES_X; x++) {
          const tile = tiles[y * MAP_TILES_X + x]!;
          ctx.fillStyle = tile === TILE_WATER ? "#16324f" : SOLID_TILES.has(tile) ? "#2b3446" : "#1b2c22";
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }

      // Safe plaza.
      const px = scale / TILE_SIZE;
      ctx.strokeStyle = "rgba(125,211,160,.7)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(SPAWN_POINT.x * px, SPAWN_POINT.y * px, SAFE_ZONE_RADIUS * px, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const zone of SPAWN_ZONES) {
        const levels = zone.monsters.map((id) => MONSTERS[id]?.level ?? 0);
        const min = Math.min(...levels);
        const max = Math.max(...levels);

        ctx.fillStyle = "rgba(224,115,63,.14)";
        ctx.strokeStyle = "rgba(224,115,63,.5)";
        ctx.beginPath();
        ctx.arc(zone.tx * scale, zone.ty * scale, zone.radius * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#e6c07a";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${min}–${max}`, zone.tx * scale, zone.ty * scale + 3);
      }

      const room = getRoom();
      const self = room?.state?.players?.get(room.sessionId) as PlayerView | undefined;
      if (self) {
        ctx.fillStyle = "#7df5a4";
        ctx.shadowColor = "#5ef08a";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(self.x * px, self.y * px, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    draw();
    const timer = setInterval(draw, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Panel title="Карта мира">
      <div className="panel bevel mx-auto w-fit p-2">
        <canvas ref={ref} width={CANVAS} height={CANVAS} className="block bevel" />
      </div>

      <div className="mt-2.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-[color:var(--muted)]">
        <span><span className="text-[#7df5a4]">●</span> ты</span>
        <span><span className="text-[#e0733f]">●</span> зона монстров с уровнями</span>
        <span><span className="text-[#7dd3a0]">◌</span> безопасная площадь</span>
      </div>

      <p className="mt-2 px-2 text-center text-[10px] leading-relaxed text-[color:var(--muted)]">
        Чем дальше от центра, тем выше уровни. Возрождение всегда на площади.
      </p>
    </Panel>
  );
}

import { CLASSES, type ClassId } from "@tg-mmo/shared";
import { useGame } from "../store";
import Portrait from "./Portrait";

function Bar({
  value,
  max,
  color,
  height,
  label,
}: {
  value: number;
  max: number;
  color: string;
  height: number;
  label?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar w-full rounded-[3px]" style={{ height }}>
      <div className="bar-fill rounded-[2px]" style={{ width: `${pct}%`, background: color }} />
      {/* Only the tall bar carries text — on a thin one the glyphs would spill out. */}
      {label && (
        <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold leading-none tabular-nums text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,.9)]">
          {value} / {max}
        </span>
      )}
    </div>
  );
}

/** Compact number formatting the way mobile RPG HUDs do it: 1.2K, 3.4M. */
function short(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function Hud() {
  const hud = useGame((s) => s.hud);
  const cls = useGame((s) => s.cls);

  return (
    <div className="absolute left-2 top-[calc(var(--safe-top)+0.5rem)] flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <Portrait cls={cls as ClassId} level={hud.level} size={58} />

        <div className="panel bevel w-[184px] px-2.5 py-2">
          <p className="truncate text-[12px] font-semibold leading-tight glow-text">{hud.name}</p>
          <p className="mb-1.5 text-[9px] leading-tight text-[color:var(--muted)]">
            {CLASSES[cls as ClassId].name}
          </p>

          <div className="space-y-[3px]">
            <Bar value={hud.hp} max={hud.maxHp} color="linear-gradient(180deg,#6ee79a,#2ba354)" height={13} label />
            <Bar value={hud.mp} max={hud.maxMp} color="linear-gradient(180deg,#6ec6f5,#1f7fc4)" height={7} />
            <Bar value={hud.xp} max={hud.xpToNext} color="linear-gradient(180deg,#f5bf6b,#c07216)" height={5} />
          </div>

          <div className="mt-1 flex justify-between text-[9px] leading-none text-[color:var(--muted)]">
            <span>MP {hud.mp}/{hud.maxMp}</span>
            <span>Опыт {hud.xp}/{hud.xpToNext}</span>
          </div>
        </div>
      </div>

      {/* Only real values live here — the game has one currency, so the row shows one. */}
      <div className="panel-flat bevel flex w-fit items-center gap-1.5 px-2.5 py-1">
        <span className="grid size-4 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#f7e07a,#a97a12)] text-[8px] font-bold text-[#4a3405]">
          ₮
        </span>
        <span className="gold-text text-[12px] font-semibold leading-none tabular-nums">{short(hud.gold)}</span>
      </div>
    </div>
  );
}

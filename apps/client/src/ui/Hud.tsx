import { useGame } from "../store";

function Bar({
  value,
  max,
  className,
  label,
}: {
  value: number;
  max: number;
  className: string;
  label: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/60 ring-1 ring-black/40">
      <div
        className={`h-full rounded-full transition-[width] duration-150 ${className}`}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemax={max}
      />
    </div>
  );
}

export default function Hud() {
  const hud = useGame((s) => s.hud);

  return (
    <div className="absolute left-3 top-[calc(var(--safe-top)+0.75rem)] w-44">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="truncate text-sm font-medium text-slate-100 drop-shadow">{hud.name}</span>
        <span className="text-xs text-amber-300">ур. {hud.level}</span>
      </div>

      <div className="space-y-1">
        <Bar value={hud.hp} max={hud.maxHp} className="bg-rose-500" label="Здоровье" />
        <Bar value={hud.mp} max={hud.maxMp} className="bg-sky-500" label="Мана" />
        <Bar value={hud.xp} max={hud.xpToNext} className="bg-amber-400" label="Опыт" />
      </div>

      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-400">
        <span>
          {hud.hp}/{hud.maxHp}
          {hud.shield > 0 && <span className="ml-1 text-sky-300">+{hud.shield}</span>}
        </span>
        <span>
          {hud.xp}/{hud.xpToNext}
        </span>
      </div>
    </div>
  );
}

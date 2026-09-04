import { getManifest } from "../game/assets";
import { useGame } from "../store";

const PORTRAIT = 34;

/** Frame 0 of the idle sheet, cropped by CSS — the sheet is a 4-row direction grid. */
function MonsterPortrait({ kind }: { kind: string }) {
  const sheets = getManifest().monsters[kind];
  const cols = sheets ? (sheets.anims.idle?.frames ?? 1) : 1;
  const rows = sheets?.rows ?? 4;

  return (
    <div
      className="shrink-0 bevel bg-[#0a1220]"
      style={{
        width: PORTRAIT,
        height: PORTRAIT,
        backgroundImage: `url(assets/sprites/monsters/${kind}/idle.png)`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: "0 0",
        imageRendering: "pixelated",
      }}
    />
  );
}

export default function TargetFrame() {
  const target = useGame((s) => s.target);
  if (!target) return null;

  const pct = target.maxHp > 0 ? Math.max(0, (target.hp / target.maxHp) * 100) : 0;

  return (
    <div
      className="panel bevel absolute left-1/2 flex w-[150px] -translate-x-1/2 items-center gap-2 px-2 py-1.5"
      style={{ top: "calc(var(--safe-top) + 6.5rem)" }}
    >
      <MonsterPortrait kind={target.kind} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <span className="truncate text-[11px] font-semibold leading-tight">{target.name}</span>
          <span className="shrink-0 text-[10px] font-bold gold-text">{target.level}</span>
        </div>
        <div className="bar mt-1 h-[9px] w-full rounded-[3px]">
          <div
            className="bar-fill rounded-[2px]"
            style={{ width: `${pct}%`, background: "linear-gradient(180deg,#f0796a,#b3291d)" }}
          />
          <span className="absolute inset-0 grid place-items-center text-[8px] font-semibold leading-none tabular-nums text-white/95">
            {target.hp} / {target.maxHp}
          </span>
        </div>
      </div>
    </div>
  );
}

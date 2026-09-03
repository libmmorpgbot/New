import { CLASSES, CLASS_IDS, type ClassId } from "@tg-mmo/shared";

const PORTRAIT: Record<ClassId, string> = {
  mage: "assets/sprites/heroes/mage/down-idle.png",
  ranger: "assets/sprites/heroes/ranger/down-idle.png",
  deathknight: "assets/sprites/heroes/deathknight/down-idle.png",
};

/**
 * The portrait is the first frame of the idle sheet, cropped with CSS —
 * cheaper than shipping separate portrait art.
 */
function Portrait({ cls }: { cls: ClassId }) {
  return (
    <div
      className="size-24 shrink-0 rounded-lg bg-slate-900/70"
      style={{
        backgroundImage: `url(${PORTRAIT[cls]})`,
        backgroundSize: "1500% 100%",
        backgroundPosition: "0 0",
        imageRendering: "pixelated",
        transform: "scale(1.15)",
      }}
    />
  );
}

export default function ClassSelect({ onPick }: { onPick: (cls: ClassId) => void }) {
  return (
    <div className="interactive absolute inset-0 overflow-y-auto bg-[#0b0f16] px-5 pb-10 pt-[calc(var(--safe-top)+2rem)]">
      <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight text-slate-100">
        Ashen Realms
      </h1>
      <p className="mb-7 text-center text-sm text-slate-500">Выбери класс — его можно сменить позже.</p>

      <div className="mx-auto flex max-w-md flex-col gap-3">
        {CLASS_IDS.map((id) => {
          const cls = CLASSES[id];
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left active:border-emerald-600/60 active:bg-slate-800/80"
            >
              <Portrait cls={id} />
              <span className="min-w-0">
                <span className="block text-base font-medium text-slate-100">{cls.name}</span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-400">{cls.blurb}</span>
                <span className="mt-2 block text-[11px] text-slate-500">
                  HP {cls.stats.maxHp} · MP {cls.stats.maxMp} · урон {cls.stats.attackDamage}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

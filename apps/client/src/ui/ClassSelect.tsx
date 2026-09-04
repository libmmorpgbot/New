import { CLASSES, CLASS_IDS, statsForLevel, type ClassId } from "@tg-mmo/shared";
import Portrait from "./Portrait";

export default function ClassSelect({ onPick }: { onPick: (cls: ClassId) => void }) {
  return (
    <div className="interactive absolute inset-0 overflow-y-auto bg-[color:var(--ink)] px-4 pb-10 pt-[calc(var(--safe-top)+2rem)]">
      <div className="mx-auto max-w-md">
        <h1 className="text-center text-[26px] font-bold tracking-tight glow-text">Пустоши</h1>
        <p className="mb-6 text-center text-[12px] text-[color:var(--muted)]">
          Выбери класс. Прогресс каждого хранится отдельно.
        </p>

        <div className="flex flex-col gap-2.5">
          {CLASS_IDS.map((id) => {
            const hero = CLASSES[id];
            const stats = statsForLevel(id, 1);
            return (
              <button
                key={id}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onPick(id);
                }}
                className="panel bevel flex items-center gap-3.5 p-3 text-left active:brightness-125"
              >
                <Portrait cls={id} size={68} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold glow-text">{hero.name}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[color:var(--muted)]">
                    {hero.blurb}
                  </span>
                  <span className="mt-2 flex gap-3 text-[10px] font-semibold">
                    <span className="text-[#6ee79a]">HP {stats.maxHp}</span>
                    <span className="text-[#6ec6f5]">MP {stats.maxMp}</span>
                    <span className="gold-text">Урон {stats.attackDamage}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

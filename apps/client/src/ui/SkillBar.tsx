import { getSkill, type SkillId } from "@tg-mmo/shared";
import { queueAttack, queueSkill } from "../input/inputState";
import { useGame } from "../store";

export default function SkillBar({ skills }: { skills: readonly SkillId[] }) {
  const cooldowns = useGame((s) => s.cooldowns);
  const mp = useGame((s) => s.hud.mp);

  return (
    <div className="absolute bottom-[calc(var(--safe-bottom)+1.25rem)] right-4 flex items-end gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        {skills.map((id, slot) => {
          const skill = getSkill(id);
          if (!skill) return null;

          const remaining = cooldowns[slot] ?? 0;
          const onCooldown = remaining > 0;
          const noMana = mp < skill.manaCost;

          return (
            <button
              key={id}
              className="interactive relative size-13 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/80 active:scale-95"
              style={{ width: 52, height: 52 }}
              onPointerDown={(e) => {
                e.preventDefault();
                queueSkill(slot);
              }}
              aria-label={skill.name}
            >
              <img
                src={`assets/sprites/skills/${skill.icon}.png`}
                alt=""
                className="size-full object-contain"
                style={{ imageRendering: "pixelated", opacity: noMana ? 0.45 : 1 }}
                draggable={false}
              />
              {onCooldown && (
                <span className="absolute inset-0 grid place-items-center bg-black/65 text-xs font-semibold tabular-nums text-slate-200">
                  {(remaining / 1000).toFixed(1)}
                </span>
              )}
              <span className="absolute bottom-0 right-0.5 text-[9px] text-sky-300">
                {skill.manaCost}
              </span>
            </button>
          );
        })}
      </div>

      <button
        className="interactive grid size-20 place-items-center rounded-full border border-rose-700/60 bg-rose-900/60 text-sm font-semibold text-rose-100 active:scale-95 active:bg-rose-800/70"
        onPointerDown={(e) => {
          e.preventDefault();
          queueAttack();
        }}
        aria-label="Атака"
      >
        УДАР
      </button>
    </div>
  );
}

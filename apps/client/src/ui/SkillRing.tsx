import { getSkill, type SkillId } from "@tg-mmo/shared";
import { queueAttack, queueSkill } from "../input/inputState";
import { useGame } from "../store";

const ATTACK = 76;
const SKILL = 46;
/** Distance from the attack button to each skill, in px. */
const ARC_RADIUS = 90;

/**
 * A quarter arc from "left" to "up" around the attack button. Anything sweeping
 * further right would leave the screen; further down would collide with the tabs.
 */
const SLOT_OFFSETS = [180, 210, 240, 270].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * ARC_RADIUS, y: Math.sin(rad) * ARC_RADIUS };
});

export default function SkillRing({ skills }: { skills: readonly SkillId[] }) {
  const cooldowns = useGame((s) => s.cooldowns);
  const mp = useGame((s) => s.hud.mp);

  return (
    <div
      className="absolute"
      style={{ right: 16, bottom: `calc(var(--safe-bottom) + 62px)`, width: ATTACK, height: ATTACK }}
    >
      {skills.map((id, slot) => {
        const skill = getSkill(id);
        const offset = SLOT_OFFSETS[slot];
        if (!skill || !offset) return null;

        const remaining = cooldowns[slot] ?? 0;
        const locked = remaining > 0 || mp < skill.manaCost;

        return (
          <button
            key={id}
            className="interactive btn-round absolute overflow-hidden"
            style={{
              width: SKILL,
              height: SKILL,
              left: ATTACK / 2 - SKILL / 2 + offset.x,
              top: ATTACK / 2 - SKILL / 2 + offset.y,
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              queueSkill(slot);
            }}
            aria-label={skill.name}
          >
            <img
              src={`assets/sprites/skills/${skill.icon}.png`}
              alt=""
              className="size-full rounded-full object-contain p-[3px]"
              style={{ imageRendering: "pixelated", opacity: locked ? 0.4 : 1 }}
              draggable={false}
            />
            {remaining > 0 && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-[13px] font-bold tabular-nums text-white">
                {(remaining / 1000).toFixed(1)}
              </span>
            )}
            <span className="absolute bottom-0.5 right-1.5 text-[9px] font-semibold text-[#7fd0ff]">
              {skill.manaCost}
            </span>
          </button>
        );
      })}

      <button
        className="interactive btn-round absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 30%, #4b7fd4, #0c1a33)",
          boxShadow: "inset 0 2px 8px rgba(180,220,255,.4), 0 0 22px rgba(75,180,255,.4), 0 4px 12px rgba(0,0,0,.7)",
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          queueAttack();
        }}
        aria-label="Атака"
      >
        <span className="text-[28px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]">⚔</span>
      </button>
    </div>
  );
}

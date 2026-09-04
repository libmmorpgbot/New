import { CLASSES, getSkill, statsForLevel, type ClassId } from "@tg-mmo/shared";
import { useGame } from "../../store";
import Portrait from "../Portrait";
import Panel, { Row, Section } from "./Panel";

export default function CharacterPanel() {
  const hud = useGame((s) => s.hud);
  const cls = useGame((s) => s.cls) as ClassId;
  const hero = CLASSES[cls];
  const stats = statsForLevel(cls, hud.level);

  return (
    <Panel title="Персонаж">
      <Section title="Герой">
        <div className="mb-2 flex items-center gap-3">
          <Portrait cls={cls} level={hud.level} size={58} />
          <div>
            <p className="text-[14px] font-semibold">{hud.name}</p>
            <p className="text-[11px] text-[color:var(--muted)]">{hero.name}</p>
            <p className="mt-1 text-[10px] leading-snug text-[color:var(--muted)]">{hero.blurb}</p>
          </div>
        </div>
        <Row label="Опыт" value={`${hud.xp} / ${hud.xpToNext}`} />
        <Row label="Золото" value={<span className="gold-text">{hud.gold}</span>} />
      </Section>

      <Section title="Характеристики">
        <Row label="Здоровье" value={`${hud.hp} / ${hud.maxHp}`} />
        <Row label="Мана" value={`${hud.mp} / ${hud.maxMp}`} />
        <Row label="Урон атаки" value={stats.attackDamage} />
        <Row label="Дальность" value={`${stats.attackRange} px`} />
        <Row label="Скорость" value={`${stats.moveSpeed} px/с`} />
        <Row label="Перезарядка атаки" value={`${(stats.attackCooldownMs / 1000).toFixed(2)} с`} />
        <Row label="Реген HP" value={`${stats.hpRegenPerSec}/с`} />
        <Row label="Реген MP" value={`${stats.mpRegenPerSec}/с`} />
      </Section>

      <Section title="Умения">
        <div className="space-y-2">
          {hero.skills.map((id) => {
            const skill = getSkill(id);
            if (!skill) return null;
            return (
              <div key={id} className="flex items-center gap-2.5">
                <img
                  src={`assets/sprites/skills/${skill.icon}.png`}
                  alt=""
                  className="size-9 shrink-0 bevel"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold">{skill.name}</p>
                  <p className="text-[10px] text-[color:var(--muted)]">
                    {skill.manaCost} маны · {(skill.cooldownMs / 1000).toFixed(1)} с
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </Panel>
  );
}

import type { ClassId } from "./types";
import type { SkillId } from "./skills";

export interface ClassStats {
  maxHp: number;
  maxMp: number;
  /** Pixels per second. */
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  /** Full width of the melee/aim cone in radians. */
  attackArc: number;
  attackCooldownMs: number;
  /** Milliseconds the attack animation locks movement for. */
  attackWindupMs: number;
  hpPerLevel: number;
  mpPerLevel: number;
  damagePerLevel: number;
  mpRegenPerSec: number;
  hpRegenPerSec: number;
}

export interface HeroClass {
  id: ClassId;
  name: string;
  blurb: string;
  stats: ClassStats;
  skills: SkillId[];
}

export const CLASSES: Record<ClassId, HeroClass> = {
  mage: {
    id: "mage",
    name: "Маг",
    blurb: "Хрупкий, но бьёт далеко и по площади.",
    stats: {
      maxHp: 90,
      maxMp: 120,
      moveSpeed: 132,
      attackDamage: 16,
      attackRange: 230,
      attackArc: Math.PI / 4,
      attackCooldownMs: 620,
      attackWindupMs: 180,
      hpPerLevel: 9,
      mpPerLevel: 14,
      damagePerLevel: 3.2,
      mpRegenPerSec: 4,
      hpRegenPerSec: 1.2,
    },
    skills: ["arcane_orb", "frost_nova", "mana_barrier", "blink"],
  },
  ranger: {
    id: "ranger",
    name: "Следопыт",
    blurb: "Быстрый, средняя дистанция, высокий темп атаки.",
    stats: {
      maxHp: 115,
      maxMp: 90,
      moveSpeed: 152,
      attackDamage: 14,
      attackRange: 190,
      attackArc: Math.PI / 5,
      attackCooldownMs: 480,
      attackWindupMs: 140,
      hpPerLevel: 12,
      mpPerLevel: 9,
      damagePerLevel: 2.8,
      mpRegenPerSec: 3.2,
      hpRegenPerSec: 1.6,
    },
    skills: ["combo_shot", "multishot", "roll", "hunters_focus"],
  },
  deathknight: {
    id: "deathknight",
    name: "Рыцарь смерти",
    blurb: "Много здоровья, ближний бой, широкий замах.",
    stats: {
      maxHp: 165,
      maxMp: 70,
      moveSpeed: 138,
      attackDamage: 22,
      attackRange: 78,
      attackArc: Math.PI / 2,
      attackCooldownMs: 700,
      attackWindupMs: 220,
      hpPerLevel: 17,
      mpPerLevel: 6,
      damagePerLevel: 4.1,
      mpRegenPerSec: 2.4,
      hpRegenPerSec: 2.2,
    },
    skills: ["cleave", "charge", "shockwave", "whirlwind"],
  },
};

export function statsForLevel(classId: ClassId, level: number) {
  const s = CLASSES[classId].stats;
  const steps = Math.max(0, level - 1);
  return {
    ...s,
    maxHp: Math.round(s.maxHp + s.hpPerLevel * steps),
    maxMp: Math.round(s.maxMp + s.mpPerLevel * steps),
    attackDamage: Math.round(s.attackDamage + s.damagePerLevel * steps),
  };
}

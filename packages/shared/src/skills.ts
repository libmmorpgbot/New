export type SkillEffect =
  | { kind: "arc"; range: number; arc: number; damage: number }
  | { kind: "nova"; radius: number; damage: number }
  | { kind: "dash"; distance: number; damage: number }
  | { kind: "shield"; amount: number; durationMs: number }
  | { kind: "heal"; amount: number };

export interface Skill {
  id: string;
  name: string;
  /** Icon id as it appears in the generated sprite manifest (`skills/<icon>.png`). */
  icon: string;
  cooldownMs: number;
  manaCost: number;
  effect: SkillEffect;
}

export const SKILLS = {
  // --- Mage ---
  arcane_orb: {
    id: "arcane_orb",
    name: "Арканный шар",
    icon: "mshar_v2",
    cooldownMs: 1600,
    manaCost: 12,
    effect: { kind: "arc", range: 260, arc: Math.PI / 5, damage: 34 },
  },
  frost_nova: {
    id: "frost_nova",
    name: "Ледяная нова",
    icon: "mnova",
    cooldownMs: 7000,
    manaCost: 30,
    effect: { kind: "nova", radius: 150, damage: 42 },
  },
  mana_barrier: {
    id: "mana_barrier",
    name: "Барьер маны",
    icon: "mbarier",
    cooldownMs: 14000,
    manaCost: 25,
    effect: { kind: "shield", amount: 70, durationMs: 6000 },
  },
  blink: {
    id: "blink",
    name: "Телепорт",
    icon: "mteleport",
    cooldownMs: 9000,
    manaCost: 18,
    effect: { kind: "dash", distance: 190, damage: 0 },
  },

  // --- Ranger ---
  multishot: {
    id: "multishot",
    name: "Мультивыстрел",
    icon: "lmulti",
    cooldownMs: 5000,
    manaCost: 20,
    effect: { kind: "arc", range: 300, arc: Math.PI / 2, damage: 26 },
  },
  roll: {
    id: "roll",
    name: "Кувырок",
    icon: "lprijok",
    cooldownMs: 6000,
    manaCost: 10,
    effect: { kind: "dash", distance: 160, damage: 0 },
  },
  combo_shot: {
    id: "combo_shot",
    name: "Серия",
    icon: "lkombo",
    cooldownMs: 8000,
    manaCost: 24,
    effect: { kind: "arc", range: 240, arc: Math.PI / 6, damage: 58 },
  },
  hunters_focus: {
    id: "hunters_focus",
    name: "Сосредоточение",
    icon: "latkspeed",
    cooldownMs: 16000,
    manaCost: 22,
    effect: { kind: "shield", amount: 45, durationMs: 8000 },
  },

  // --- Death Knight ---
  cleave: {
    id: "cleave",
    name: "Боевой размах",
    icon: "wboevoy_v2",
    cooldownMs: 1500,
    manaCost: 8,
    effect: { kind: "arc", range: 96, arc: Math.PI / 1.8, damage: 40 },
  },
  charge: {
    id: "charge",
    name: "Рывок",
    icon: "wrivok_v2",
    cooldownMs: 7000,
    manaCost: 16,
    effect: { kind: "dash", distance: 200, damage: 22 },
  },
  shockwave: {
    id: "shockwave",
    name: "Оглушение",
    icon: "wstun_v2",
    cooldownMs: 9000,
    manaCost: 26,
    effect: { kind: "nova", radius: 130, damage: 36 },
  },
  whirlwind: {
    id: "whirlwind",
    name: "Вихрь",
    icon: "wvixr_v2",
    cooldownMs: 11000,
    manaCost: 32,
    effect: { kind: "nova", radius: 110, damage: 55 },
  },
} as const satisfies Record<string, Skill>;

export type SkillId = keyof typeof SKILLS;

export function getSkill(id: string): Skill | undefined {
  return (SKILLS as Record<string, Skill>)[id];
}

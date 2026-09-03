/** Eight-way facing used by the hero sheets; the index is what travels over the wire. */
export const DIRECTIONS_8 = [
  "down",
  "down-right",
  "right",
  "up-right",
  "up",
  "up-left",
  "left",
  "down-left",
] as const;
export type Direction8 = (typeof DIRECTIONS_8)[number];

/** Monster sheets only carry four rows, in this order. */
export const DIRECTIONS_4 = ["down", "up", "left", "right"] as const;
export type Direction4 = (typeof DIRECTIONS_4)[number];

export const HERO_ACTIONS = ["idle", "run", "attack", "die"] as const;
export type HeroAction = (typeof HERO_ACTIONS)[number];

export const MONSTER_ACTIONS = ["idle", "run", "attack", "death"] as const;
export type MonsterAction = (typeof MONSTER_ACTIONS)[number];

export const CLASS_IDS = ["mage", "ranger", "deathknight"] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export function isClassId(value: unknown): value is ClassId {
  return typeof value === "string" && (CLASS_IDS as readonly string[]).includes(value);
}

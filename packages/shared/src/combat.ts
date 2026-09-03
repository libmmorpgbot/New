/** Cumulative XP needed to go from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.5));
}

export const MAX_LEVEL = 40;

export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 1.8;
/** Damage is rolled inside ±this fraction of the nominal value. */
export const DAMAGE_VARIANCE = 0.12;

export interface DamageRoll {
  amount: number;
  crit: boolean;
}

/**
 * Rolled server-side only. `rng` is injected so tests can pin the result.
 * Attacker level above the target's adds a small bonus, and vice versa, which
 * keeps low-level players from farming far-out zones.
 */
export function rollDamage(
  base: number,
  attackerLevel: number,
  targetLevel: number,
  rng: () => number = Math.random,
): DamageRoll {
  const levelFactor = 1 + Math.max(-0.6, Math.min(0.6, (attackerLevel - targetLevel) * 0.04));
  const variance = 1 + (rng() * 2 - 1) * DAMAGE_VARIANCE;
  const crit = rng() < CRIT_CHANCE;
  const amount = base * levelFactor * variance * (crit ? CRIT_MULTIPLIER : 1);
  return { amount: Math.max(1, Math.round(amount)), crit };
}

/** XP awarded shrinks quickly once the kill is far below the player's level. */
export function xpReward(monsterXp: number, monsterLevel: number, playerLevel: number): number {
  const gap = playerLevel - monsterLevel;
  if (gap <= 2) return monsterXp;
  const factor = Math.max(0.05, 1 - (gap - 2) * 0.15);
  return Math.max(1, Math.round(monsterXp * factor));
}

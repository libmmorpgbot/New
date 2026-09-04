import {
  CLASSES,
  MONSTER_RESPAWN_MS,
  RESPAWN_DELAY_MS,
  distanceSq,
  getSkill,
  goldReward,
  moveWithCollision,
  rollDamage,
  statsForLevel,
  withinArc,
  xpReward,
  xpToNextLevel,
  MAX_LEVEL,
  PLAYER_RADIUS,
  type ClassId,
  type Skill,
} from "@tg-mmo/shared";
import type { SimContext } from "./context";
import type { MonsterRuntime, PlayerRuntime } from "./types";

/** How long a corpse stays in the state so clients can play the death animation. */
const CORPSE_LINGER_MS = 1300;

export function damageMonster(
  ctx: SimContext,
  monster: MonsterRuntime,
  attacker: PlayerRuntime,
  baseDamage: number,
): void {
  if (monster.state.hp <= 0) return;

  const { amount, crit } = rollDamage(baseDamage, attacker.state.level, monster.def.level);
  monster.state.hp = Math.max(0, monster.state.hp - amount);
  monster.targetSessionId = attacker.sessionId;

  ctx.emit.hit({
    targetType: "monster",
    targetId: monster.state.id,
    attackerId: attacker.sessionId,
    amount,
    crit,
    x: monster.state.x,
    y: monster.state.y,
  });

  if (monster.state.hp === 0) killMonster(ctx, monster, attacker);
}

function killMonster(ctx: SimContext, monster: MonsterRuntime, killer: PlayerRuntime): void {
  monster.state.action = "death";
  monster.removeAt = ctx.now + CORPSE_LINGER_MS;
  monster.respawnAt = ctx.now + MONSTER_RESPAWN_MS;
  monster.targetSessionId = null;

  grantXp(ctx, killer, xpReward(monster.def.xp, monster.def.level, killer.state.level));
  killer.state.gold = Math.min(4294967295, killer.state.gold + goldReward(monster.def.xp, monster.def.level));
}

export function grantXp(ctx: SimContext, player: PlayerRuntime, xp: number): void {
  if (player.state.level >= MAX_LEVEL) return;
  player.state.xp += xp;

  let leveled = false;
  while (player.state.level < MAX_LEVEL && player.state.xp >= player.state.xpToNext) {
    player.state.xp -= player.state.xpToNext;
    player.state.level += 1;
    player.state.xpToNext = xpToNextLevel(player.state.level);
    leveled = true;
  }

  if (leveled) {
    applyLevelStats(player);
    player.state.hp = player.state.maxHp;
    player.state.mp = player.state.maxMp;
    ctx.emit.levelUp(player.sessionId, player.state.level);
  }
}

export function applyLevelStats(player: PlayerRuntime): void {
  const stats = statsForLevel(player.state.cls as ClassId, player.state.level);
  player.state.maxHp = stats.maxHp;
  player.state.maxMp = stats.maxMp;
  player.state.hp = Math.min(player.state.hp, stats.maxHp);
  player.state.mp = Math.min(player.state.mp, stats.maxMp);
  player.state.xpToNext = xpToNextLevel(player.state.level);
}

export function damagePlayer(
  ctx: SimContext,
  player: PlayerRuntime,
  monster: MonsterRuntime,
): void {
  if (player.state.dead) return;

  const { amount, crit } = rollDamage(monster.def.damage, monster.def.level, player.state.level);

  // Shields soak first and can absorb the hit entirely.
  let remaining = amount;
  if (player.state.shield > 0 && ctx.now < player.shieldUntil) {
    const soaked = Math.min(player.state.shield, remaining);
    player.state.shield -= soaked;
    remaining -= soaked;
  }
  player.state.hp = Math.max(0, player.state.hp - remaining);

  ctx.emit.hit({
    targetType: "player",
    targetId: player.sessionId,
    attackerId: monster.state.id,
    amount,
    crit,
    x: player.state.x,
    y: player.state.y,
  });

  if (player.state.hp === 0) {
    player.state.dead = true;
    player.state.action = "die";
    player.state.shield = 0;
    player.respawnAt = ctx.now + RESPAWN_DELAY_MS;
  }
}

/** Basic attack: a cone in front of the player, hitting every monster inside it. */
export function performBasicAttack(ctx: SimContext, player: PlayerRuntime): boolean {
  if (player.state.dead || ctx.now < player.attackReadyAt || ctx.now < player.busyUntil) return false;

  const stats = statsForLevel(player.state.cls as ClassId, player.state.level);
  player.attackReadyAt = ctx.now + stats.attackCooldownMs;
  player.busyUntil = ctx.now + stats.attackWindupMs;
  player.state.action = "attack";

  hitConeMonsters(ctx, player, stats.attackRange, stats.attackArc, stats.attackDamage);
  return true;
}

export function useSkill(ctx: SimContext, player: PlayerRuntime, slot: number): Skill | null {
  if (player.state.dead || ctx.now < player.busyUntil) return null;

  const cls = CLASSES[player.state.cls as ClassId];
  const skillId = cls.skills[slot];
  if (!skillId) return null;
  const skill = getSkill(skillId);
  if (!skill) return null;

  if (ctx.now < (player.skillReadyAt[slot] ?? 0)) return null;
  if (player.state.mp < skill.manaCost) return null;

  player.state.mp -= skill.manaCost;
  player.skillReadyAt[slot] = ctx.now + skill.cooldownMs;
  player.busyUntil = ctx.now + 260;
  player.state.action = "attack";

  const stats = statsForLevel(player.state.cls as ClassId, player.state.level);
  const power = (base: number) => base + stats.attackDamage * 0.5;

  switch (skill.effect.kind) {
    case "arc":
      hitConeMonsters(ctx, player, skill.effect.range, skill.effect.arc, power(skill.effect.damage));
      break;
    case "nova":
      hitRadiusMonsters(ctx, player, skill.effect.radius, power(skill.effect.damage));
      break;
    case "dash": {
      const next = moveWithCollision(
        ctx.tiles,
        player.state.x,
        player.state.y,
        player.faceX * skill.effect.distance,
        player.faceY * skill.effect.distance,
        PLAYER_RADIUS,
      );
      player.state.x = next.x;
      player.state.y = next.y;
      if (skill.effect.damage > 0) {
        hitRadiusMonsters(ctx, player, 70, power(skill.effect.damage));
      }
      break;
    }
    case "shield":
      player.state.shield = skill.effect.amount;
      player.shieldUntil = ctx.now + skill.effect.durationMs;
      break;
    case "heal":
      player.state.hp = Math.min(player.state.maxHp, player.state.hp + skill.effect.amount);
      break;
  }

  ctx.emit.skillUsed({
    playerId: player.sessionId,
    skillId: skill.id,
    x: player.state.x,
    y: player.state.y,
  });
  return skill;
}

function hitConeMonsters(
  ctx: SimContext,
  player: PlayerRuntime,
  range: number,
  arc: number,
  damage: number,
): void {
  /** Anything practically on top of the player is hit regardless of facing. */
  const POINT_BLANK_SQ = 900;

  for (const monster of ctx.monsters.values()) {
    if (monster.state.hp <= 0) continue;

    const reach = range + monster.def.radius;
    const dSq = distanceSq(player.state.x, player.state.y, monster.state.x, monster.state.y);
    if (dSq > reach * reach) continue;

    const inArc = withinArc(
      player.state.x,
      player.state.y,
      player.faceX,
      player.faceY,
      monster.state.x,
      monster.state.y,
      arc,
    );
    if (!inArc && dSq > POINT_BLANK_SQ) continue;

    damageMonster(ctx, monster, player, damage);
  }
}

function hitRadiusMonsters(
  ctx: SimContext,
  player: PlayerRuntime,
  radius: number,
  damage: number,
): void {
  for (const monster of ctx.monsters.values()) {
    if (monster.state.hp <= 0) continue;
    const reach = radius + monster.def.radius;
    if (distanceSq(player.state.x, player.state.y, monster.state.x, monster.state.y) <= reach * reach) {
      damageMonster(ctx, monster, player, damage);
    }
  }
}

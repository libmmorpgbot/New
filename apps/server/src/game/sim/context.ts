import type { HitEvent, SkillUsedEvent } from "@tg-mmo/shared";
import type { MonsterRuntime, PlayerRuntime } from "./types";

export interface SimEmitter {
  hit(event: HitEvent): void;
  levelUp(sessionId: string, level: number): void;
  skillUsed(event: SkillUsedEvent): void;
}

export interface SimContext {
  now: number;
  tiles: Uint8Array;
  players: Map<string, PlayerRuntime>;
  monsters: Map<string, MonsterRuntime>;
  emit: SimEmitter;
}

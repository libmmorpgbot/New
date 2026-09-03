import type { MonsterDef } from "@tg-mmo/shared";
import type { MonsterState, PlayerState } from "../rooms/schema";

export interface PlayerRuntime {
  state: PlayerState;
  sessionId: string;
  /** Database user id, or null for dev logins and DB-less runs. */
  userId: number | null;
  /** Facing kept as a unit vector so skills can aim without re-deriving from `dir`. */
  faceX: number;
  faceY: number;
  attackReadyAt: number;
  /** Movement is locked while an attack or cast animation plays. */
  busyUntil: number;
  skillReadyAt: number[];
  shieldUntil: number;
  respawnAt: number;
  lastChatAt: number;
  /** Simulated milliseconds spent in the current budget window — the speed-hack guard. */
  dtSpent: number;
  dtWindowStart: number;
  hpAcc: number;
  mpAcc: number;
}

export interface MonsterRuntime {
  state: MonsterState;
  def: MonsterDef;
  homeX: number;
  homeY: number;
  targetSessionId: string | null;
  attackReadyAt: number;
  busyUntil: number;
  /** Set when hp hits 0; the corpse lingers so the death animation can play out. */
  removeAt: number;
  respawnAt: number;
  wanderUntil: number;
  wanderX: number;
  wanderY: number;
}

import { z } from "zod";
import { CHAT_MAX_LENGTH, MAX_INPUT_DT_MS } from "./constants";

/** Client -> server. Everything crossing this boundary is parsed, never trusted. */
export const MSG = {
  input: "input",
  attack: "attack",
  skill: "skill",
  chat: "chat",
  respawn: "respawn",
} as const;

/** Server -> client one-off events. Continuous state lives in the Colyseus schema. */
export const EVT = {
  hit: "hit",
  died: "died",
  levelUp: "levelUp",
  chat: "chat",
  monsterDied: "monsterDied",
  skillUsed: "skillUsed",
  rejected: "rejected",
} as const;

export const InputMessage = z.object({
  seq: z.number().int().nonnegative(),
  /** Normalised movement intent; length is clamped to 1 server-side anyway. */
  dx: z.number().min(-1).max(1),
  dy: z.number().min(-1).max(1),
  dt: z.number().min(0).max(MAX_INPUT_DT_MS),
});
export type InputMessage = z.infer<typeof InputMessage>;

export const AttackMessage = z.object({
  /** Monster the player has selected, if any. The server still checks range. */
  targetId: z.string().max(24).optional(),
});
export type AttackMessage = z.infer<typeof AttackMessage>;

export const SkillMessage = z.object({
  slot: z.number().int().min(0).max(3),
});
export type SkillMessage = z.infer<typeof SkillMessage>;

export const ChatMessage = z.object({
  text: z.string().trim().min(1).max(CHAT_MAX_LENGTH),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export interface HitEvent {
  targetType: "player" | "monster";
  targetId: string;
  attackerId: string;
  amount: number;
  crit: boolean;
  x: number;
  y: number;
}

export interface ChatEvent {
  from: string;
  text: string;
  at: number;
}

export interface SkillUsedEvent {
  playerId: string;
  skillId: string;
  x: number;
  y: number;
}

export interface LevelUpEvent {
  level: number;
}

export interface JoinOptions {
  /** JWT issued by the API after Telegram initData validation. */
  token: string;
}

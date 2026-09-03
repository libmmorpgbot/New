import { create } from "zustand";
import type { ChatEvent, ClassId } from "@tg-mmo/shared";

export type Phase = "menu" | "connecting" | "playing" | "error";

export interface HudState {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  shield: number;
  xp: number;
  xpToNext: number;
  dead: boolean;
  respawnIn: number;
}

interface GameStore {
  phase: Phase;
  error: string | null;
  cls: ClassId;
  hud: HudState;
  /** Remaining cooldown per skill slot, in milliseconds. */
  cooldowns: number[];
  chat: ChatEvent[];
  ping: number;
  setPhase: (phase: Phase) => void;
  setError: (error: string) => void;
  setClass: (cls: ClassId) => void;
  setHud: (hud: Partial<HudState>) => void;
  setCooldowns: (cooldowns: number[]) => void;
  pushChat: (event: ChatEvent) => void;
  setPing: (ping: number) => void;
}

const EMPTY_HUD: HudState = {
  name: "",
  level: 1,
  hp: 0,
  maxHp: 0,
  mp: 0,
  maxMp: 0,
  shield: 0,
  xp: 0,
  xpToNext: 0,
  dead: false,
  respawnIn: 0,
};

export const useGame = create<GameStore>((set) => ({
  phase: "menu",
  error: null,
  cls: "mage",
  hud: EMPTY_HUD,
  cooldowns: [0, 0, 0, 0],
  chat: [],
  ping: 0,
  setPhase: (phase) => set({ phase }),
  setError: (error) => set({ error, phase: "error" }),
  setClass: (cls) => set({ cls }),
  setHud: (hud) => set((s) => ({ hud: { ...s.hud, ...hud } })),
  setCooldowns: (cooldowns) => set({ cooldowns }),
  pushChat: (event) => set((s) => ({ chat: [...s.chat.slice(-49), event] })),
  setPing: (ping) => set({ ping }),
}));

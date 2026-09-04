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
  gold: number;
  dead: boolean;
  respawnIn: number;
}

export interface TargetInfo {
  id: string;
  /** Sprite folder, so the frame can show a portrait. */
  kind: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
}

/** Which full-screen panel is open over the game, if any. */
export type PanelId = "character" | "map" | "quests" | "clans" | "profile" | "menu";

interface GameStore {
  phase: Phase;
  error: string | null;
  cls: ClassId;
  hud: HudState;
  /** Remaining cooldown per skill slot, in milliseconds. */
  cooldowns: number[];
  chat: ChatEvent[];
  unreadChat: number;
  chatOpen: boolean;
  panel: PanelId | null;
  target: TargetInfo | null;
  ping: number;
  setPhase: (phase: Phase) => void;
  setError: (error: string) => void;
  setClass: (cls: ClassId) => void;
  setHud: (hud: Partial<HudState>) => void;
  setCooldowns: (cooldowns: number[]) => void;
  pushChat: (event: ChatEvent) => void;
  setChatOpen: (open: boolean) => void;
  setPanel: (panel: PanelId | null) => void;
  setTarget: (target: TargetInfo | null) => void;
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
  gold: 0,
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
  unreadChat: 0,
  chatOpen: false,
  panel: null,
  target: null,
  ping: 0,
  setPhase: (phase) => set({ phase }),
  setError: (error) => set({ error, phase: "error" }),
  setClass: (cls) => set({ cls }),
  setHud: (hud) => set((s) => ({ hud: { ...s.hud, ...hud } })),
  setCooldowns: (cooldowns) => set({ cooldowns }),
  pushChat: (event) =>
    set((s) => ({
      chat: [...s.chat.slice(-49), event],
      unreadChat: s.chatOpen ? 0 : Math.min(99, s.unreadChat + 1),
    })),
  setChatOpen: (chatOpen) => set(chatOpen ? { chatOpen, unreadChat: 0 } : { chatOpen }),
  setPanel: (panel) => set({ panel }),
  setTarget: (target) =>
    set((s) =>
      // Avoid a re-render when nothing about the target actually moved.
      s.target?.id === target?.id && s.target?.hp === target?.hp ? s : { target },
    ),
  setPing: (ping) => set({ ping }),
}));

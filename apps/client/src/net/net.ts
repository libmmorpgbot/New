import { Client, type Room } from "colyseus.js";
import { EVT, MSG, type ChatEvent, type ClassId, type HitEvent, type SkillUsedEvent } from "@tg-mmo/shared";
import { useGame } from "../store";
import { config } from "../config";

/** Mirrors the server schema; colyseus.js hands us plain objects with these fields. */
export interface PlayerView {
  id: string;
  name: string;
  cls: string;
  x: number;
  y: number;
  dir: number;
  action: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  shield: number;
  level: number;
  xp: number;
  xpToNext: number;
  lastSeq: number;
  dead: boolean;
}

export interface MonsterView {
  id: string;
  kind: string;
  x: number;
  y: number;
  dir: number;
  action: string;
  hp: number;
  maxHp: number;
  level: number;
}

export interface WorldRoomState {
  players: Map<string, PlayerView>;
  monsters: Map<string, MonsterView>;
  tick: number;
}

export type WorldRoom = Room<WorldRoomState>;

export interface NetHandlers {
  onHit?: (event: HitEvent) => void;
  onSkillUsed?: (event: SkillUsedEvent) => void;
  onLevelUp?: (level: number) => void;
}

let room: WorldRoom | null = null;
const handlers: NetHandlers = {};

export function getRoom(): WorldRoom | null {
  return room;
}

export function setHandlers(next: NetHandlers): void {
  Object.assign(handlers, next);
}

export async function connect(token: string, cls: ClassId): Promise<WorldRoom> {
  const client = new Client(config().gameWsUrl);
  room = await client.joinOrCreate<WorldRoomState>("world", { token, cls });

  room.onMessage(EVT.hit, (event: HitEvent) => handlers.onHit?.(event));
  room.onMessage(EVT.skillUsed, (event: SkillUsedEvent) => handlers.onSkillUsed?.(event));
  room.onMessage(EVT.levelUp, (payload: { level: number }) => handlers.onLevelUp?.(payload.level));
  room.onMessage(EVT.chat, (event: ChatEvent) => useGame.getState().pushChat(event));
  room.onMessage(EVT.rejected, () => {});

  room.onError((code, message) => {
    useGame.getState().setError(`Ошибка соединения ${code}: ${message ?? ""}`);
  });
  room.onLeave(() => {
    room = null;
    const { phase, setError } = useGame.getState();
    if (phase === "playing") setError("Соединение с сервером потеряно.");
  });

  return room;
}

export function sendInput(seq: number, dx: number, dy: number, dt: number): void {
  room?.send(MSG.input, { seq, dx, dy, dt });
}

export function sendAttack(): void {
  room?.send(MSG.attack, {});
}

export function sendSkill(slot: number): void {
  room?.send(MSG.skill, { slot });
}

export function sendChat(text: string): void {
  room?.send(MSG.chat, { text });
}

export function sendRespawn(): void {
  room?.send(MSG.respawn, {});
}

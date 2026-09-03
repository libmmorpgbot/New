import { Room, type Client } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import {
  CHAT_MIN_INTERVAL_MS,
  ChatMessage,
  EVT,
  INPUT_DT_BUDGET_PER_SEC,
  InputMessage,
  MAX_INPUT_DT_MS,
  MSG,
  PLAYER_RADIUS,
  SPAWN_POINT,
  SkillMessage,
  VIEW_HYSTERESIS,
  VIEW_RADIUS,
  VIEW_REFRESH_MS,
  isSolidAt,
  TICK_MS,
  dir8Index,
  findFreeSpot,
  generateTiles,
  isClassId,
  moveWithCollision,
  normalize,
  statsForLevel,
  xpToNextLevel,
  type ChatEvent,
  type ClassId,
  type HitEvent,
  type SkillUsedEvent,
} from "@tg-mmo/shared";
import { verifyToken, type TokenPayload } from "../../auth/jwt";
import { env } from "../../env";
import { loadProgress, persistenceEnabled, storeProgress, userIdFromSubject } from "../persistence";
import { updateMonsters } from "../sim/ai";
import { applyLevelStats, performBasicAttack, useSkill } from "../sim/combat";
import type { SimContext } from "../sim/context";
import { spawnAll } from "../sim/spawner";
import type { MonsterRuntime, PlayerRuntime } from "../sim/types";
import { GameState, MonsterState, PlayerState } from "./schema";

/** An entity enters a view at this distance... */
const VIEW_ENTER_SQ = VIEW_RADIUS * VIEW_RADIUS;
/** ...and only leaves once it is past the hysteresis margin. */
const VIEW_LEAVE_SQ = (VIEW_RADIUS + VIEW_HYSTERESIS) ** 2;

interface JoinOptions {
  token?: string;
  cls?: string;
}

export class GameRoom extends Room<GameState> {
  override maxClients = 100;

  override state = new GameState();

  private tiles = generateTiles();
  private monsters = new Map<string, MonsterRuntime>();
  private players = new Map<string, PlayerRuntime>();
  private inputs = new Map<string, InputMessage[]>();
  private lastTickAt = Date.now();
  private viewAcc = 0;

  override onCreate(): void {
    this.monsters = spawnAll(this.tiles);
    for (const monster of this.monsters.values()) {
      this.state.monsters.set(monster.state.id, monster.state);
    }

    this.setPatchRate(TICK_MS);

    this.onMessage(MSG.input, (client, raw) => {
      const parsed = InputMessage.safeParse(raw);
      if (!parsed.success) return;
      const queue = this.inputs.get(client.sessionId);
      if (!queue) return;
      // Bound the queue so a client cannot buy itself extra movement by flooding.
      if (queue.length < 40) queue.push(parsed.data);
    });

    this.onMessage(MSG.attack, (client) => {
      const player = this.players.get(client.sessionId);
      if (player) performBasicAttack(this.ctx(), player);
    });

    this.onMessage(MSG.skill, (client, raw) => {
      const parsed = SkillMessage.safeParse(raw);
      const player = this.players.get(client.sessionId);
      if (!parsed.success || !player) return;
      const used = useSkill(this.ctx(), player, parsed.data.slot);
      if (!used) client.send(EVT.rejected, { what: "skill", slot: parsed.data.slot });
    });

    this.onMessage(MSG.chat, (client, raw) => {
      const parsed = ChatMessage.safeParse(raw);
      const player = this.players.get(client.sessionId);
      if (!parsed.success || !player) return;

      const now = Date.now();
      if (now - player.lastChatAt < CHAT_MIN_INTERVAL_MS) return;
      player.lastChatAt = now;

      const event: ChatEvent = { from: player.state.name, text: parsed.data.text, at: now };
      this.broadcast(EVT.chat, event);
    });

    this.onMessage(MSG.respawn, (client) => {
      const player = this.players.get(client.sessionId);
      if (player?.state.dead && Date.now() >= player.respawnAt) this.respawn(player);
    });

    this.setSimulationInterval(() => this.tick(), TICK_MS);

    if (persistenceEnabled) {
      this.clock.setInterval(() => void this.saveAll(), env.AUTOSAVE_MS);
    }
  }

  override async onAuth(_client: Client, options: JoinOptions): Promise<TokenPayload> {
    return verifyToken(options?.token);
  }

  override onJoin(client: Client, options: JoinOptions, auth: TokenPayload): void {
    const cls: ClassId = isClassId(options?.cls) ? options.cls : "mage";
    const spot = findFreeSpot(this.tiles, SPAWN_POINT.x, SPAWN_POINT.y, PLAYER_RADIUS);

    const state = new PlayerState();
    state.id = client.sessionId;
    state.name = auth.name.slice(0, 24);
    state.cls = cls;
    state.x = spot.x;
    state.y = spot.y;
    state.level = 1;
    state.xpToNext = xpToNextLevel(1);

    const runtime: PlayerRuntime = {
      state,
      sessionId: client.sessionId,
      userId: persistenceEnabled ? userIdFromSubject(auth.sub) : null,
      faceX: 0,
      faceY: 1,
      attackReadyAt: 0,
      busyUntil: 0,
      skillReadyAt: [0, 0, 0, 0],
      shieldUntil: 0,
      respawnAt: 0,
      lastChatAt: 0,
      dtSpent: 0,
      dtWindowStart: Date.now(),
      hpAcc: 0,
      mpAcc: 0,
    };

    applyLevelStats(runtime);
    state.hp = state.maxHp;
    state.mp = state.maxMp;

    this.players.set(client.sessionId, runtime);
    this.inputs.set(client.sessionId, []);
    this.state.players.set(client.sessionId, state);

    // Seed the view now: the first patch has to carry the player's own entry,
    // otherwise the client has nothing to render or reconcile against.
    client.view = new StateView();
    this.refreshView(client);

    if (runtime.userId !== null) void this.restoreProgress(runtime);
  }

  /**
   * Pulls saved progress in after the player is already in the world, so a slow
   * database never delays the join. Level and position are re-validated here.
   */
  private async restoreProgress(runtime: PlayerRuntime): Promise<void> {
    if (runtime.userId === null) return;
    try {
      const saved = await loadProgress(runtime.userId, runtime.state.cls);
      if (!saved || !this.players.has(runtime.sessionId)) return;

      runtime.state.level = Math.max(1, saved.level);
      runtime.state.xp = Math.max(0, saved.xp);
      applyLevelStats(runtime);
      runtime.state.hp = runtime.state.maxHp;
      runtime.state.mp = runtime.state.maxMp;

      const inBounds =
        saved.x > 0 && saved.y > 0 && !isSolidAt(this.tiles, saved.x, saved.y);
      if (inBounds) {
        runtime.state.x = saved.x;
        runtime.state.y = saved.y;
      }
    } catch (err) {
      console.error("[game-server] failed to load character", err);
    }
  }

  private async saveAll(): Promise<void> {
    await Promise.all([...this.players.values()].map((player) => this.savePlayer(player)));
  }

  private async savePlayer(player: PlayerRuntime): Promise<void> {
    if (player.userId === null) return;
    try {
      await storeProgress(player.userId, player.state.cls, {
        level: player.state.level,
        xp: player.state.xp,
        x: player.state.x,
        y: player.state.y,
      });
    } catch (err) {
      console.error("[game-server] failed to save character", err);
    }
  }

  override onLeave(client: Client): void {
    const leaving = this.players.get(client.sessionId);
    if (leaving) {
      void this.savePlayer(leaving);
      // `StateView.remove` needs the entity still attached to the state.
      this.dropFromViews(leaving.state);
    }

    this.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    for (const monster of this.monsters.values()) {
      if (monster.targetSessionId === client.sessionId) monster.targetSessionId = null;
    }
  }

  private ctx(): SimContext {
    return {
      now: Date.now(),
      tiles: this.tiles,
      players: this.players,
      monsters: this.monsters,
      emit: {
        hit: (event: HitEvent) => this.sendNear(event.x, event.y, EVT.hit, event),
        levelUp: (sessionId, level) => {
          this.clients.getById(sessionId)?.send(EVT.levelUp, { level });
        },
        skillUsed: (event: SkillUsedEvent) =>
          this.sendNear(event.x, event.y, EVT.skillUsed, event),
      },
    };
  }

  private tick(): void {
    const now = Date.now();
    const dtSec = Math.min(0.25, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    const ctx = this.ctx();

    for (const player of this.players.values()) {
      this.applyInputs(ctx, player);
      this.updatePlayerVitals(ctx, player, dtSec);
    }

    updateMonsters(ctx, dtSec);
    this.syncMonsterVisibility();

    this.viewAcc += dtSec * 1000;
    if (this.viewAcc >= VIEW_REFRESH_MS) {
      this.viewAcc = 0;
      for (const client of this.clients) this.refreshView(client);
    }

    this.state.tick = (this.state.tick + 1) >>> 0;
  }

  private applyInputs(ctx: SimContext, player: PlayerRuntime): void {
    const queue = this.inputs.get(player.sessionId);
    if (!queue) return;

    // Rolling one-second budget of simulated time; anything past it is dropped.
    if (ctx.now - player.dtWindowStart >= 1000) {
      player.dtWindowStart = ctx.now;
      player.dtSpent = 0;
    }

    let moved = false;

    for (const input of queue) {
      player.state.lastSeq = input.seq;

      const dt = Math.min(input.dt, MAX_INPUT_DT_MS);
      if (player.dtSpent + dt > INPUT_DT_BUDGET_PER_SEC) continue;
      player.dtSpent += dt;

      if (player.state.dead) continue;

      const dir = normalize(input.dx, input.dy, 0.01);
      if (dir.x !== 0 || dir.y !== 0) {
        player.faceX = dir.x;
        player.faceY = dir.y;
        player.state.dir = dir8Index(dir.x, dir.y);
      }

      // Attacks and casts root the character for their wind-up.
      if (ctx.now < player.busyUntil) continue;
      if (dir.x === 0 && dir.y === 0) continue;

      const speed = statsForLevel(player.state.cls as ClassId, player.state.level).moveSpeed;
      const step = (speed * dt) / 1000;
      const next = moveWithCollision(
        this.tiles,
        player.state.x,
        player.state.y,
        dir.x * step,
        dir.y * step,
        PLAYER_RADIUS,
      );
      player.state.x = next.x;
      player.state.y = next.y;
      moved = true;
    }

    queue.length = 0;

    if (player.state.dead) player.state.action = "die";
    else if (ctx.now < player.busyUntil) player.state.action = "attack";
    else player.state.action = moved ? "run" : "idle";
  }

  private updatePlayerVitals(ctx: SimContext, player: PlayerRuntime, dtSec: number): void {
    if (player.state.shield > 0 && ctx.now >= player.shieldUntil) player.state.shield = 0;

    if (player.state.dead) {
      if (ctx.now >= player.respawnAt) this.respawn(player);
      return;
    }

    const stats = statsForLevel(player.state.cls as ClassId, player.state.level);

    player.hpAcc += stats.hpRegenPerSec * dtSec;
    if (player.hpAcc >= 1) {
      const whole = Math.floor(player.hpAcc);
      player.hpAcc -= whole;
      player.state.hp = Math.min(player.state.maxHp, player.state.hp + whole);
    }

    player.mpAcc += stats.mpRegenPerSec * dtSec;
    if (player.mpAcc >= 1) {
      const whole = Math.floor(player.mpAcc);
      player.mpAcc -= whole;
      player.state.mp = Math.min(player.state.maxMp, player.state.mp + whole);
    }
  }

  private respawn(player: PlayerRuntime): void {
    const spot = findFreeSpot(this.tiles, SPAWN_POINT.x, SPAWN_POINT.y, PLAYER_RADIUS);
    player.state.x = spot.x;
    player.state.y = spot.y;
    player.state.hp = player.state.maxHp;
    player.state.mp = player.state.maxMp;
    player.state.dead = false;
    player.state.action = "idle";
    player.state.shield = 0;
    player.respawnAt = 0;
    player.busyUntil = 0;
  }

  /**
   * Area of interest: a client decodes only the entities around its own player.
   * The whole room state is otherwise a fixed cost per client — 92 monsters plus
   * every other player — which is what stops the room scaling past one map.
   *
   * Entities enter at `VIEW_RADIUS` and leave at `VIEW_RADIUS + VIEW_HYSTERESIS`,
   * so one walking the boundary is not added and removed on alternating passes.
   */
  private refreshView(client: Client): void {
    const view = client.view;
    const self = this.players.get(client.sessionId);
    if (!view || !self) return;

    const cx = self.state.x;
    const cy = self.state.y;

    for (const player of this.players.values()) {
      // The player's own entry drives the HUD and reconciliation — never drop it.
      if (player === self) {
        if (!view.has(self.state)) view.add(self.state);
        continue;
      }
      // Runtime and state maps are written together, so a live player is always
      // attached — unlike a monster, which drops out of the state when it dies.
      this.reconcileViewEntry(view, player.state, cx, cy, true);
    }

    for (const monster of this.monsters.values()) {
      const attached = this.state.monsters.has(monster.state.id);
      this.reconcileViewEntry(view, monster.state, cx, cy, attached);
    }
  }

  /** Adds or removes one entity, leaving it alone while it stays in the band. */
  private reconcileViewEntry(
    view: StateView,
    state: PlayerState | MonsterState,
    cx: number,
    cy: number,
    attached: boolean,
  ): void {
    const seen = view.has(state);
    if (!attached) {
      if (seen) view.remove(state);
      return;
    }

    const dx = state.x - cx;
    const dy = state.y - cy;
    const distSq = dx * dx + dy * dy;

    if (seen) {
      if (distSq > VIEW_LEAVE_SQ) view.remove(state);
    } else if (distSq <= VIEW_ENTER_SQ) {
      view.add(state);
    }
  }

  /**
   * Takes an entity out of every view while it is still attached to the state —
   * `StateView.remove` reads its parent, so it has to run before the delete.
   */
  private dropFromViews(state: PlayerState | MonsterState): void {
    for (const client of this.clients) {
      if (client.view?.has(state)) client.view.remove(state);
    }
  }

  /**
   * One-off events are worth no more than the entities they describe: a client
   * that cannot see the fight does not need its damage numbers. Uses the outer
   * radius so an entity lingering in the hysteresis band still reports.
   */
  private sendNear(x: number, y: number, type: string, payload: unknown): void {
    for (const client of this.clients) {
      const player = this.players.get(client.sessionId);
      if (!player) continue;
      const dx = player.state.x - x;
      const dy = player.state.y - y;
      if (dx * dx + dy * dy <= VIEW_LEAVE_SQ) client.send(type, payload);
    }
  }

  /** Corpses stay in the state long enough to animate, then drop out until respawn. */
  private syncMonsterVisibility(): void {
    for (const monster of this.monsters.values()) {
      const visible = monster.state.hp > 0 || monster.removeAt !== 0;
      const present = this.state.monsters.has(monster.state.id);
      if (visible && !present) this.state.monsters.set(monster.state.id, monster.state);
      else if (!visible && present) {
        this.dropFromViews(monster.state);
        this.state.monsters.delete(monster.state.id);
      }
    }
  }
}


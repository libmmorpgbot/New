import Phaser from "phaser";
import {
  CLASSES,
  INPUT_SEND_HZ,
  MAP_HEIGHT,
  MAP_WIDTH,
  PLAYER_RADIUS,
  RESPAWN_DELAY_MS,
  dir8Index,
  generateTiles,
  getSkill,
  moveWithCollision,
  normalize,
  statsForLevel,
  type ClassId,
  type HitEvent,
} from "@tg-mmo/shared";
import { ensureHeroLoaded, ensureMonsterLoaded, isHeroReady, isMonsterReady } from "../assets";
import { HeroSprite } from "../entities/HeroSprite";
import { MonsterSprite } from "../entities/MonsterSprite";
import { createTerrain } from "../world/terrain";
import { getRoom, sendAttack, sendInput, sendSkill, setHandlers } from "../../net/net";
import type { PlayerView } from "../../net/net";
import { inputState } from "../../input/inputState";
import { useGame } from "../../store";
import { haptic } from "../../telegram";

const INPUT_STEP_MS = 1000 / INPUT_SEND_HZ;
const HUD_INTERVAL_MS = 100;
const SKILL_CAST_LOCK_MS = 260;

interface PendingInput {
  seq: number;
  dx: number;
  dy: number;
  dt: number;
}

export class WorldScene extends Phaser.Scene {
  private tiles = generateTiles();
  private heroes = new Map<string, HeroSprite>();
  private monsters = new Map<string, MonsterSprite>();

  private selfId = "";
  private selfClass: ClassId = "mage";

  /** Predicted position, stepped at the same rate the server simulates input. */
  private simX = 0;
  private simY = 0;
  /** Smoothed position actually drawn, chasing `sim`. */
  private renderX = 0;
  private renderY = 0;

  private pending: PendingInput[] = [];
  private seq = 1;
  private inputAcc = 0;
  private hudAcc = 0;
  private busyUntil = 0;
  private attackReadyAt = 0;
  private skillReadyAt = [0, 0, 0, 0];
  private spawned = false;

  constructor() {
    super("world");
  }

  create(): void {
    createTerrain(this, this.tiles);

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.setBackgroundColor("#0b0f16");
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.applyZoom());

    const room = getRoom();
    if (!room) return;
    this.selfId = room.sessionId;
    this.selfClass = useGame.getState().cls;

    void ensureHeroLoaded(this, this.selfClass);

    setHandlers({
      onHit: (event) => this.onHit(event),
      onLevelUp: (level) => this.floatText(this.renderX, this.renderY - 70, `LEVEL ${level}!`, "#ffd766"),
      onSkillUsed: (event) => {
        if (event.playerId === this.selfId) haptic("light");
      },
    });

    this.setupKeyboard();
  }

  private applyZoom(): void {
    // Aim for roughly this much of the world across the short edge of the screen.
    const VISIBLE_WORLD_PX = 230;
    const shortEdge = Math.min(this.scale.gameSize.width, this.scale.gameSize.height);
    const zoom = Phaser.Math.Clamp(shortEdge / VISIBLE_WORLD_PX, 1.25, 3.5);
    this.cameras.main.setZoom(Math.round(zoom * 4) / 4);
  }

  private setupKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    keyboard.on("keydown-SPACE", () => {
      inputState.attackQueued = true;
    });
    for (let i = 1; i <= 4; i++) {
      keyboard.on(`keydown-${["ONE", "TWO", "THREE", "FOUR"][i - 1]}`, () => {
        inputState.skillQueued = i - 1;
      });
    }
  }

  private keyboardVector(): { x: number; y: number } {
    const keyboard = this.input.keyboard;
    if (!keyboard) return { x: 0, y: 0 };
    const keys = keyboard.addKeys("W,A,S,D,UP,LEFT,DOWN,RIGHT") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    let x = 0;
    let y = 0;
    if (keys.A?.isDown || keys.LEFT?.isDown) x -= 1;
    if (keys.D?.isDown || keys.RIGHT?.isDown) x += 1;
    if (keys.W?.isDown || keys.UP?.isDown) y -= 1;
    if (keys.S?.isDown || keys.DOWN?.isDown) y += 1;
    return { x, y };
  }

  override update(_time: number, delta: number): void {
    const room = getRoom();
    // `room.state` fills in only once the first patch has been decoded.
    if (!room?.state?.players || !room.state.monsters) return;

    const self = room.state.players.get(this.selfId) as PlayerView | undefined;
    if (self && !this.spawned) {
      this.simX = self.x;
      this.simY = self.y;
      this.renderX = self.x;
      this.renderY = self.y;
      this.spawned = true;
    }

    this.inputAcc += delta;
    let guard = 0;
    while (this.inputAcc >= INPUT_STEP_MS && guard++ < 5) {
      this.inputAcc -= INPUT_STEP_MS;
      this.stepInput(INPUT_STEP_MS, self);
    }

    if (self) this.reconcile(self);

    // Exponential smoothing keeps the drawn position stable across variable frame times.
    const t = 1 - Math.exp(-delta / 55);
    this.renderX = Phaser.Math.Linear(this.renderX, this.simX, t);
    this.renderY = Phaser.Math.Linear(this.renderY, this.simY, t);

    this.syncPlayers(room, delta);
    this.syncMonsters(room, delta);

    this.hudAcc += delta;
    if (this.hudAcc >= HUD_INTERVAL_MS) {
      this.hudAcc = 0;
      this.pushHud(self);
    }
  }

  private stepInput(dt: number, self: PlayerView | undefined): void {
    const now = this.time.now;
    const dead = self?.dead ?? false;

    if (!dead) {
      if (inputState.attackQueued && now >= this.attackReadyAt && now >= this.busyUntil) {
        const stats = statsForLevel(this.selfClass, self?.level ?? 1);
        this.attackReadyAt = now + stats.attackCooldownMs;
        this.busyUntil = now + stats.attackWindupMs;
        sendAttack();
        haptic("light");
      }
      if (inputState.skillQueued >= 0) {
        const slot = inputState.skillQueued;
        const skillId = CLASSES[this.selfClass].skills[slot];
        const skill = skillId ? getSkill(skillId) : undefined;
        const affordable = (self?.mp ?? 0) >= (skill?.manaCost ?? 0);
        if (skill && now >= (this.skillReadyAt[slot] ?? 0) && now >= this.busyUntil && affordable) {
          this.skillReadyAt[slot] = now + skill.cooldownMs;
          this.busyUntil = now + SKILL_CAST_LOCK_MS;
          sendSkill(slot);
          haptic("medium");
        }
      }
    }
    inputState.attackQueued = false;
    inputState.skillQueued = -1;

    const keys = this.keyboardVector();
    const raw = normalize(inputState.moveX + keys.x, inputState.moveY + keys.y, 0.12);

    const input: PendingInput = { seq: this.seq++, dx: raw.x, dy: raw.y, dt };
    sendInput(input.seq, input.dx, input.dy, input.dt);
    this.pending.push(input);
    if (this.pending.length > 60) this.pending.shift();

    if (!dead) this.applyMove(input, now);
  }

  /** The exact movement the server will run for this input — prediction must match it. */
  private applyMove(input: PendingInput, now: number): void {
    if (now < this.busyUntil) return;
    if (input.dx === 0 && input.dy === 0) return;

    const speed = statsForLevel(this.selfClass, useGame.getState().hud.level || 1).moveSpeed;
    const step = (speed * input.dt) / 1000;
    const next = moveWithCollision(
      this.tiles,
      this.simX,
      this.simY,
      input.dx * step,
      input.dy * step,
      PLAYER_RADIUS,
    );
    this.simX = next.x;
    this.simY = next.y;
  }

  /**
   * Drops inputs the server has already consumed, replays the rest from the
   * authoritative position, and only snaps when the two disagree enough to see.
   */
  private reconcile(self: PlayerView): void {
    while (this.pending.length && this.pending[0]!.seq <= self.lastSeq) this.pending.shift();

    if (self.dead) {
      this.simX = self.x;
      this.simY = self.y;
      return;
    }

    let x = self.x;
    let y = self.y;
    const speed = statsForLevel(this.selfClass, self.level).moveSpeed;
    for (const input of this.pending) {
      if (input.dx === 0 && input.dy === 0) continue;
      const step = (speed * input.dt) / 1000;
      const next = moveWithCollision(this.tiles, x, y, input.dx * step, input.dy * step, PLAYER_RADIUS);
      x = next.x;
      y = next.y;
    }

    if (Math.hypot(x - this.simX, y - this.simY) > 2) {
      this.simX = x;
      this.simY = y;
    }
  }

  private syncPlayers(room: NonNullable<ReturnType<typeof getRoom>>, delta: number): void {
    const seen = new Set<string>();
    const t = 1 - Math.exp(-delta / 90);

    room.state.players.forEach((player: PlayerView, id: string) => {
      seen.add(id);
      let sprite = this.heroes.get(id);

      if (!sprite) {
        if (!isHeroReady(player.cls)) {
          void ensureHeroLoaded(this, player.cls);
          return;
        }
        sprite = new HeroSprite(this, player.cls, player.name, id === this.selfId);
        this.heroes.set(id, sprite);
        sprite.setPosition(player.x, player.y);
        if (id === this.selfId) this.cameras.main.startFollow(sprite, true, 0.14, 0.14);
      }

      if (id === this.selfId) {
        sprite.setPosition(this.renderX, this.renderY);
        // Facing follows the local input immediately; the body action follows the server.
        const local = normalize(inputState.moveX, inputState.moveY, 0.12);
        const dir = local.x || local.y ? dir8Index(local.x, local.y) : player.dir;
        sprite.play8(dir, player.action);
      } else {
        sprite.setPosition(
          Phaser.Math.Linear(sprite.x, player.x, t),
          Phaser.Math.Linear(sprite.y, player.y, t),
        );
        sprite.play8(player.dir, player.action);
      }

      sprite.setVitals(player.hp, player.maxHp, player.shield);
      sprite.setAlpha(player.dead ? 0.55 : 1);
      sprite.setDepth(sprite.y);
    });

    for (const [id, sprite] of this.heroes) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.heroes.delete(id);
      }
    }
  }

  private syncMonsters(room: NonNullable<ReturnType<typeof getRoom>>, delta: number): void {
    const seen = new Set<string>();
    const t = 1 - Math.exp(-delta / 90);

    room.state.monsters.forEach((monster, id: string) => {
      seen.add(id);
      let sprite = this.monsters.get(id);

      if (!sprite) {
        if (!isMonsterReady(monster.kind)) {
          void ensureMonsterLoaded(this, monster.kind);
          return;
        }
        sprite = new MonsterSprite(this, monster.kind);
        this.monsters.set(id, sprite);
        sprite.setPosition(monster.x, monster.y);
      }

      sprite.setPosition(
        Phaser.Math.Linear(sprite.x, monster.x, t),
        Phaser.Math.Linear(sprite.y, monster.y, t),
      );
      sprite.play4(monster.dir, monster.action);
      sprite.setVitals(monster.hp, monster.maxHp);
      sprite.setDepth(sprite.y);
    });

    for (const [id, sprite] of this.monsters) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.monsters.delete(id);
      }
    }
  }

  private onHit(event: HitEvent): void {
    const target =
      event.targetType === "monster" ? this.monsters.get(event.targetId) : this.heroes.get(event.targetId);
    target?.flash();

    const mine = event.attackerId === this.selfId;
    const onMe = event.targetType === "player" && event.targetId === this.selfId;
    if (onMe) haptic("heavy");

    const colour = onMe ? "#ff8080" : event.crit ? "#ffe066" : "#ffffff";
    this.floatText(event.x, event.y, `${event.crit ? "!" : ""}${event.amount}`, colour, mine || onMe);
  }

  private floatText(x: number, y: number, text: string, colour: string, emphasise = true): void {
    const label = this.add
      .text(x, y - 40, text, {
        fontSize: emphasise ? "15px" : "12px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: colour,
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100000);

    this.tweens.add({
      targets: label,
      y: y - 78,
      alpha: 0,
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private pushHud(self: PlayerView | undefined): void {
    if (!self) return;
    const store = useGame.getState();
    const now = this.time.now;

    store.setHud({
      name: self.name,
      level: self.level,
      hp: self.hp,
      maxHp: self.maxHp,
      mp: self.mp,
      maxMp: self.maxMp,
      shield: self.shield,
      xp: self.xp,
      xpToNext: self.xpToNext,
      dead: self.dead,
      respawnIn: self.dead ? Math.max(0, RESPAWN_DELAY_MS) : 0,
    });
    store.setCooldowns(this.skillReadyAt.map((readyAt) => Math.max(0, readyAt - now)));
  }
}

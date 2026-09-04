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
import { MONSTERS } from "@tg-mmo/shared";
import { ensureHeroLoaded, ensureMonsterLoaded, isHeroReady, isMonsterReady } from "../assets";
import { HeroSprite } from "../entities/HeroSprite";
import { MonsterSprite } from "../entities/MonsterSprite";
import { createTerrain } from "../world/terrain";
import { getRoom, sendAttack, sendInput, sendSkill, setHandlers } from "../../net/net";
import type { MonsterView, PlayerView } from "../../net/net";
import { inputState } from "../../input/inputState";
import { useGame } from "../../store";
import { haptic } from "../../telegram";

const INPUT_STEP_MS = 1000 / INPUT_SEND_HZ;
const HUD_INTERVAL_MS = 100;
const SKILL_CAST_LOCK_MS = 260;
/** How close a tap has to land, in *screen* pixels, to grab a monster. */
const PICK_RADIUS_PX = 42;
/** Taps land on the body, which sits above the entity's feet position. */
const PICK_BODY_OFFSET = 14;
/** Margin around the camera view so sprites appear before they slide in. */
const CULL_MARGIN = 120;
/** How many damage labels to keep alive for reuse. */
const FLOATER_POOL = 24;

function inView(view: Phaser.Geom.Rectangle, x: number, y: number): boolean {
  return (
    x >= view.x - CULL_MARGIN &&
    x <= view.right + CULL_MARGIN &&
    y >= view.y - CULL_MARGIN &&
    y <= view.bottom + CULL_MARGIN
  );
}

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
  private targetId: string | null = null;
  private readonly floaters: Phaser.GameObjects.Text[] = [];
  private uiScale = 1;

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
    this.setupTargeting();
  }

  /** Tap a monster to lock onto it; tap bare ground to let go. */
  private setupTargeting(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const room = getRoom();
      if (!room?.state?.monsters) return;

      // Tolerance is fixed on screen: pulling the camera back must not make
      // monsters harder to hit.
      let best: string | null = null;
      let bestDist = PICK_RADIUS_PX / this.cameras.main.zoom;

      room.state.monsters.forEach((monster: MonsterView, id: string) => {
        if (monster.hp <= 0) return;
        const d = Math.hypot(monster.x - world.x, monster.y - PICK_BODY_OFFSET - world.y);
        if (d < bestDist) {
          bestDist = d;
          best = id;
        }
      });

      this.setTarget(best);
    });
  }

  private setTarget(id: string | null): void {
    if (this.targetId === id) return;
    if (this.targetId) this.monsters.get(this.targetId)?.setSelected(false);
    this.targetId = id;
    if (id) {
      this.monsters.get(id)?.setSelected(true);
      haptic("light");
    }
    this.pushTarget();
  }

  /** Mirrors the locked monster into the store so the target frame can render it. */
  private pushTarget(): void {
    const room = getRoom();
    const monster = this.targetId
      ? (room?.state?.monsters?.get(this.targetId) as MonsterView | undefined)
      : undefined;

    if (!monster || monster.hp <= 0) {
      if (this.targetId) this.setTarget(null);
      else useGame.getState().setTarget(null);
      return;
    }

    const def = MONSTERS[monster.kind];
    useGame.getState().setTarget({
      id: this.targetId!,
      kind: monster.kind,
      name: def?.name ?? monster.kind,
      level: monster.level,
      hp: monster.hp,
      maxHp: monster.maxHp,
    });
  }

  private applyZoom(): void {
    // Aim for roughly this much of the world across the short edge of the screen.
    const VISIBLE_WORLD_PX = 690;
    const shortEdge = Math.min(this.scale.gameSize.width, this.scale.gameSize.height);
    // Not snapped to quarters any more: a fractional zoom is smoother than a
    // rounded one once the camera itself stops rounding its scroll.
    this.cameras.main.setZoom(Phaser.Math.Clamp(shortEdge / VISIBLE_WORLD_PX, 0.4, 1.6));
    this.uiScale = 1 / this.cameras.main.zoom;
    for (const sprite of this.heroes.values()) sprite.setUiScale(this.uiScale);
    for (const sprite of this.monsters.values()) sprite.setUiScale(this.uiScale);
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

    // Exponential smoothing keeps the drawn position stable across variable frame
    // times. The constant has to stay well under the input step, or the smoothing
    // lags the simulation and the character visibly surges.
    const t = 1 - Math.exp(-delta / 38);
    this.renderX = Phaser.Math.Linear(this.renderX, this.simX, t);
    this.renderY = Phaser.Math.Linear(this.renderY, this.simY, t);

    this.syncPlayers(room, delta);
    this.syncMonsters(room, delta);

    this.hudAcc += delta;
    if (this.hudAcc >= HUD_INTERVAL_MS) {
      this.hudAcc = 0;
      this.pushHud(self);
      this.pushTarget();
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
        sendAttack(this.targetId ?? undefined);
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
    const view = this.cameras.main.worldView;

    room.state.players.forEach((player: PlayerView, id: string) => {
      seen.add(id);
      let sprite = this.heroes.get(id);

      if (!sprite) {
        if (!isHeroReady(player.cls)) {
          void ensureHeroLoaded(this, player.cls);
          return;
        }
        sprite = new HeroSprite(this, player.cls, player.name, id === this.selfId);
        sprite.setUiScale(this.uiScale);
        this.heroes.set(id, sprite);
        sprite.setPosition(player.x, player.y);
        // `false`: rounding the camera scroll to whole pixels is what makes slow
        // movement look like it is stepping rather than gliding.
        if (id === this.selfId) this.cameras.main.startFollow(sprite, false, 0.16, 0.16);
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

      const visible = id === this.selfId || inView(view, player.x, player.y);
      sprite.setVisible(visible);
      if (visible) {
        sprite.setVitals(player.hp, player.maxHp, player.shield);
        sprite.setAlpha(player.dead ? 0.55 : 1);
        sprite.setDepth(sprite.y);
      }
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
    const view = this.cameras.main.worldView;

    room.state.monsters.forEach((monster, id: string) => {
      seen.add(id);
      let sprite = this.monsters.get(id);
      const visible = inView(view, monster.x, monster.y);

      if (!sprite) {
        // Nothing is built for a monster you cannot see; walking towards it creates it.
        if (!visible) return;
        if (!isMonsterReady(monster.kind)) {
          void ensureMonsterLoaded(this, monster.kind);
          return;
        }
        sprite = new MonsterSprite(this, monster.kind);
        sprite.setUiScale(this.uiScale);
        this.monsters.set(id, sprite);
        sprite.setPosition(monster.x, monster.y);
        if (id === this.targetId) sprite.setSelected(true);
      }

      sprite.setVisible(visible);
      if (!visible) {
        // Off-screen: keep the position current, skip animation and redraws.
        sprite.setPosition(monster.x, monster.y);
        return;
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
        if (id === this.targetId) this.setTarget(null);
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

  /**
   * Damage numbers are recycled rather than created.
   *
   * Every Phaser Text owns a canvas that gets uploaded to the GPU when its
   * contents change; spawning one per hit means a texture upload on every swing,
   * which is exactly the kind of hitch that reads as "the game is not smooth".
   */
  private floatText(x: number, y: number, text: string, colour: string, emphasise = true): void {
    const label = this.floaters.pop() ?? this.makeFloater();

    label
      .setText(text)
      .setPosition(x, y - 40)
      .setColor(colour)
      .setFontSize(emphasise ? 15 : 12)
      .setAlpha(1)
      .setVisible(true);

    this.tweens.add({
      targets: label,
      y: y - 78,
      alpha: 0,
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => {
        label.setVisible(false);
        if (this.floaters.length < FLOATER_POOL) this.floaters.push(label);
        else label.destroy();
      },
    });
  }

  private makeFloater(): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, "", {
        fontSize: "15px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100000)
      .setVisible(false);
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
      gold: self.gold,
      dead: self.dead,
      respawnIn: self.dead ? Math.max(0, RESPAWN_DELAY_MS) : 0,
    });
    store.setCooldowns(this.skillReadyAt.map((readyAt) => Math.max(0, readyAt - now)));
  }
}

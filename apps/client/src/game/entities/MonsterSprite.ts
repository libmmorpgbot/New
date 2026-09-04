import Phaser from "phaser";
import { MONSTERS } from "@tg-mmo/shared";
import { getManifest, measureAnchor, monsterAnimKey, monsterTextureKey } from "../assets";

/** One monster on screen. Monster sheets carry four facings, so `dir` picks the row. */
export class MonsterSprite extends Phaser.GameObjects.Container {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly selection: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly overlay: Phaser.GameObjects.Container;
  private readonly kind: string;
  private currentAnim = "";
  private headOffset: number;

  /** Redrawing Graphics every frame for a screenful of monsters is the whole frame budget. */
  private lastHp = -1;
  private lastMaxHp = -1;
  private selected = false;

  constructor(scene: Phaser.Scene, kind: string) {
    super(scene, 0, 0);
    this.kind = kind;

    const sheets = getManifest().monsters[kind];
    const frameW = sheets?.frameWidth ?? 64;
    const frameH = sheets?.frameHeight ?? 64;
    const idleKey = monsterTextureKey(kind, "idle");
    const anchor = measureAnchor(scene, idleKey, frameW, frameH);
    this.headOffset = anchor.headOffset;

    this.selection = scene.add.graphics();
    this.sprite = scene.add.sprite(0, 0, idleKey, 0);
    this.sprite.setOrigin(0.5, anchor.originY);
    this.bar = scene.add.graphics();
    // Nameplate and bar live in their own container so they can be scaled against
    // the camera — world-space text shrinks into illegibility when you zoom out.
    this.overlay = scene.add.container(0, 0);

    const def = MONSTERS[kind];
    this.label = scene.add
      .text(0, this.headOffset - 26, def ? `${def.name} · ${def.level}` : kind, {
        fontSize: "10px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#f0b8b0",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    this.overlay.add([this.bar, this.label]);
    this.add([this.selection, this.sprite, this.overlay]);
    scene.add.existing(this);
  }

  play4(dirIndex: number, action: string): void {
    const key = monsterAnimKey(this.kind, action, dirIndex % 4);
    if (this.currentAnim === key) return;
    if (!this.scene.anims.exists(key)) return;
    this.currentAnim = key;
    this.sprite.play(key, true);
  }

  /** Name, level and health are always on — you should know what you are walking into. */
  setVitals(hp: number, maxHp: number): void {
    if (hp === this.lastHp && maxHp === this.lastMaxHp) return;
    this.lastHp = hp;
    this.lastMaxHp = maxHp;

    this.bar.clear();
    const alive = hp > 0 && maxHp > 0;
    this.label.setVisible(alive);
    if (!alive) return;

    const width = 34;
    const y = this.headOffset - 12;
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);

    this.bar.fillStyle(0x05090f, 0.85);
    this.bar.fillRect(-width / 2 - 1, y - 1, width + 2, 6);
    this.bar.fillStyle(0xd8483f, 1);
    this.bar.fillRect(-width / 2, y, width * ratio, 4);
    this.bar.fillStyle(0xffffff, 0.3);
    this.bar.fillRect(-width / 2, y, width * ratio, 1);
  }

  /** Keeps the plate a constant size on screen whatever the camera zoom is. */
  setUiScale(scale: number): void {
    this.overlay.setScale(scale);
  }

  setSelected(selected: boolean): void {
    if (selected === this.selected) return;
    this.selected = selected;

    this.selection.clear();
    if (!selected) return;

    this.selection.lineStyle(1.5, 0xff6b52, 0.95);
    this.selection.strokeEllipse(0, -2, 38, 15);
    this.selection.lineStyle(1, 0xff6b52, 0.4);
    this.selection.strokeEllipse(0, -2, 46, 19);
  }

  flash(): void {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.sprite.clearTint());
  }
}

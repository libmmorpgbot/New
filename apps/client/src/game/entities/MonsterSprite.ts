import Phaser from "phaser";
import { MONSTERS } from "@tg-mmo/shared";
import { getManifest, measureAnchor, monsterAnimKey, monsterTextureKey } from "../assets";

/** One monster on screen. Monster sheets carry four facings, so `dir` picks the row. */
export class MonsterSprite extends Phaser.GameObjects.Container {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly kind: string;
  private currentAnim = "";
  private headOffset: number;

  constructor(scene: Phaser.Scene, kind: string) {
    super(scene, 0, 0);
    this.kind = kind;

    const sheets = getManifest().monsters[kind];
    const frameW = sheets?.frameWidth ?? 64;
    const frameH = sheets?.frameHeight ?? 64;
    const idleKey = monsterTextureKey(kind, "idle");
    const anchor = measureAnchor(scene, idleKey, frameW, frameH);
    this.headOffset = anchor.headOffset;

    this.sprite = scene.add.sprite(0, 0, idleKey, 0);
    this.sprite.setOrigin(0.5, anchor.originY);

    this.bar = scene.add.graphics();

    const def = MONSTERS[kind];
    this.label = scene.add
      .text(0, this.headOffset - 22, def ? `${def.name} ${def.level}` : kind, {
        fontSize: "10px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#f0b8b0",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.add([this.sprite, this.bar, this.label]);
    scene.add.existing(this);
  }

  play4(dirIndex: number, action: string): void {
    const key = monsterAnimKey(this.kind, action, dirIndex % 4);
    if (this.currentAnim === key) return;
    if (!this.scene.anims.exists(key)) return;
    this.currentAnim = key;
    this.sprite.play(key, true);
  }

  /** The nameplate and bar only appear once the monster has been engaged. */
  setVitals(hp: number, maxHp: number): void {
    const damaged = hp < maxHp && hp > 0;
    this.label.setVisible(damaged);
    this.bar.clear();
    if (!damaged || maxHp <= 0) return;

    const width = 30;
    const y = this.headOffset - 8;
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.bar.fillStyle(0x05090f, 0.85);
    this.bar.fillRect(-width / 2 - 1, y - 1, width + 2, 6);
    this.bar.fillStyle(0xd8483f, 1);
    this.bar.fillRect(-width / 2, y, width * ratio, 4);
    this.bar.fillStyle(0xffffff, 0.3);
    this.bar.fillRect(-width / 2, y, width * ratio, 1);
  }

  flash(): void {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.sprite.clearTint());
  }
}

import Phaser from "phaser";
import { DIRECTIONS_8 } from "@tg-mmo/shared";
import { getManifest, heroAnimKey, heroTextureKey, measureAnchor } from "../assets";

/** One player on screen: animated body, nameplate and a health pip. */
export class HeroSprite extends Phaser.GameObjects.Container {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly nameplate: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly cls: string;
  private currentAnim = "";
  private headOffset: number;

  constructor(scene: Phaser.Scene, cls: string, name: string, isSelf: boolean) {
    super(scene, 0, 0);
    this.cls = cls;

    const sheets = getManifest().heroes[cls];
    const frameW = sheets?.frameWidth ?? 128;
    const frameH = sheets?.frameHeight ?? 128;
    const firstKey = heroTextureKey(cls, "down-idle");
    const anchor = measureAnchor(scene, firstKey, frameW, frameH);
    this.headOffset = anchor.headOffset;

    this.sprite = scene.add.sprite(0, 0, firstKey, 0);
    this.sprite.setOrigin(0.5, anchor.originY);

    this.bar = scene.add.graphics();
    this.nameplate = scene.add
      .text(0, this.headOffset - 26, name, {
        fontSize: "12px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: isSelf ? "#8ee6a3" : "#dbe4f2",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);

    this.add([this.sprite, this.bar, this.nameplate]);
    scene.add.existing(this);
  }

  /** Switches animation only when the (direction, action) pair actually changed. */
  play8(dirIndex: number, action: string): void {
    const anim = action === "die" ? "die" : `${DIRECTIONS_8[dirIndex % 8]}-${action}`;
    const key = heroAnimKey(this.cls, anim);
    if (this.currentAnim === key) return;
    if (!this.scene.anims.exists(key)) return;
    this.currentAnim = key;
    this.sprite.play(key, true);
  }

  setVitals(hp: number, maxHp: number, shield: number): void {
    this.bar.clear();
    if (maxHp <= 0) return;

    const width = 34;
    const y = this.headOffset - 8;
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);

    this.bar.fillStyle(0x000000, 0.55);
    this.bar.fillRect(-width / 2 - 1, y - 1, width + 2, 5);
    this.bar.fillStyle(ratio > 0.35 ? 0x5ac46a : 0xd05050, 1);
    this.bar.fillRect(-width / 2, y, width * ratio, 3);

    if (shield > 0) {
      this.bar.fillStyle(0x6fa8ff, 0.9);
      this.bar.fillRect(-width / 2, y - 4, width * Phaser.Math.Clamp(shield / maxHp, 0, 1), 2);
    }
  }

  flash(): void {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.sprite.clearTint());
  }
}

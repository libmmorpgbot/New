import Phaser from "phaser";
import { DIRECTIONS_8 } from "@tg-mmo/shared";
import { getManifest, heroAnimKey, heroTextureKey, measureAnchor } from "../assets";

/** One player on screen: animated body, nameplate and a health pip. */
export class HeroSprite extends Phaser.GameObjects.Container {
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Ground ring, drawn under the body so the character reads as "standing on" the map. */
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly nameplate: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  /** Plate and bar are scaled against the camera so they stay readable zoomed out. */
  private readonly overlay: Phaser.GameObjects.Container;
  private readonly cls: string;
  private currentAnim = "";
  private headOffset: number;
  /** Skip the Graphics rebuild unless something actually changed. */
  private lastHp = -1;
  private lastMaxHp = -1;
  private lastShield = -1;

  constructor(scene: Phaser.Scene, cls: string, name: string, isSelf: boolean) {
    super(scene, 0, 0);
    this.cls = cls;

    const sheets = getManifest().heroes[cls];
    const frameW = sheets?.frameWidth ?? 128;
    const frameH = sheets?.frameHeight ?? 128;
    const firstKey = heroTextureKey(cls, "down-idle");
    const anchor = measureAnchor(scene, firstKey, frameW, frameH);
    this.headOffset = anchor.headOffset;

    this.ring = scene.add.graphics();
    this.drawRing(isSelf);

    this.sprite = scene.add.sprite(0, 0, firstKey, 0);
    this.sprite.setOrigin(0.5, anchor.originY);

    this.bar = scene.add.graphics();
    this.nameplate = scene.add
      .text(0, this.headOffset - 28, name, {
        fontSize: "12px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: isSelf ? "#ffe9a8" : "#dbe4f2",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    this.overlay = scene.add.container(0, 0);
    this.overlay.add([this.bar, this.nameplate]);
    this.add([this.ring, this.sprite, this.overlay]);
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

  /** A gold ring marks you, a cool one marks everyone else. */
  private drawRing(isSelf: boolean): void {
    const color = isSelf ? 0xe9b949 : 0x5f8fc4;
    this.ring.clear();
    this.ring.fillStyle(color, 0.12);
    this.ring.fillEllipse(0, -2, 40, 16);
    this.ring.lineStyle(1.5, color, isSelf ? 0.85 : 0.5);
    this.ring.strokeEllipse(0, -2, 40, 16);
    this.ring.lineStyle(1, color, isSelf ? 0.35 : 0.2);
    this.ring.strokeEllipse(0, -2, 48, 20);
  }

  setVitals(hp: number, maxHp: number, shield: number): void {
    if (hp === this.lastHp && maxHp === this.lastMaxHp && shield === this.lastShield) return;
    this.lastHp = hp;
    this.lastMaxHp = maxHp;
    this.lastShield = shield;

    this.bar.clear();
    if (maxHp <= 0) return;

    const width = 40;
    const y = this.headOffset - 12;
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);

    // Frame first, then fill — the dark border is what keeps it readable over grass.
    this.bar.fillStyle(0x05090f, 0.85);
    this.bar.fillRect(-width / 2 - 1, y - 1, width + 2, 6);
    this.bar.fillStyle(ratio > 0.35 ? 0x3ecf6b : 0xd05050, 1);
    this.bar.fillRect(-width / 2, y, width * ratio, 4);
    this.bar.fillStyle(0xffffff, 0.35);
    this.bar.fillRect(-width / 2, y, width * ratio, 1);

    if (shield > 0) {
      this.bar.fillStyle(0x6fa8ff, 0.95);
      this.bar.fillRect(-width / 2, y - 3, width * Phaser.Math.Clamp(shield / maxHp, 0, 1), 2);
    }
  }

  setUiScale(scale: number): void {
    this.overlay.setScale(scale);
  }

  flash(): void {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.sprite.clearTint());
  }
}

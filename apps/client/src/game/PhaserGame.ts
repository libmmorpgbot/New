import Phaser from "phaser";
import { WorldScene } from "./scenes/WorldScene";

let game: Phaser.Game | null = null;

export function startPhaser(): Phaser.Game {
  if (game) return game;

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-root",
    backgroundColor: "#0b0f16",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [WorldScene],
  });

  return game;
}

export function stopPhaser(): void {
  game?.destroy(true);
  game = null;
}

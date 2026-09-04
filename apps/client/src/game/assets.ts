import Phaser from "phaser";
import { CLASSES, isClassId } from "@tg-mmo/shared";

export interface SheetInfo {
  file: string;
  frames: number;
}

export interface HeroSheets {
  frameWidth: number;
  frameHeight: number;
  anims: Record<string, SheetInfo>;
}

export interface MonsterSheets {
  frameWidth: number;
  frameHeight: number;
  rows: number;
  anims: Record<string, SheetInfo>;
}

export interface Manifest {
  heroes: Record<string, HeroSheets>;
  monsters: Record<string, MonsterSheets>;
  skills: { id: string; file: string }[];
}

const ASSET_BASE = "assets/";

let manifest: Manifest | null = null;

export async function loadManifest(): Promise<Manifest> {
  if (manifest) return manifest;
  const res = await fetch(`${ASSET_BASE}manifest.json`);
  if (!res.ok) throw new Error("Не найден assets/manifest.json — запусти `pnpm assets`.");
  manifest = (await res.json()) as Manifest;
  return manifest;
}

export function getManifest(): Manifest {
  if (!manifest) throw new Error("manifest requested before load");
  return manifest;
}

export const heroTextureKey = (cls: string, anim: string) => `hero:${cls}:${anim}`;
export const heroAnimKey = (cls: string, anim: string) => `heroAnim:${cls}:${anim}`;
export const monsterTextureKey = (kind: string, action: string) => `mon:${kind}:${action}`;
export const monsterAnimKey = (kind: string, action: string, row: number) =>
  `monAnim:${kind}:${action}:${row}`;
export const skillIconKey = (icon: string) => `icon:${icon}`;

/**
 * Hero clips are timed against the class, not with fixed numbers.
 *
 * `run` is paced so one cycle covers roughly a stride on the ground — a fixed
 * rate makes a fast class skate and a slow one march. `attack` is stretched to
 * fill the attack cooldown so the whole swing is seen: these sheets put the
 * actual hit around frame 7 of 15, and a clip cut short looks like the sprite
 * snapping backwards mid-swing.
 */
const STRIDE_PX = 68;
const IDLE_FPS = 10;
const DIE_FPS = 12;

function heroFrameRate(cls: string, action: string, frames: number): number {
  const stats = isClassId(cls) ? CLASSES[cls].stats : undefined;
  if (!stats) return action === "run" ? 14 : action === "attack" ? 22 : IDLE_FPS;

  switch (action) {
    case "run":
      return Phaser.Math.Clamp((frames * stats.moveSpeed) / STRIDE_PX, 12, 40);
    case "attack":
      return Phaser.Math.Clamp(frames / (stats.attackCooldownMs / 1000), 12, 45);
    case "die":
      return DIE_FPS;
    default:
      return IDLE_FPS;
  }
}
const MONSTER_FPS: Record<string, number> = { idle: 8, run: 10, attack: 12, death: 10 };

/** Loads are serialised: Phaser's loader is a single queue per scene. */
let loadChain: Promise<void> = Promise.resolve();
const requestedHeroes = new Set<string>();
const requestedMonsters = new Set<string>();
const readyHeroes = new Set<string>();
const readyMonsters = new Set<string>();

function runLoad(scene: Phaser.Scene, queue: () => void, afterLoad: () => void): Promise<void> {
  loadChain = loadChain.then(
    () =>
      new Promise<void>((resolve) => {
        queue();
        if (scene.load.list.size === 0 && scene.load.inflight.size === 0) {
          afterLoad();
          resolve();
          return;
        }
        scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
          afterLoad();
          resolve();
        });
        scene.load.start();
      }),
  );
  return loadChain;
}

export function ensureHeroLoaded(scene: Phaser.Scene, cls: string): Promise<void> {
  if (requestedHeroes.has(cls)) return Promise.resolve();
  requestedHeroes.add(cls);

  const sheets = getManifest().heroes[cls];
  if (!sheets) return Promise.resolve();

  return runLoad(
    scene,
    () => {
      for (const [anim, info] of Object.entries(sheets.anims)) {
        const key = heroTextureKey(cls, anim);
        if (scene.textures.exists(key)) continue;
        scene.load.spritesheet(key, ASSET_BASE + info.file, {
          frameWidth: sheets.frameWidth,
          frameHeight: sheets.frameHeight,
        });
      }
    },
    () => {
      for (const [anim, info] of Object.entries(sheets.anims)) {
        const key = heroAnimKey(cls, anim);
        if (scene.anims.exists(key)) continue;
        const action = anim === "die" ? "die" : (anim.split("-").pop() as string);
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(heroTextureKey(cls, anim), {
            start: 0,
            end: info.frames - 1,
          }),
          frameRate: heroFrameRate(cls, action, info.frames),
          repeat: action === "idle" || action === "run" ? -1 : 0,
        });
      }
      readyHeroes.add(cls);
    },
  );
}

export function ensureMonsterLoaded(scene: Phaser.Scene, kind: string): Promise<void> {
  if (requestedMonsters.has(kind)) return Promise.resolve();
  requestedMonsters.add(kind);

  const sheets = getManifest().monsters[kind];
  if (!sheets) return Promise.resolve();

  return runLoad(
    scene,
    () => {
      for (const [action, info] of Object.entries(sheets.anims)) {
        const key = monsterTextureKey(kind, action);
        if (scene.textures.exists(key)) continue;
        scene.load.spritesheet(key, ASSET_BASE + info.file, {
          frameWidth: sheets.frameWidth,
          frameHeight: sheets.frameHeight,
        });
      }
    },
    () => {
      for (const [action, info] of Object.entries(sheets.anims)) {
        // Each sheet is a 4-row grid; row index is the facing.
        for (let row = 0; row < sheets.rows; row++) {
          const key = monsterAnimKey(kind, action, row);
          if (scene.anims.exists(key)) continue;
          scene.anims.create({
            key,
            frames: scene.anims.generateFrameNumbers(monsterTextureKey(kind, action), {
              start: row * info.frames,
              end: row * info.frames + info.frames - 1,
            }),
            frameRate: MONSTER_FPS[action] ?? 10,
            repeat: action === "death" ? 0 : -1,
          });
        }
      }
      readyMonsters.add(kind);
    },
  );
}

export function isHeroReady(cls: string): boolean {
  return readyHeroes.has(cls);
}

export function isMonsterReady(kind: string): boolean {
  return readyMonsters.has(kind);
}

export interface FrameAnchor {
  /** Origin Y so the sprite's feet sit on the entity position. */
  originY: number;
  /** Offset from the feet to the top of the drawn pixels (negative, in px). */
  headOffset: number;
}

const anchorCache = new Map<string, FrameAnchor>();

/**
 * Derives the foot line from the art itself by scanning the alpha of frame 0, so
 * new sprite packs line up without a hand-tuned offset table. Measured once per
 * texture and cached.
 */
export function measureAnchor(
  scene: Phaser.Scene,
  textureKey: string,
  frameWidth: number,
  frameHeight: number,
): FrameAnchor {
  const cached = anchorCache.get(textureKey);
  if (cached) return cached;

  const fallback: FrameAnchor = { originY: 0.78, headOffset: -frameHeight * 0.55 };
  const source = scene.textures.get(textureKey)?.getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement
    | undefined;
  if (!source) return fallback;

  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;

  ctx.drawImage(source, 0, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
  const { data } = ctx.getImageData(0, 0, frameWidth, frameHeight);

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      if (data[(y * frameWidth + x) * 4 + 3]! > 16) {
        if (top === -1) top = y;
        bottom = y;
        break;
      }
    }
  }
  if (top === -1 || bottom === -1) return fallback;

  const anchor: FrameAnchor = {
    originY: (bottom + 1) / frameHeight,
    headOffset: top - (bottom + 1),
  };
  anchorCache.set(textureKey, anchor);
  return anchor;
}

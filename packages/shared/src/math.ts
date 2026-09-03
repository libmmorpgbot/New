import { DIRECTIONS_8, DIRECTIONS_4, type Direction8, type Direction4 } from "./types";

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Shortest-path angle interpolation, for smoothing remote facing. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Normalises a raw input vector, collapsing anything below the dead zone to zero. */
export function normalize(x: number, y: number, deadZone = 0.15): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < deadZone) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/**
 * Screen space is y-down, so "up" is a negative y. Index 0 is `down` and the
 * ring runs counter-clockwise on screen, matching DIRECTIONS_8.
 */
export function dir8Index(dx: number, dy: number): number {
  const angle = Math.atan2(-dy, dx); // −PI..PI, y flipped into maths orientation
  const shifted = angle + Math.PI / 2; // rotate so `down` lands on 0
  const idx = Math.round((shifted / (Math.PI * 2)) * 8);
  return ((idx % 8) + 8) % 8;
}

export function dir8(dx: number, dy: number): Direction8 {
  return DIRECTIONS_8[dir8Index(dx, dy)]!;
}

/** Four-way facing for monsters: whichever axis dominates wins. */
export function dir4Index(dx: number, dy: number): number {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 3 : 2; // right : left
  return dy > 0 ? 0 : 1; // down : up
}

export function dir4(dx: number, dy: number): Direction4 {
  return DIRECTIONS_4[dir4Index(dx, dy)]!;
}

export function dirIndexToVector(index: number): { x: number; y: number } {
  const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle), y: -Math.sin(angle) };
}

/** True when `target` sits inside a cone of `arc` radians centred on `facing`. */
export function withinArc(
  originX: number,
  originY: number,
  facingX: number,
  facingY: number,
  targetX: number,
  targetY: number,
  arc: number,
): boolean {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const len = Math.hypot(dx, dy);
  if (len === 0) return true;
  const dot = (dx / len) * facingX + (dy / len) * facingY;
  return dot >= Math.cos(arc / 2);
}

/** Deterministic PRNG (mulberry32) — server and client generate the same world from one seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

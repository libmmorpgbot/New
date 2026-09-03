/**
 * Shared mutable input, written by the DOM joystick and the keyboard handler and
 * read by the game loop. Deliberately not React state — it changes every frame.
 */
export const inputState = {
  moveX: 0,
  moveY: 0,
  /** Set for a single frame when the attack button is pressed. */
  attackQueued: false,
  /** Slot index queued by the skill bar, or -1. */
  skillQueued: -1,
};

export function queueAttack(): void {
  inputState.attackQueued = true;
}

export function queueSkill(slot: number): void {
  inputState.skillQueued = slot;
}

export function setMove(x: number, y: number): void {
  inputState.moveX = x;
  inputState.moveY = y;
}

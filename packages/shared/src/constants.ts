/** Server simulation runs at a fixed rate; the client predicts against the same numbers. */
export const TICK_RATE = 15;
export const TICK_MS = 1000 / TICK_RATE;

/**
 * How often the client simulates and flushes one movement step.
 *
 * This is deliberately the display rate: a step is then one frame, so pressing
 * or releasing the stick takes effect on the very next frame and the drawn
 * position needs no smoothing to hide the stepping. Slower rates (20 and 30 Hz
 * were both tried) put a visible delay between the thumb and the character.
 * 60 x 16.7 ms is 1000 ms of simulated time per second, inside the budget below.
 */
export const INPUT_SEND_HZ = 60;

export const TILE_SIZE = 32;
export const MAP_TILES_X = 64;
export const MAP_TILES_Y = 64;
export const MAP_WIDTH = MAP_TILES_X * TILE_SIZE;
export const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE;

/** Radius used for entity-vs-wall and entity-vs-entity checks, in pixels. */
export const PLAYER_RADIUS = 10;

/**
 * A single input packet may never claim more elapsed time than this. Without the
 * cap a client could report a huge `dt` and teleport across the map.
 */
export const MAX_INPUT_DT_MS = 250;
/** Budget of simulated milliseconds a client may spend per real second before it is throttled. */
export const INPUT_DT_BUDGET_PER_SEC = 1300;

export const RESPAWN_DELAY_MS = 4000;
export const MONSTER_RESPAWN_MS = 12000;

export const CHAT_MAX_LENGTH = 160;
export const CHAT_MIN_INTERVAL_MS = 700;

/** Entities further than this from a player are not worth streaming to them. */
export const VIEW_RADIUS = 900;

/** Monsters neither aggro into nor walk inside this radius around the spawn plaza. */
export const SAFE_ZONE_RADIUS = 300;

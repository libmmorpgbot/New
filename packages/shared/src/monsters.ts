import type { MonsterSpriteId } from "./generated/sprite-ids";

export interface MonsterDef {
  id: string;
  name: string;
  /** Folder name under `sprites/monsters/` — see the generated manifest. */
  sprite: MonsterSpriteId;
  level: number;
  maxHp: number;
  damage: number;
  /** Pixels per second; 0 means the monster is rooted and only attacks what comes close. */
  moveSpeed: number;
  attackRange: number;
  attackCooldownMs: number;
  aggroRadius: number;
  /** How far it will chase from its spawn anchor before giving up and walking home. */
  leashRadius: number;
  xp: number;
  /** Collision/hit radius in pixels. */
  radius: number;
}

const def = (
  id: string,
  name: string,
  sprite: MonsterSpriteId,
  level: number,
  maxHp: number,
  damage: number,
  moveSpeed: number,
  attackRange: number,
  extra: Partial<MonsterDef> = {},
): MonsterDef => ({
  id,
  name,
  sprite,
  level,
  maxHp,
  damage,
  moveSpeed,
  attackRange,
  attackCooldownMs: 1400,
  aggroRadius: 220,
  leashRadius: 460,
  xp: Math.round(6 + level * level * 1.6),
  radius: 12,
  ...extra,
});

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(
  [
    def("rat1", "Крыса", "rat1", 1, 26, 4, 96, 26, { aggroRadius: 170, radius: 14 }),
    def("rat2", "Чумная крыса", "rat2", 3, 44, 7, 104, 26, { radius: 14 }),

    def("slime1", "Слизень", "slime1", 2, 46, 6, 48, 28, { attackCooldownMs: 1700 }),
    def("slime2", "Кислотный слизень", "slime2", 4, 78, 10, 54, 28, { attackCooldownMs: 1700 }),

    def("plant1", "Хищный цветок", "plant1", 3, 70, 11, 0, 46, { aggroRadius: 110, leashRadius: 0 }),
    def("plant2", "Ядовитый цветок", "plant2", 6, 120, 16, 0, 52, { aggroRadius: 120, leashRadius: 0 }),

    def("imp1", "Бес", "imp1", 4, 58, 9, 118, 30),
    def("imp2", "Бес-поджигатель", "imp2", 6, 86, 13, 122, 30),
    def("imp3", "Старший бес", "imp3", 8, 122, 17, 126, 32),

    def("zombie1", "Зомби", "zombie1", 5, 105, 12, 52, 30, { attackCooldownMs: 1800 }),
    def("zombie2", "Гниющий зомби", "zombie2", 7, 150, 16, 56, 30, { attackCooldownMs: 1800 }),

    def("orc1", "Орк", "orc1", 6, 120, 15, 88, 34),
    def("orc2", "Орк-берсерк", "orc2", 8, 168, 20, 96, 34, { attackCooldownMs: 1200 }),
    def("orc3", "Вождь орков", "orc3", 11, 260, 27, 92, 38, { xp: 240 }),

    def("lizardman1", "Ящер", "lizardman1", 9, 190, 22, 104, 36),
    def("lizardman2", "Ящер-воин", "lizardman2", 12, 265, 29, 108, 38),

    def("vampires1", "Вампир", "vampires1", 13, 290, 33, 116, 36, { aggroRadius: 280 }),
    def("vampires2", "Старший вампир", "vampires2", 16, 380, 41, 120, 38, { aggroRadius: 300 }),

    def("beholder1", "Созерцатель", "beholder1", 14, 300, 30, 70, 190, {
      aggroRadius: 320,
      attackCooldownMs: 2000,
    }),
    def("beholder2", "Багровый созерцатель", "beholder2", 17, 400, 38, 72, 210, {
      aggroRadius: 340,
      attackCooldownMs: 2000,
    }),
    def("beholder3", "Древний созерцатель", "beholder3", 20, 520, 47, 74, 230, {
      aggroRadius: 360,
      attackCooldownMs: 1900,
    }),

    def("ent1", "Энт", "ent1", 18, 620, 44, 58, 62, {
      attackCooldownMs: 2200,
      radius: 22,
      leashRadius: 380,
    }),
    def("ent2", "Древний энт", "ent2", 21, 820, 54, 60, 66, {
      attackCooldownMs: 2200,
      radius: 22,
      leashRadius: 380,
    }),

    def("demon1", "Демон", "demon1", 22, 900, 58, 96, 58, { radius: 20, aggroRadius: 300 }),
    def("demon2", "Высший демон", "demon2", 25, 1150, 68, 100, 60, { radius: 20, aggroRadius: 320 }),
    def("demon3", "Владыка бездны", "demon3", 28, 1600, 82, 104, 64, {
      radius: 22,
      aggroRadius: 360,
      xp: 2400,
    }),
  ].map((m) => [m.id, m]),
);

/**
 * Spawn zones are placed in tile coordinates, ordered roughly by distance from
 * the central plaza so difficulty rises as you walk outwards. The nearest zone
 * sits well outside SAFE_ZONE_RADIUS, giving a fresh character a quiet start.
 */
export interface SpawnZone {
  id: string;
  monsters: string[];
  /** Centre in tiles. */
  tx: number;
  ty: number;
  /** Radius in tiles. */
  radius: number;
  count: number;
}

export const SPAWN_ZONES: SpawnZone[] = [
  // Inner ring — the first thing a level 1 character meets, just outside SAFE_ZONE_RADIUS.
  { id: "meadow", monsters: ["rat1", "slime1"], tx: 32, ty: 48, radius: 5, count: 10 },
  { id: "glade", monsters: ["rat2", "slime2"], tx: 16, ty: 32, radius: 5, count: 10 },
  { id: "ruins", monsters: ["zombie1", "plant1"], tx: 32, ty: 16, radius: 5, count: 10 },
  { id: "ashfield", monsters: ["imp1", "imp2"], tx: 48, ty: 32, radius: 5, count: 10 },

  // Middle ring — the diagonals, roughly levels 5 to 18.
  { id: "warcamp", monsters: ["orc1", "orc2", "orc3", "zombie2"], tx: 16, ty: 48, radius: 6, count: 11 },
  { id: "swamp", monsters: ["lizardman1", "lizardman2", "plant2"], tx: 48, ty: 48, radius: 6, count: 10 },
  { id: "crypt", monsters: ["vampires1", "imp3"], tx: 16, ty: 16, radius: 6, count: 9 },
  { id: "grove", monsters: ["ent1", "ent2", "beholder1"], tx: 48, ty: 16, radius: 6, count: 8 },

  // Corners — end-game packs.
  { id: "peaks", monsters: ["beholder2", "beholder3", "vampires2"], tx: 56, ty: 8, radius: 4, count: 7 },
  { id: "abyss", monsters: ["demon1", "demon2", "demon3"], tx: 8, ty: 56, radius: 4, count: 7 },
];

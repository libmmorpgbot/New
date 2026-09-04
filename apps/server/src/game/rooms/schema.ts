import { Schema, MapSchema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") cls = "mage";

  @type("float32") x = 0;
  @type("float32") y = 0;
  /** Index into DIRECTIONS_8. */
  @type("uint8") dir = 0;
  /** One of HERO_ACTIONS. */
  @type("string") action = "idle";

  @type("uint16") hp = 0;
  @type("uint16") maxHp = 0;
  @type("uint16") mp = 0;
  @type("uint16") maxMp = 0;
  @type("uint16") shield = 0;

  @type("uint16") level = 1;
  @type("uint32") xp = 0;
  @type("uint32") xpToNext = 0;
  @type("uint32") gold = 0;

  /** Last input sequence the server has applied — the client reconciles against this. */
  @type("uint32") lastSeq = 0;
  @type("boolean") dead = false;
}

export class MonsterState extends Schema {
  @type("string") id = "";
  /** Key into the shared MONSTERS catalog. */
  @type("string") kind = "";

  @type("float32") x = 0;
  @type("float32") y = 0;
  /** Index into DIRECTIONS_4. */
  @type("uint8") dir = 0;
  /** One of MONSTER_ACTIONS. */
  @type("string") action = "idle";

  @type("uint16") hp = 0;
  @type("uint16") maxHp = 0;
  @type("uint8") level = 1;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: MonsterState }) monsters = new MapSchema<MonsterState>();
  @type("uint32") tick = 0;
}

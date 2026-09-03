import { Bot, InlineKeyboard } from "grammy";
import { CLASSES, CLASS_IDS } from "@tg-mmo/shared";

/**
 * The bot lives in the same process as the game and the API. It uses long
 * polling, so it needs no port of its own and no public route.
 */
export function createBot(token: string, webAppUrl: string): Bot {
  const bot = new Bot(token);
  const playKeyboard = new InlineKeyboard().webApp("⚔️ Играть", webAppUrl);

  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name ?? "путник";
    await ctx.reply(
      `Привет, ${name}!\n\n` +
        "Ashen Realms — 2D MMORPG прямо в Telegram. Выбери класс, выйди с площади " +
        "и зачисти окрестности. Чем дальше от центра — тем опаснее.\n\n" +
        "Жми кнопку ниже, чтобы начать.",
      { reply_markup: playKeyboard },
    );
  });

  bot.command("play", (ctx) => ctx.reply("Мир ждёт.", { reply_markup: playKeyboard }));

  bot.command("classes", (ctx) =>
    ctx.reply(
      CLASS_IDS.map((id) => {
        const cls = CLASSES[id];
        return `*${cls.name}* — ${cls.blurb}\nHP ${cls.stats.maxHp} · MP ${cls.stats.maxMp} · урон ${cls.stats.attackDamage}`;
      }).join("\n\n"),
      { parse_mode: "Markdown" },
    ),
  );

  bot.command("help", (ctx) =>
    ctx.reply(
      "/play — открыть игру\n/classes — описание классов\n\n" +
        "Управление: джойстик слева, кнопка удара справа, четыре умения рядом с ней. " +
        "На десктопе — WASD, пробел и клавиши 1–4.",
    ),
  );

  bot.catch((err) => console.error("[bot] error", err.error));

  return bot;
}

/** Registers the command list and starts long polling. */
export async function startBot(token: string, webAppUrl: string): Promise<Bot> {
  const bot = createBot(token, webAppUrl);

  await bot.api.setMyCommands([
    { command: "play", description: "Открыть игру" },
    { command: "classes", description: "Классы персонажей" },
    { command: "help", description: "Помощь" },
  ]);

  // `bot.start()` settles only when polling stops, so it is deliberately not awaited.
  void bot.start({ onStart: () => console.log("[bot] polling started") });

  return bot;
}

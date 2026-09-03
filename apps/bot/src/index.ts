import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";
import { z } from "zod";
import { CLASSES, CLASS_IDS } from "@tg-mmo/shared";

const Env = z.object({
  BOT_TOKEN: z.string().min(10, "BOT_TOKEN обязателен — возьми его у @BotFather"),
  /** Public HTTPS URL of the Mini App. Telegram refuses plain http. */
  WEBAPP_URL: z.string().url(),
});

const env = Env.parse(process.env);
const bot = new Bot(env.BOT_TOKEN);

const playKeyboard = new InlineKeyboard().webApp("⚔️ Играть", env.WEBAPP_URL);

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

await bot.api.setMyCommands([
  { command: "play", description: "Открыть игру" },
  { command: "classes", description: "Классы персонажей" },
  { command: "help", description: "Помощь" },
]);

console.log("[bot] polling started");
await bot.start();

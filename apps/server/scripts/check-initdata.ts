/**
 * Exercises the initData validator against locally signed payloads and the
 * obvious forgeries. Run with `pnpm --filter @tg-mmo/server check:initdata`.
 *
 * The realistic case matters: a modern client sends `signature`, `query_id`
 * and `chat_instance` alongside the fields a minimal test would use, and
 * Telegram hashes every one of them except `hash`.
 */
import { createHmac } from "node:crypto";
import { verifyInitData } from "../src/auth/telegram";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-LOCAL-CHECKS";
const TTL = 3600;

/** Signs exactly the way Telegram does: every field except `hash`, sorted, LF-joined. */
function sign(fields: Record<string, string>, token = BOT_TOKEN): string {
  const checkString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const params = new URLSearchParams(fields);
  params.set("hash", createHmac("sha256", secret).update(checkString).digest("hex"));
  return params.toString();
}

const now = Math.floor(Date.now() / 1000);
const user = JSON.stringify({ id: 42, first_name: "Тест", username: "tester", language_code: "ru" });

/** What a current Telegram client actually sends. */
const realistic = {
  query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
  user,
  auth_date: String(now),
  chat_instance: "-3788475317572404878",
  chat_type: "sender",
  signature: "1SkOFvFHRsFRPfnCiG7-oaObeCcU0LCkLTFtuRTVUJKa5GCLl9Uk8ELPGXpXtXhVBg2hAiRuTfSMhFcbGYQmDQ",
};

let failures = 0;
const check = (name: string, fn: () => void, shouldThrow: boolean) => {
  let threw = false;
  let reason = "";
  try {
    fn();
  } catch (err) {
    threw = true;
    reason = err instanceof Error ? err.message : String(err);
  }
  const ok = threw === shouldThrow;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && threw ? ` — ${reason}` : ""}`);
};

check(
  "minimal payload is accepted",
  () => {
    const result = verifyInitData(sign({ auth_date: String(now), user }), BOT_TOKEN, TTL);
    if (result.user.id !== 42) throw new Error("wrong user");
  },
  false,
);

check(
  "realistic payload with signature/query_id/chat_instance is accepted",
  () => {
    const result = verifyInitData(sign(realistic), BOT_TOKEN, TTL);
    if (result.user.id !== 42) throw new Error("wrong user");
  },
  false,
);

check(
  "tampered user is rejected",
  () => {
    const good = sign(realistic);
    verifyInitData(good.replace(encodeURIComponent("Тест"), encodeURIComponent("Взлом")), BOT_TOKEN, TTL);
  },
  true,
);

check(
  "tampered signature field is rejected",
  () => verifyInitData(sign(realistic).replace("1SkOFv", "0SkOFv"), BOT_TOKEN, TTL),
  true,
);

check(
  "signature from another bot token is rejected",
  () => verifyInitData(sign(realistic, "999:OTHER"), BOT_TOKEN, TTL),
  true,
);

check(
  "stale auth_date is rejected",
  () => verifyInitData(sign({ ...realistic, auth_date: String(now - TTL - 60) }), BOT_TOKEN, TTL),
  true,
);

check("missing hash is rejected", () => verifyInitData(`auth_date=${now}&user=x`, BOT_TOKEN, TTL), true);

console.log(failures === 0 ? "\ninitData validation ok" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

/**
 * Exercises the initData validator against a locally signed payload and the
 * obvious forgeries. Run with `pnpm --filter @tg-mmo/api check:initdata`.
 */
import { createHmac } from "node:crypto";
import { verifyInitData } from "../src/auth/telegram";

const BOT_TOKEN = "123456:TEST-TOKEN-FOR-LOCAL-CHECKS";
const TTL = 3600;

function sign(fields: Record<string, string>, token = BOT_TOKEN): string {
  const checkString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  const params = new URLSearchParams(fields);
  params.set("hash", hash);
  return params.toString();
}

const now = Math.floor(Date.now() / 1000);
const user = JSON.stringify({ id: 42, first_name: "Тест", username: "tester" });

let failures = 0;
const check = (name: string, fn: () => void, shouldThrow: boolean) => {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  const ok = threw === shouldThrow;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
};

check(
  "valid payload is accepted",
  () => {
    const result = verifyInitData(sign({ auth_date: String(now), user }), BOT_TOKEN, TTL);
    if (result.user.id !== 42) throw new Error("wrong user");
  },
  false,
);

check(
  "tampered user is rejected",
  () => {
    const good = sign({ auth_date: String(now), user });
    const forged = good.replace(encodeURIComponent("Тест"), encodeURIComponent("Взлом"));
    verifyInitData(forged, BOT_TOKEN, TTL);
  },
  true,
);

check(
  "signature from another bot token is rejected",
  () => verifyInitData(sign({ auth_date: String(now), user }, "999:OTHER"), BOT_TOKEN, TTL),
  true,
);

check(
  "stale auth_date is rejected",
  () => verifyInitData(sign({ auth_date: String(now - TTL - 60), user }), BOT_TOKEN, TTL),
  true,
);

check("missing hash is rejected", () => verifyInitData(`auth_date=${now}&user=x`, BOT_TOKEN, TTL), true);

console.log(failures === 0 ? "\ninitData validation ok" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

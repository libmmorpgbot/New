import { CLASSES, type ClassId } from "@tg-mmo/shared";
import { useGame } from "../../store";
import { getRoom } from "../../net/net";
import { telegramDisplayName, tg } from "../../telegram";
import Portrait from "../Portrait";
import Panel, { Row, Section } from "./Panel";

export default function ProfilePanel() {
  const hud = useGame((s) => s.hud);
  const cls = useGame((s) => s.cls) as ClassId;
  const user = tg()?.initDataUnsafe?.user;
  const room = getRoom();

  return (
    <Panel title="Профиль">
      <Section title="Аккаунт">
        <div className="mb-2 flex items-center gap-3">
          <Portrait cls={cls} level={hud.level} size={54} />
          <div>
            <p className="text-[14px] font-semibold">{hud.name || telegramDisplayName()}</p>
            <p className="text-[11px] text-[color:var(--muted)]">
              {user?.username ? `@${user.username}` : "вход не через Telegram"}
            </p>
          </div>
        </div>
        <Row label="Класс" value={CLASSES[cls].name} />
        <Row label="Уровень" value={hud.level} />
        <Row label="Золото" value={<span className="gold-text">{hud.gold}</span>} />
      </Section>

      <Section title="Соединение">
        <Row label="Сессия" value={room?.sessionId ?? "—"} />
        <Row label="Игроков в мире" value={room?.state?.players?.size ?? 0} />
        <Row label="Монстров в мире" value={room?.state?.monsters?.size ?? 0} />
      </Section>

      <button
        className="interactive panel bevel w-full py-2.5 text-[13px] font-semibold"
        onPointerDown={(e) => {
          e.preventDefault();
          // Class is picked before the socket opens, so a fresh start is the honest way to switch.
          window.location.reload();
        }}
      >
        Сменить класс
      </button>
      <p className="mt-1.5 px-2 text-center text-[10px] leading-relaxed text-[color:var(--muted)]">
        Прогресс каждого класса хранится отдельно и не потеряется.
      </p>
    </Panel>
  );
}

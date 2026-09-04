import { useGame } from "../store";
import { sendRespawn } from "../net/net";

export default function DeathOverlay() {
  const dead = useGame((s) => s.hud.dead);
  if (!dead) return null;

  return (
    <div className="absolute inset-0 grid place-items-center bg-[rgba(30,4,8,.55)] backdrop-blur-[2px]">
      <div className="text-center">
        <p className="mb-1 text-[28px] font-bold tracking-tight text-[#ff9a9a] drop-shadow-[0_0_12px_rgba(255,90,90,.6)]">
          Ты пал
        </p>
        <p className="mb-5 text-[11px] text-[color:var(--muted)]">
          Возрождение на площади через несколько секунд.
        </p>
        <button
          className="interactive panel bevel px-6 py-2.5 text-[13px] font-semibold"
          onPointerDown={(e) => {
            e.preventDefault();
            sendRespawn();
          }}
        >
          Возродиться сейчас
        </button>
      </div>
    </div>
  );
}

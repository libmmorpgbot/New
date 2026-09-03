import { useGame } from "../store";
import { sendRespawn } from "../net/net";

export default function DeathOverlay() {
  const dead = useGame((s) => s.hud.dead);
  if (!dead) return null;

  return (
    <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[1px]">
      <div className="text-center">
        <p className="mb-1 text-2xl font-semibold tracking-tight text-rose-300">Ты пал</p>
        <p className="mb-5 text-xs text-slate-400">Возрождение на площади через несколько секунд.</p>
        <button
          className="interactive rounded-lg bg-slate-800 px-5 py-2 text-sm text-slate-100 active:bg-slate-700"
          onClick={() => sendRespawn()}
        >
          Возродиться сейчас
        </button>
      </div>
    </div>
  );
}

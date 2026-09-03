import { useCallback } from "react";
import { CLASSES, type ClassId } from "@tg-mmo/shared";
import { useGame } from "../store";
import { login } from "../auth";
import { connect } from "../net/net";
import { loadManifest } from "../game/assets";
import { loadServerInfo } from "../config";
import { startPhaser } from "../game/PhaserGame";
import ClassSelect from "./ClassSelect";
import Hud from "./Hud";
import SkillBar from "./SkillBar";
import Joystick from "./Joystick";
import Chat from "./Chat";
import DeathOverlay from "./DeathOverlay";

export default function App() {
  const phase = useGame((s) => s.phase);
  const error = useGame((s) => s.error);

  const start = useCallback(async (cls: ClassId) => {
    const store = useGame.getState();
    store.setClass(cls);
    store.setPhase("connecting");

    try {
      // The server decides whether a dev login is allowed, so ask before logging in.
      await loadServerInfo();
      const [session] = await Promise.all([login(), loadManifest()]);
      await connect(session.token, cls);
      startPhaser();
      store.setPhase("playing");
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Не удалось подключиться");
    }
  }, []);

  if (phase === "menu") return <ClassSelect onPick={start} />;

  if (phase === "connecting") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#0b0f16]">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
          <p className="text-sm text-slate-400">Подключаемся к миру…</p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="interactive absolute inset-0 grid place-items-center bg-[#0b0f16] px-8">
        <div className="max-w-sm text-center">
          <p className="mb-4 text-sm text-rose-300">{error}</p>
          <button
            className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-100 active:bg-slate-700"
            onClick={() => window.location.reload()}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Hud />
      <Chat />
      <Joystick />
      <SkillBar skills={CLASSES[useGame.getState().cls].skills} />
      <DeathOverlay />
    </>
  );
}

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
import Minimap from "./Minimap";
import SideMenu from "./SideMenu";
import SkillRing from "./SkillRing";
import Joystick from "./Joystick";
import Chat from "./Chat";
import BottomTabs from "./BottomTabs";
import TargetFrame from "./TargetFrame";
import DeathOverlay from "./DeathOverlay";
import PanelHost from "./panels/PanelHost";

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[color:var(--ink)] px-8">
      <div className="max-w-sm text-center">{children}</div>
    </div>
  );
}

export default function App() {
  const phase = useGame((s) => s.phase);
  const error = useGame((s) => s.error);
  const cls = useGame((s) => s.cls) as ClassId;

  const start = useCallback(async (picked: ClassId) => {
    const store = useGame.getState();
    store.setClass(picked);
    store.setPhase("connecting");

    try {
      // The server decides whether a dev login is allowed, so ask before logging in.
      await loadServerInfo();
      const [session] = await Promise.all([login(), loadManifest()]);
      await connect(session.token, picked);
      startPhaser();
      store.setPhase("playing");
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Не удалось подключиться");
    }
  }, []);

  if (phase === "menu") return <ClassSelect onPick={start} />;

  if (phase === "connecting") {
    return (
      <Splash>
        <div className="portrait-ring mx-auto mb-4 size-11 animate-spin p-[3px]">
          <div className="size-full rounded-full bg-[color:var(--ink)]" />
        </div>
        <p className="text-[13px] text-[color:var(--muted)]">Входим в Пустоши…</p>
      </Splash>
    );
  }

  if (phase === "error") {
    return (
      <Splash>
        <p className="mb-4 text-[13px] leading-relaxed text-[#f0a0a0]">{error}</p>
        <button
          className="interactive panel bevel px-6 py-2.5 text-[13px] font-semibold"
          onPointerDown={() => window.location.reload()}
        >
          Попробовать снова
        </button>
      </Splash>
    );
  }

  return (
    <>
      <Hud />
      <div className="absolute right-2 top-[calc(var(--safe-top)+0.5rem)]">
        <Minimap />
      </div>
      <TargetFrame />
      <SideMenu />
      <Joystick />
      <SkillRing skills={CLASSES[cls].skills} />
      <Chat />
      <BottomTabs />
      <DeathOverlay />
      <PanelHost />
    </>
  );
}

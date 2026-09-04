import type { PanelId } from "../store";
import { useGame } from "../store";

const TABS: { id: PanelId | null; label: string; icon: string }[] = [
  { id: null, label: "Игра", icon: "⚔" },
  { id: "character", label: "Персонаж", icon: "🛡" },
  { id: "map", label: "Карта", icon: "🗺" },
  { id: "quests", label: "Квесты", icon: "📜" },
  { id: "clans", label: "Кланы", icon: "⚑" },
  { id: "profile", label: "Профиль", icon: "👤" },
];

export default function BottomTabs() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);

  return (
    <div className="panel-flat absolute inset-x-0 bottom-0 flex items-stretch pb-[var(--safe-bottom)]">
      {TABS.map((tab) => {
        const active = panel === tab.id;
        return (
          <button
            key={tab.label}
            className="interactive relative flex flex-1 flex-col items-center gap-0.5 py-1.5"
            onPointerDown={(e) => {
              e.preventDefault();
              setPanel(tab.id);
            }}
          >
            {active && (
              <span className="absolute inset-x-1 inset-y-0.5 bevel bg-[linear-gradient(180deg,rgba(75,140,230,.55),rgba(20,50,100,.35))]" />
            )}
            <span
              className={`relative text-[15px] leading-none ${active ? "" : "opacity-70"}`}
              style={{ filter: active ? "drop-shadow(0 0 6px rgba(120,200,255,.8))" : undefined }}
            >
              {tab.icon}
            </span>
            <span
              className={`relative text-[9px] font-semibold uppercase tracking-wide ${
                active ? "text-white" : "text-[color:var(--muted)]"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

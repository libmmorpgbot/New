import type { PanelId } from "../store";
import { useGame } from "../store";

interface Entry {
  id: PanelId;
  label: string;
  icon: string;
  tint: string;
}

const ENTRIES: Entry[] = [
  { id: "menu", label: "Меню", icon: "☰", tint: "#cfe0f5" },
  { id: "character", label: "Персонаж", icon: "🛡", tint: "#6ec6f5" },
  { id: "map", label: "Карта", icon: "🗺", tint: "#7dd3a0" },
  { id: "quests", label: "Задания", icon: "📜", tint: "#e9b949" },
  { id: "clans", label: "Кланы", icon: "⚑", tint: "#c99bf0" },
  { id: "profile", label: "Профиль", icon: "👤", tint: "#9fb3cd" },
];

export default function SideMenu() {
  const setPanel = useGame((s) => s.setPanel);

  return (
    <div className="absolute right-2 top-[calc(var(--safe-top)+9.75rem)] flex w-[118px] flex-col gap-1.5">
      {ENTRIES.map((entry) => (
        <button
          key={entry.id}
          className="interactive panel bevel btn-side"
          onPointerDown={(e) => {
            e.preventDefault();
            setPanel(entry.id);
          }}
        >
          <span className="text-[15px] leading-none" style={{ color: entry.tint }}>
            {entry.icon}
          </span>
          <span>{entry.label}</span>
        </button>
      ))}
    </div>
  );
}

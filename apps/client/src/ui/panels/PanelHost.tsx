import { useGame } from "../../store";
import CharacterPanel from "./CharacterPanel";
import MapPanel from "./MapPanel";
import ProfilePanel from "./ProfilePanel";
import Panel, { NotBuilt, Row, Section } from "./Panel";

function MenuPanel() {
  return (
    <Panel title="Меню">
      <Section title="Управление">
        <Row label="Движение" value="джойстик / WASD" />
        <Row label="Атака" value="кнопка ⚔ / пробел" />
        <Row label="Умения" value="кольцо / 1–4" />
      </Section>
      <Section title="Мир">
        <Row label="Возрождение" value="на площади, автоматически" />
        <Row label="Безопасная зона" value="монстры не заходят в центр" />
      </Section>
      <button
        className="interactive panel bevel w-full py-2.5 text-[13px] font-semibold"
        onPointerDown={(e) => {
          e.preventDefault();
          window.location.reload();
        }}
      >
        Перезапустить игру
      </button>
    </Panel>
  );
}

export default function PanelHost() {
  const panel = useGame((s) => s.panel);
  if (!panel) return null;

  switch (panel) {
    case "character":
      return <CharacterPanel />;
    case "map":
      return <MapPanel />;
    case "profile":
      return <ProfilePanel />;
    case "menu":
      return <MenuPanel />;
    case "quests":
      return (
        <Panel title="Квесты">
          <NotBuilt what="Квесты" />
        </Panel>
      );
    case "clans":
      return (
        <Panel title="Кланы">
          <NotBuilt what="Кланы" />
        </Panel>
      );
  }
}

import { useState } from "react";
import { CHAT_MAX_LENGTH } from "@tg-mmo/shared";
import { sendChat } from "../net/net";
import { useGame } from "../store";

export default function Chat() {
  const messages = useGame((s) => s.chat);
  const unread = useGame((s) => s.unreadChat);
  const open = useGame((s) => s.chatOpen);
  const setOpen = useGame((s) => s.setChatOpen);
  const [draft, setDraft] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text) sendChat(text);
    setDraft("");
  };

  const last = messages[messages.length - 1];

  return (
    <div
      className="absolute left-3 flex items-end gap-2"
      style={{ bottom: `calc(var(--safe-bottom) + 176px)` }}
    >
      <button
        className="interactive btn-round relative size-11 shrink-0"
        onPointerDown={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        aria-label="Чат"
      >
        <span className="text-[17px] leading-none">💬</span>
        {unread > 0 && !open && (
          <span className="absolute -right-0.5 -top-0.5 grid size-[18px] place-items-center rounded-full bg-[#d8483f] text-[10px] font-bold text-white ring-1 ring-black/60">
            {unread}
          </span>
        )}
      </button>

      {/* Collapsed, only the latest line shows — the map stays readable. */}
      {!open && last && (
        <div className="panel-flat bevel max-w-[190px] px-2.5 py-1">
          <p className="truncate text-[11px] leading-tight">
            <span className="text-[#7dd3a0]">{last.from}:</span>{" "}
            <span className="text-[color:var(--text)]">{last.text}</span>
          </p>
        </div>
      )}

      {open && (
        <div className="panel bevel interactive w-[236px] p-2">
          <div className="mb-1.5 max-h-28 space-y-0.5 overflow-y-auto text-[11px] leading-snug">
            {messages.length === 0 && (
              <p className="text-[color:var(--muted)]">Пока тихо. Напиши первым.</p>
            )}
            {messages.slice(-8).map((m, i) => (
              <p key={`${m.at}-${i}`}>
                <span className="text-[#7dd3a0]">{m.from}:</span>{" "}
                <span className="text-[color:var(--text)]">{m.text}</span>
              </p>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-1.5">
            <input
              autoFocus
              value={draft}
              maxLength={CHAT_MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Сообщение…"
              className="bar min-w-0 flex-1 rounded-[3px] px-2 py-1 text-[11px] text-white outline-none"
            />
            <button className="btn-round size-7 text-[12px]">↵</button>
          </form>
        </div>
      )}
    </div>
  );
}

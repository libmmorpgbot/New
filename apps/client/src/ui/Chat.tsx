import { useState } from "react";
import { CHAT_MAX_LENGTH } from "@tg-mmo/shared";
import { sendChat } from "../net/net";
import { useGame } from "../store";

export default function Chat() {
  const messages = useGame((s) => s.chat);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text) sendChat(text);
    setDraft("");
    setOpen(false);
  };

  return (
    <div className="absolute right-3 top-[calc(var(--safe-top)+0.75rem)] flex w-52 flex-col items-end gap-1.5">
      <button
        className="interactive rounded-md bg-slate-900/70 px-2.5 py-1 text-xs text-slate-300 active:bg-slate-800"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Закрыть" : "Чат"}
      </button>

      {messages.length > 0 && (
        <div className="max-h-32 w-full overflow-hidden rounded-md bg-black/35 px-2 py-1.5 text-[11px] leading-snug">
          {messages.slice(-6).map((m, i) => (
            <p key={`${m.at}-${i}`} className="truncate">
              <span className="text-emerald-300">{m.from}:</span>{" "}
              <span className="text-slate-200">{m.text}</span>
            </p>
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="interactive flex w-full gap-1.5">
          <input
            autoFocus
            value={draft}
            maxLength={CHAT_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Сообщение…"
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-600"
          />
          <button className="rounded-md bg-emerald-700/80 px-2.5 text-xs text-white active:bg-emerald-600">
            ↵
          </button>
        </form>
      )}
    </div>
  );
}

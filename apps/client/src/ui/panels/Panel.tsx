import type { ReactNode } from "react";
import { useGame } from "../../store";

/** Shared shell: dimmed world behind, bevelled frame, one way out. */
export default function Panel({ title, children }: { title: string; children: ReactNode }) {
  const setPanel = useGame((s) => s.setPanel);

  return (
    <div className="interactive absolute inset-0 flex flex-col bg-[rgba(4,8,16,.82)] backdrop-blur-[2px]">
      <div className="flex items-center justify-between px-3 pb-2 pt-[calc(var(--safe-top)+0.75rem)]">
        <h2 className="text-[15px] font-semibold glow-text">{title}</h2>
        <button
          className="btn-round size-8 text-[15px]"
          onPointerDown={(e) => {
            e.preventDefault();
            setPanel(null);
          }}
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-[calc(var(--safe-bottom)+56px)]">{children}</div>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1.5 text-[12px] last:border-0">
      <span className="text-[color:var(--muted)]">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel bevel mb-2.5 p-3">
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7fb4e8]">{title}</h3>
      {children}
    </section>
  );
}

/** Used where a tab exists in the layout but the feature genuinely does not yet. */
export function NotBuilt({ what }: { what: string }) {
  return (
    <div className="grid h-full place-items-center px-8 text-center">
      <div>
        <p className="mb-1.5 text-[13px] font-semibold">{what} ещё не сделаны</p>
        <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
          Раздел есть в интерфейсе, но за ним пока нет игровой механики.
          Показывать здесь выдуманные данные было бы враньём.
        </p>
      </div>
    </div>
  );
}

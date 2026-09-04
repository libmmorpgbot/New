import { useCallback, useRef, useState } from "react";
import { setMove } from "../input/inputState";

const RING = 104;
const KNOB = 42;
const REACH = (RING - KNOB) / 2;

/**
 * A fixed stick rather than a floating one: it is always on screen where the
 * thumb expects it, and the arrow marks make the walkable directions obvious.
 * Dragging anywhere inside the ring still works, so precision is not lost.
 */
export default function Joystick() {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = useCallback((clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;

    setKnob({ x: nx * Math.min(len, REACH), y: ny * Math.min(len, REACH) });
    // Below the dead zone the character stands still instead of creeping.
    const live = len < 10 ? 0 : 1;
    setMove(nx * live, ny * live);
  }, []);

  const release = useCallback((e: React.PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    setMove(0, 0);
  }, []);

  return (
    <div
      ref={ref}
      className="interactive absolute touch-none"
      style={{ left: 16, bottom: `calc(var(--safe-bottom) + 62px)`, width: RING, height: RING }}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        ref.current?.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="btn-round absolute inset-0">
        {/* Direction marks at the cardinals, the way a console D-pad reads. */}
        {[
          { rot: 0, top: 6, left: "50%" },
          { rot: 90, top: "50%", left: RING - 14 },
          { rot: 180, top: RING - 14, left: "50%" },
          { rot: 270, top: "50%", left: 6 },
        ].map((mark, i) => (
          <span
            key={i}
            className="absolute text-[13px] leading-none text-[#8fc4ff]"
            style={{
              top: mark.top,
              left: mark.left,
              transform: `translate(-50%,-50%) rotate(${mark.rot}deg)`,
            }}
          >
            ▲
          </span>
        ))}
      </div>

      <div
        className="pointer-events-none absolute rounded-full border border-[color:var(--rim)] bg-[radial-gradient(circle_at_40%_30%,#4a80c8,#0a1526)] shadow-[0_0_12px_rgba(75,180,255,.45)]"
        style={{
          width: KNOB,
          height: KNOB,
          left: RING / 2 - KNOB / 2 + knob.x,
          top: RING / 2 - KNOB / 2 + knob.y,
        }}
      />
    </div>
  );
}

import { useCallback, useRef, useState } from "react";
import { setMove } from "../input/inputState";

const BASE_RADIUS = 58;
const KNOB_RADIUS = 26;

/**
 * Floating joystick: the base appears wherever the thumb lands inside the pad,
 * which is far more forgiving on a phone than a fixed stick.
 */
export default function Joystick() {
  const padRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [base, setBase] = useState({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - origin.current.x;
    const dy = clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, BASE_RADIUS);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;

    setKnob({ x: nx * clamped, y: ny * clamped });
    // Below the dead zone the character should stand still, not creep.
    const strength = len < 12 ? 0 : 1;
    setMove(nx * strength, ny * strength);
  }, []);

  const onDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerId.current !== null) return;
      pointerId.current = e.pointerId;
      padRef.current?.setPointerCapture(e.pointerId);

      const rect = padRef.current!.getBoundingClientRect();
      origin.current = { x: e.clientX, y: e.clientY };
      setBase({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setKnob({ x: 0, y: 0 });
      setVisible(true);
      update(e.clientX, e.clientY);
    },
    [update],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerId.current !== e.pointerId) return;
      update(e.clientX, e.clientY);
    },
    [update],
  );

  const onUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setVisible(false);
    setMove(0, 0);
  }, []);

  return (
    <div
      ref={padRef}
      className="interactive absolute bottom-0 left-0 h-1/2 w-1/2 touch-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {visible && (
        <>
          <div
            className="pointer-events-none absolute rounded-full border border-slate-500/40 bg-slate-900/30"
            style={{
              width: BASE_RADIUS * 2,
              height: BASE_RADIUS * 2,
              left: base.x - BASE_RADIUS,
              top: base.y - BASE_RADIUS,
            }}
          />
          <div
            className="pointer-events-none absolute rounded-full bg-slate-200/70"
            style={{
              width: KNOB_RADIUS * 2,
              height: KNOB_RADIUS * 2,
              left: base.x + knob.x - KNOB_RADIUS,
              top: base.y + knob.y - KNOB_RADIUS,
            }}
          />
        </>
      )}
    </div>
  );
}

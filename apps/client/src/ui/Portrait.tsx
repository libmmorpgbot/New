import type { ClassId } from "@tg-mmo/shared";

/** First idle frame of the hero sheet, cropped by CSS — no separate portrait art needed. */
const SHEET: Record<ClassId, string> = {
  mage: "assets/sprites/heroes/mage/down-idle.png",
  ranger: "assets/sprites/heroes/ranger/down-idle.png",
  deathknight: "assets/sprites/heroes/deathknight/down-idle.png",
};

const SHEET_W = 1920;
const SHEET_H = 128;
/** The drawn character sits in this box of frame 0; anything else is empty margin. */
const CROP = { x: 21, y: 38, size: 72 };

export default function Portrait({
  cls,
  level,
  size = 64,
}: {
  cls: ClassId;
  level?: number;
  size?: number;
}) {
  // Blow the sheet up so the crop box exactly fills the circle.
  const scale = size / CROP.size;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="portrait-ring absolute inset-0 p-[3px]">
        <div
          className="size-full overflow-hidden rounded-full bg-[#0a1220]"
          style={{
            backgroundImage: `url(${SHEET[cls]})`,
            backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
            backgroundPosition: `${-CROP.x * scale}px ${-CROP.y * scale}px`,
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
          }}
        />
      </div>

      {level !== undefined && (
        <span
          className="portrait-ring absolute grid place-items-center rounded-full font-bold text-[#3a2a06]"
          style={{
            width: size * 0.42,
            height: size * 0.42,
            left: -1,
            bottom: -1,
            fontSize: Math.max(10, size * 0.19),
          }}
        >
          {level}
        </span>
      )}
    </div>
  );
}

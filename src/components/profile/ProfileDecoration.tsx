// Discord-style avatar decorations: emoji/SVG overlays positioned around the
// avatar (top hat, halo, crown, headphones, wings, etc.). Pure CSS, scales
// with the avatar size.
import { ReactNode } from "react";

export type DecorationId =
  | "none"
  | "top_hat"
  | "halo"
  | "crown"
  | "devil_horns"
  | "headphones"
  | "flower_crown"
  | "wings"
  | "snowflake"
  | "santa"
  | "party"
  | "ninja"
  | "witch"
  | "neon_ring"
  | "pumpkin"
  | "cyber_visor"
  | "bunny_ears";

type DecoDef = {
  id: DecorationId;
  label: string;
  /** preview emoji (used in picker tile) */
  preview: string;
  /** custom renderer that takes avatar size in px */
  render?: (size: number) => ReactNode;
  /** simple overlay: emoji on top */
  topEmoji?: string;
  /** scale relative to avatar */
  topScale?: number;
  /** translate as fraction of size */
  topOffsetX?: number; // -0.5..0.5
  topOffsetY?: number; // -0.5..0.5
  /** rotation degrees */
  topRotate?: number;
  /** also draw an emoji at the bottom */
  bottomEmoji?: string;
  bottomScale?: number;
};

export const PROFILE_DECORATIONS: DecoDef[] = [
  { id: "none",          label: "None",         preview: "—" },
  { id: "top_hat",       label: "Top hat",      preview: "🎩", topEmoji: "🎩", topScale: 0.85, topOffsetY: -0.55, topRotate: -8 },
  { id: "halo",          label: "Halo",         preview: "😇" },
  { id: "crown",         label: "Crown",        preview: "👑", topEmoji: "👑", topScale: 0.8,  topOffsetY: -0.5 },
  { id: "devil_horns",   label: "Devil horns",  preview: "😈", topEmoji: "😈", topScale: 0.6,  topOffsetY: -0.55 },
  { id: "headphones",    label: "Headphones",   preview: "🎧", topEmoji: "🎧", topScale: 1.05, topOffsetY: -0.05 },
  { id: "flower_crown",  label: "Flower crown", preview: "🌸", topEmoji: "🌸🌼🌷", topScale: 0.55, topOffsetY: -0.5 },
  { id: "wings",         label: "Angel wings",  preview: "🪽" },
  { id: "snowflake",     label: "Frost",        preview: "❄️", topEmoji: "❄️",  topScale: 0.55, topOffsetY: -0.55, topOffsetX: 0.4 },
  { id: "santa",         label: "Santa",        preview: "🎅", topEmoji: "🎅", topScale: 0.7,  topOffsetY: -0.55 },
  { id: "party",         label: "Party",        preview: "🥳", topEmoji: "🎉", topScale: 0.55, topOffsetY: -0.5, topOffsetX: -0.35, topRotate: -20 },
  { id: "ninja",         label: "Ninja",        preview: "🥷", topEmoji: "🥷", topScale: 0.5,  topOffsetY: -0.55 },
  { id: "witch",         label: "Witch hat",    preview: "🧙", topEmoji: "🧙‍♀️", topScale: 0.7,  topOffsetY: -0.55, topRotate: -10 },
  { id: "neon_ring",     label: "Neon",         preview: "💠" },
  { id: "pumpkin",       label: "Pumpkin",      preview: "🎃", topEmoji: "🎃", topScale: 0.55, topOffsetY: -0.5 },
  { id: "cyber_visor",   label: "Cyber visor",  preview: "🕶️", topEmoji: "🕶️", topScale: 0.85, topOffsetY: -0.05 },
  { id: "bunny_ears",    label: "Bunny ears",   preview: "🐰", topEmoji: "🐰", topScale: 0.55, topOffsetY: -0.6 },
];

const DECO_MAP: Record<string, DecoDef> = Object.fromEntries(
  PROFILE_DECORATIONS.map((d) => [d.id, d]),
);

function Glyph({ char, size, rotate = 0 }: { char: string; size: number; rotate?: number }) {
  return (
    <span
      aria-hidden
      style={{
        fontSize: size,
        lineHeight: 1,
        transform: `rotate(${rotate}deg)`,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
        display: "inline-block",
      }}
    >
      {char}
    </span>
  );
}

/**
 * Wraps an avatar (children) with a decoration overlay.
 * The wrapper takes the same size as `size`; overlays extend outside.
 */
export function AvatarDecoration({
  id,
  size,
  children,
  className = "",
}: {
  id?: string | null;
  size: number;
  children: ReactNode;
  className?: string;
}) {
  const def = DECO_MAP[id ?? "none"] ?? DECO_MAP.none;
  if (def.id === "none") return <div className={className}>{children}</div>;

  // Specials with custom SVGs
  const specials: Record<string, ReactNode> = {
    halo: (
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ top: -size * 0.32 }}
      >
        <div
          style={{
            width: size * 1.05,
            height: size * 0.35,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, transparent 55%, #fde68a 60%, #f59e0b 70%, transparent 80%)",
            boxShadow: "0 0 20px #fde68a, 0 0 40px #f59e0baa",
          }}
        />
      </div>
    ),
    wings: (
      <>
        <span
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ left: -size * 0.55, fontSize: size * 0.85, transform: "translateY(-50%) scaleX(-1)", filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))" }}
        >🪽</span>
        <span
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ right: -size * 0.55, fontSize: size * 0.85, filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))" }}
        >🪽</span>
      </>
    ),
    neon_ring: (
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "0 0 0 2px #22d3ee, 0 0 18px #22d3ee, 0 0 36px #a78bfa88, inset 0 0 12px #22d3ee55",
          animation: "pe-holo 4s linear infinite",
        }}
      />
    ),
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
      {specials[def.id]}
      {def.topEmoji && (
        <span
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            transform: `translate(${(def.topOffsetX ?? 0) * size}px, ${(def.topOffsetY ?? -0.5) * size}px) translateX(-50%) rotate(${def.topRotate ?? 0}deg)`,
            transformOrigin: "center",
          }}
        >
          <Glyph char={def.topEmoji} size={size * (def.topScale ?? 0.7)} />
        </span>
      )}
    </div>
  );
}

export function getDecorationDef(id: string) {
  return DECO_MAP[id];
}

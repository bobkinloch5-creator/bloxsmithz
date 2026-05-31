// Discord-style avatar decorations: emoji/SVG overlays positioned around the
// avatar (top hat, halo, crown, headphones, wings, etc.). Pure CSS, scales
// with the avatar size.
import type { CSSProperties, ReactNode } from "react";

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
  | "bunny_ears"
  | "cosmic_crown"
  | "plasma_halo"
  | "royal_wings"
  | "lightning_aura"
  | "crystal_spikes"
  | "orbit"
  | "flame_aura"
  | "star_shower"
  | "glitch_frame"
  | "heart_aura"
  | "coin_crown"
  | "builder_goggles";

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
  animated?: boolean;
  premium?: boolean;
};

export const PROFILE_DECORATIONS: DecoDef[] = [
  { id: "none",          label: "None",         preview: "—" },
  { id: "cosmic_crown",  label: "Cosmic Crown", preview: "✦", premium: true, animated: true },
  { id: "plasma_halo",   label: "Plasma Halo",  preview: "◎", premium: true, animated: true },
  { id: "royal_wings",   label: "Royal Wings",  preview: "◇", premium: true, animated: true },
  { id: "orbit",         label: "Orbit",        preview: "◌", premium: true, animated: true },
  { id: "star_shower",   label: "Star Shower",  preview: "✦", premium: true, animated: true },
  { id: "glitch_frame",  label: "Glitch Frame", preview: "▣", premium: true, animated: true },
  { id: "flame_aura",    label: "Flame Aura",   preview: "▲", premium: true, animated: true },
  { id: "lightning_aura", label: "Lightning",   preview: "ϟ", premium: true, animated: true },
  { id: "crystal_spikes", label: "Crystal",     preview: "◆", premium: true },
  { id: "heart_aura",    label: "Heart Aura",   preview: "♥", premium: true, animated: true },
  { id: "coin_crown",    label: "Coin Crown",   preview: "$", premium: true, animated: true },
  { id: "builder_goggles", label: "Builder",    preview: "▤", premium: true },
  { id: "top_hat",       label: "Top hat",      preview: "🎩", topEmoji: "🎩", topScale: 0.85, topOffsetY: -0.55, topRotate: -8, animated: true },
  { id: "halo",          label: "Halo",         preview: "◎", animated: true },
  { id: "crown",         label: "Crown",        preview: "👑", topEmoji: "👑", topScale: 0.8,  topOffsetY: -0.5, animated: true },
  { id: "devil_horns",   label: "Devil horns",  preview: "😈", topEmoji: "😈", topScale: 0.6,  topOffsetY: -0.55 },
  { id: "headphones",    label: "Headphones",   preview: "🎧", topEmoji: "🎧", topScale: 1.05, topOffsetY: -0.05, animated: true },
  { id: "flower_crown",  label: "Flower crown", preview: "🌸", topEmoji: "🌸🌼🌷", topScale: 0.55, topOffsetY: -0.5 },
  { id: "wings",         label: "Angel wings",  preview: "◇", animated: true },
  { id: "snowflake",     label: "Frost",        preview: "❄️", topEmoji: "❄️",  topScale: 0.55, topOffsetY: -0.55, topOffsetX: 0.4 },
  { id: "santa",         label: "Santa",        preview: "🎅", topEmoji: "🎅", topScale: 0.7,  topOffsetY: -0.55 },
  { id: "party",         label: "Party",        preview: "🥳", topEmoji: "🎉", topScale: 0.55, topOffsetY: -0.5, topOffsetX: -0.35, topRotate: -20 },
  { id: "ninja",         label: "Ninja",        preview: "🥷", topEmoji: "🥷", topScale: 0.5,  topOffsetY: -0.55 },
  { id: "witch",         label: "Witch hat",    preview: "🧙", topEmoji: "🧙‍♀️", topScale: 0.7,  topOffsetY: -0.55, topRotate: -10 },
  { id: "neon_ring",     label: "Neon",         preview: "◎", animated: true },
  { id: "pumpkin",       label: "Pumpkin",      preview: "🎃", topEmoji: "🎃", topScale: 0.55, topOffsetY: -0.5 },
  { id: "cyber_visor",   label: "Cyber visor",  preview: "▰", topEmoji: "🕶️", topScale: 0.85, topOffsetY: -0.05, animated: true },
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

function CrownShape({ size, color = "#facc15" }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 120 74" aria-hidden>
      <path
        d="M10 58 22 22l26 24 12-36 12 36 26-24 12 36v8H10z"
        fill={`url(#crown-${Math.round(size)})`}
        stroke="rgba(255,255,255,.55)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={`crown-${Math.round(size)}`} x1="0" x2="1">
          <stop stopColor={color} />
          <stop offset=".55" stopColor="#fff2a8" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
    </svg>
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
    cosmic_crown: (
      <>
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{ marginTop: -size * 0.47, animation: "deco-float 3.4s ease-in-out infinite" }}
        >
          <CrownShape size={size * 0.95} color="#a78bfa" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full bg-white"
            style={{
              left: `${18 + ((i * 17) % 68)}%`,
              top: `${-18 + ((i * 11) % 24)}%`,
              width: size * 0.055,
              height: size * 0.055,
              boxShadow: "0 0 10px #fff, 0 0 18px #a78bfa",
              animation: `pe-twinkle ${2.4 + i * 0.2}s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </>
    ),
    plasma_halo: (
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ top: -size * 0.36 }}
      >
        <div
          style={{
            width: size * 1.18,
            height: size * 0.38,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, transparent 53%, #67e8f9 58%, #a78bfa 70%, transparent 78%)",
            boxShadow: "0 0 18px #67e8f9, 0 0 34px #a78bfa, inset 0 0 12px #fff",
            animation: "pe-holo 4.8s linear infinite, deco-pulse 2.6s ease-in-out infinite",
          }}
        />
      </div>
    ),
    royal_wings: (
      <>
        {[-1, 1].map((side) => (
          <svg
            key={side}
            className="pointer-events-none absolute top-1/2"
            style={{
              [side === -1 ? "left" : "right"]: -size * 0.55,
              width: size * 0.72,
              height: size * 0.96,
              transform: `translateY(-50%) scaleX(${side})`,
              filter: "drop-shadow(0 0 10px rgba(167,139,250,.75))",
              animation: "deco-float 4s ease-in-out infinite",
            }}
            viewBox="0 0 70 96"
            aria-hidden
          >
            <path d="M60 8C30 18 12 40 8 88c22-8 40-25 52-80Z" fill="#dbeafe" opacity=".92" />
            <path d="M58 22C35 32 22 49 14 86" stroke="#8b5cf6" strokeWidth="6" strokeLinecap="round" opacity=".7" />
            <path d="M52 42C36 49 26 61 18 86" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" opacity=".65" />
          </svg>
        ))}
      </>
    ),
    orbit: (
      <>
        <div
          className="pointer-events-none absolute inset-[-10%] rounded-full"
          style={{
            border: "1px solid rgba(103,232,249,.45)",
            boxShadow: "0 0 18px rgba(103,232,249,.55)",
            transform: "rotate(-18deg)",
          }}
        />
        {["#67e8f9", "#f0abfc", "#facc15"].map((color, i) => (
          <span
            key={color}
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
            style={{
              "--orbit-radius": `${size * (0.48 + i * 0.08)}px`,
              width: size * 0.09,
              height: size * 0.09,
              marginLeft: -size * 0.045,
              marginTop: -size * 0.045,
              background: color,
              boxShadow: `0 0 12px ${color}`,
              animation: `deco-orbit ${3.2 + i * 1.1}s linear infinite`,
            } as CSSProperties}
          />
        ))}
      </>
    ),
    star_shower: (
      <>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute text-white"
            style={{
              left: `${(i * 29) % 92}%`,
              top: `${-24 + ((i * 17) % 26)}%`,
              fontSize: size * (0.14 + (i % 3) * 0.035),
              textShadow: "0 0 10px #fff, 0 0 18px #facc15",
              animation: `pe-fall ${2.6 + (i % 4) * 0.45}s ease-in-out ${i * 0.16}s infinite`,
            }}
          >
            ✦
          </span>
        ))}
      </>
    ),
    glitch_frame: (
      <>
        <div
          className="pointer-events-none absolute inset-[-6%] rounded-full"
          style={{
            boxShadow: "4px 0 0 rgba(34,211,238,.9), -4px 0 0 rgba(244,63,94,.8), 0 0 22px rgba(34,211,238,.45)",
            animation: "deco-pulse 1.15s steps(2,end) infinite",
          }}
        />
        <div
          className="pointer-events-none absolute left-[-8%] right-[-8%] top-[42%] h-[12%]"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(34,211,238,.45), rgba(244,63,94,.4), transparent)",
            animation: "pc-scan 2.4s linear infinite",
          }}
        />
      </>
    ),
    flame_aura: (
      <div
        className="pointer-events-none absolute inset-[-12%] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at 50% 90%, rgba(249,115,22,.55), transparent 58%), radial-gradient(ellipse at 35% 18%, rgba(239,68,68,.28), transparent 45%), radial-gradient(ellipse at 70% 12%, rgba(250,204,21,.34), transparent 45%)",
          filter: "blur(1px)",
          animation: "pe-aurora 2.4s ease-in-out infinite alternate",
        }}
      />
    ),
    lightning_aura: (
      <>
        {[-1, 1].map((side) => (
          <svg
            key={side}
            className="pointer-events-none absolute top-[6%]"
            style={{
              [side === -1 ? "left" : "right"]: -size * 0.18,
              width: size * 0.35,
              height: size * 0.9,
              filter: "drop-shadow(0 0 10px #38bdf8)",
              animation: "deco-pulse 1.6s ease-in-out infinite",
            }}
            viewBox="0 0 32 90"
            aria-hidden
          >
            <path d="M21 2 5 42h13L10 88l18-54H15z" fill="#67e8f9" />
          </svg>
        ))}
      </>
    ),
    crystal_spikes: (
      <div
        className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 gap-1"
        style={{ marginTop: -size * 0.3, filter: "drop-shadow(0 0 10px #67e8f9)" }}
      >
        {[0.55, 0.75, 0.6].map((h, i) => (
          <span
            key={i}
            style={{
              width: size * 0.18,
              height: size * h,
              background: "linear-gradient(180deg,#e0f2fe,#38bdf8,#7c3aed)",
              clipPath: "polygon(50% 0, 100% 75%, 50% 100%, 0 75%)",
            }}
          />
        ))}
      </div>
    ),
    heart_aura: (
      <>
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute text-pink-300"
            style={{
              left: `${8 + ((i * 19) % 82)}%`,
              top: `${-18 + ((i * 23) % 115)}%`,
              fontSize: size * 0.18,
              textShadow: "0 0 10px #fb7185",
              animation: `deco-float ${2.6 + i * 0.2}s ease-in-out ${i * 0.15}s infinite`,
            }}
          >
            ♥
          </span>
        ))}
      </>
    ),
    coin_crown: (
      <div
        className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 gap-1"
        style={{ marginTop: -size * 0.42, animation: "deco-float 3s ease-in-out infinite" }}
      >
        {["$", "B", "$"].map((label, i) => (
          <span
            key={i}
            className="grid place-items-center rounded-full font-black text-amber-950"
            style={{
              width: size * 0.26,
              height: size * 0.26,
              marginTop: i === 1 ? 0 : size * 0.08,
              background: "linear-gradient(135deg,#fde68a,#f59e0b)",
              boxShadow: "0 0 12px rgba(245,158,11,.75)",
              fontSize: size * 0.13,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    ),
    builder_goggles: (
      <div
        className="pointer-events-none absolute left-1/2 top-[24%] -translate-x-1/2"
        style={{ filter: "drop-shadow(0 0 10px rgba(34,211,238,.55))" }}
      >
        <div
          style={{
            width: size * 0.85,
            height: size * 0.22,
            borderRadius: size * 0.12,
            border: `${Math.max(2, size * 0.045)}px solid #1f2937`,
            background: "linear-gradient(90deg,rgba(103,232,249,.75),rgba(167,139,250,.75))",
            boxShadow: "inset 0 0 12px rgba(255,255,255,.45)",
          }}
        />
      </div>
    ),
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
            "--deco-rotate": `${def.topRotate ?? 0}deg`,
            transform: `translate(${(def.topOffsetX ?? 0) * size}px, ${(def.topOffsetY ?? -0.5) * size}px) translateX(-50%) rotate(${def.topRotate ?? 0}deg)`,
            transformOrigin: "center",
            animation: def.animated ? "deco-float 3.6s ease-in-out infinite" : undefined,
          } as CSSProperties}
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

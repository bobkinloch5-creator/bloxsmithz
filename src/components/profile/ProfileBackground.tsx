// Roblox-themed animated backgrounds rendered as pure CSS gradients + keyframes.
// Used as the banner backdrop on profile cards.
import { memo } from "react";

export type ProfileBackgroundId =
  | "none"
  | "studio"
  | "neon-city"
  | "obby"
  | "forest"
  | "space"
  | "lava"
  | "clouds"
  | "void"
  | "sunset"
  | "ocean"
  | "candy"
  | "matrix";

export const PROFILE_BACKGROUNDS: { id: ProfileBackgroundId; label: string; preview: string }[] = [
  { id: "none", label: "None", preview: "linear-gradient(135deg,#1f2937,#0b1220)" },
  { id: "studio", label: "Studio", preview: "linear-gradient(135deg,#0ea5e9,#1e293b)" },
  { id: "neon-city", label: "Neon City", preview: "linear-gradient(135deg,#ff00aa,#7c3cff,#00d9ff)" },
  { id: "obby", label: "Obby", preview: "linear-gradient(135deg,#22c55e,#facc15,#ef4444)" },
  { id: "forest", label: "Forest", preview: "linear-gradient(135deg,#064e3b,#16a34a)" },
  { id: "space", label: "Space", preview: "linear-gradient(135deg,#0b1220,#7c3cff)" },
  { id: "lava", label: "Lava", preview: "linear-gradient(135deg,#7f1d1d,#f97316)" },
  { id: "clouds", label: "Clouds", preview: "linear-gradient(135deg,#bfdbfe,#f8fafc)" },
  { id: "void", label: "Void", preview: "linear-gradient(135deg,#000,#1e1b4b)" },
  { id: "sunset", label: "Sunset", preview: "linear-gradient(135deg,#f97316,#ec4899,#7c3cff)" },
  { id: "ocean", label: "Ocean", preview: "linear-gradient(135deg,#0c4a6e,#06b6d4)" },
  { id: "candy", label: "Candy", preview: "linear-gradient(135deg,#fbcfe8,#a78bfa,#67e8f9)" },
  { id: "matrix", label: "Matrix", preview: "linear-gradient(135deg,#000,#16a34a)" },
];

const STYLES: Record<ProfileBackgroundId, React.CSSProperties> = {
  none: {},
  studio: {
    background:
      "radial-gradient(120% 90% at 20% 0%, #0ea5e9 0%, transparent 55%), radial-gradient(120% 90% at 100% 100%, #1e293b 0%, transparent 60%), linear-gradient(135deg,#0b1220,#1e293b)",
  },
  "neon-city": {
    background:
      "linear-gradient(135deg, rgba(255,0,170,0.7), rgba(124,60,255,0.55) 50%, rgba(0,217,255,0.6))",
    backgroundSize: "200% 200%",
    animation: "pe-holo 9s linear infinite",
  },
  obby: {
    background:
      "repeating-linear-gradient(45deg, #22c55e 0 18px, #facc15 18px 36px, #ef4444 36px 54px, #3b82f6 54px 72px)",
    opacity: 0.85,
  },
  forest: {
    background:
      "radial-gradient(80% 90% at 30% 20%, #16a34a 0%, transparent 60%), radial-gradient(60% 80% at 80% 80%, #064e3b 0%, transparent 60%), linear-gradient(135deg,#052e1a,#064e3b)",
  },
  space: {
    background:
      "radial-gradient(2px 2px at 20% 30%, #fff 50%, transparent 51%), radial-gradient(2px 2px at 70% 60%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 40% 80%, #fff 50%, transparent 51%), radial-gradient(2px 2px at 85% 20%, #fff 50%, transparent 51%), linear-gradient(135deg, #0b1220, #1e1b4b, #7c3cff)",
    backgroundSize: "200px 200px, 220px 220px, 180px 180px, 240px 240px, 100% 100%",
  },
  lava: {
    background:
      "radial-gradient(60% 80% at 30% 100%, #f97316 0%, transparent 60%), radial-gradient(60% 80% at 80% 100%, #dc2626 0%, transparent 60%), linear-gradient(180deg, #7f1d1d, #1c1917)",
    animation: "pe-aurora 6s ease-in-out infinite alternate",
  },
  clouds: {
    background:
      "radial-gradient(60% 50% at 20% 30%, rgba(255,255,255,0.9) 0%, transparent 60%), radial-gradient(50% 40% at 80% 60%, rgba(255,255,255,0.7) 0%, transparent 60%), linear-gradient(180deg,#bfdbfe,#e0f2fe)",
  },
  void: {
    background:
      "radial-gradient(80% 80% at 50% 50%, #1e1b4b 0%, transparent 70%), linear-gradient(135deg,#000,#0f172a)",
  },
  sunset: {
    background:
      "linear-gradient(180deg, #312e81 0%, #7c3cff 30%, #ec4899 60%, #f97316 85%, #fbbf24 100%)",
  },
  ocean: {
    background:
      "radial-gradient(80% 80% at 30% 0%, #06b6d4 0%, transparent 60%), linear-gradient(180deg,#0c4a6e,#082f49)",
  },
  candy: {
    background:
      "linear-gradient(135deg,#fbcfe8,#a78bfa,#67e8f9,#fde68a)",
    backgroundSize: "300% 300%",
    animation: "pe-holo 12s linear infinite",
  },
  matrix: {
    background:
      "repeating-linear-gradient(180deg, rgba(34,197,94,0.18) 0 2px, transparent 2px 6px), linear-gradient(135deg, #000, #052e16)",
  },
};

export const ProfileBackground = memo(function ProfileBackground({
  id,
  className = "",
}: {
  id?: ProfileBackgroundId | string | null;
  className?: string;
}) {
  const key = (id ?? "none") as ProfileBackgroundId;
  const style = STYLES[key] ?? {};
  return <div aria-hidden className={`absolute inset-0 ${className}`} style={style} />;
});

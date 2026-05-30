import {
  ShoppingBag,
  Coins,
  Gem,
  Menu,
  Loader2,
  Settings,
  Package,
  PawPrint,
  ArrowLeftRight,
  Gift,
  RotateCw,
  Ticket,
  Target,
  MapPin,
  ArrowUp,
  Sparkles,
  Trophy,
  Shield,
  Gamepad,
  Heart,
  Wand2,
} from "lucide-react";
import type { UICategory } from "@/lib/ui-generator.shared";

type Item = { category: UICategory; icon: any; tagline: string; premium?: boolean };

export const TEMPLATES: Item[] = [
  { category: "Gamepass Shop", icon: ShoppingBag, tagline: "Premium passes & VIP", premium: true },
  { category: "Dev Product Shop", icon: ShoppingBag, tagline: "One-time purchases", premium: true },
  { category: "Coin Shop", icon: Coins, tagline: "Sell coins for Robux" },
  { category: "Gem Shop", icon: Gem, tagline: "Sell premium currency" },
  { category: "Main Menu", icon: Menu, tagline: "Cinematic title screen", premium: true },
  { category: "Loading Screen", icon: Loader2, tagline: "Branded splash" },
  { category: "Settings Menu", icon: Settings, tagline: "Volume, graphics, controls" },
  { category: "Inventory", icon: Package, tagline: "Item grid with details" },
  { category: "Pet Inventory", icon: PawPrint, tagline: "Pets with rarity & equip" },
  { category: "Trading", icon: ArrowLeftRight, tagline: "Two-player trade window" },
  { category: "Daily Rewards", icon: Gift, tagline: "7-day claim grid" },
  { category: "Spin Wheel", icon: RotateCw, tagline: "Lucky wheel rewards", premium: true },
  { category: "Codes Redeem", icon: Ticket, tagline: "Promo code input" },
  { category: "Quest UI", icon: Target, tagline: "Active quest tracker" },
  { category: "Teleport UI", icon: MapPin, tagline: "Server / place picker" },
  { category: "Upgrade UI", icon: ArrowUp, tagline: "Stat upgrade ladder" },
  { category: "Rebirth UI", icon: Sparkles, tagline: "Rebirth confirm + perks" },
  { category: "Leaderboard", icon: Trophy, tagline: "Top players list" },
  { category: "Admin Panel", icon: Shield, tagline: "Mod tools & commands", premium: true },
  { category: "Mobile Controls", icon: Gamepad, tagline: "Touch joystick + buttons" },
  { category: "HUD", icon: Heart, tagline: "Coins, gems, XP, health" },
  { category: "Custom", icon: Wand2, tagline: "Describe anything" },
];

export function TemplateGrid({
  active,
  onPick,
}: {
  active: UICategory;
  onPick: (c: UICategory) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-primary/25 bg-gradient-to-br from-primary/12 via-background/30 to-amber-500/10 p-3">
        <div className="text-sm font-bold text-foreground">Premium UI Templates</div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Each generation costs 5 credits and builds a Studio-ready ScreenGui with scripts,
          remotes, gradients, strokes, and responsive layout.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
      {TEMPLATES.map(({ category, icon: Icon, tagline, premium }) => {
        const isActive = active === category;
        return (
          <button
            key={category}
            onClick={() => onPick(category)}
            title={`${category} — ${tagline}`}
            className={`relative overflow-hidden text-left rounded-lg border p-2.5 transition group ${
              isActive
                ? "border-primary/70 bg-gradient-to-br from-primary/18 via-background/35 to-amber-500/10 shadow-[inset_3px_0_0_var(--primary)]"
                : premium
                  ? "border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-400/45"
                  : "border-border/80 bg-background/35 hover:bg-surface hover:border-primary/35"
            }`}
          >
            {premium && (
              <span className="absolute right-1.5 top-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                Pro
              </span>
            )}
            <div className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-elevated/70 text-muted-foreground group-hover:text-primary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="pr-8 text-[12px] font-semibold leading-tight text-foreground truncate">
                  {category}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-[10.5px] leading-tight text-muted-foreground">
                    {tagline}
                  </p>
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary-glow">
                    5 cr
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}

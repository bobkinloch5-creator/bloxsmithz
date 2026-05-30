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

type Item = { category: UICategory; icon: any; tagline: string };

export const TEMPLATES: Item[] = [
  { category: "Gamepass Shop", icon: ShoppingBag, tagline: "Premium passes & VIP" },
  { category: "Dev Product Shop", icon: ShoppingBag, tagline: "One-time purchases" },
  { category: "Coin Shop", icon: Coins, tagline: "Sell coins for Robux" },
  { category: "Gem Shop", icon: Gem, tagline: "Sell premium currency" },
  { category: "Main Menu", icon: Menu, tagline: "Title screen with Play" },
  { category: "Loading Screen", icon: Loader2, tagline: "Branded splash" },
  { category: "Settings Menu", icon: Settings, tagline: "Volume, graphics, controls" },
  { category: "Inventory", icon: Package, tagline: "Item grid with details" },
  { category: "Pet Inventory", icon: PawPrint, tagline: "Pets with rarity & equip" },
  { category: "Trading", icon: ArrowLeftRight, tagline: "Two-player trade window" },
  { category: "Daily Rewards", icon: Gift, tagline: "7-day claim grid" },
  { category: "Spin Wheel", icon: RotateCw, tagline: "Lucky wheel rewards" },
  { category: "Codes Redeem", icon: Ticket, tagline: "Promo code input" },
  { category: "Quest UI", icon: Target, tagline: "Active quest tracker" },
  { category: "Teleport UI", icon: MapPin, tagline: "Server / place picker" },
  { category: "Upgrade UI", icon: ArrowUp, tagline: "Stat upgrade ladder" },
  { category: "Rebirth UI", icon: Sparkles, tagline: "Rebirth confirm + perks" },
  { category: "Leaderboard", icon: Trophy, tagline: "Top players list" },
  { category: "Admin Panel", icon: Shield, tagline: "Mod tools & commands" },
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
    <div className="grid grid-cols-2 gap-1.5">
      {TEMPLATES.map(({ category, icon: Icon, tagline }) => {
        const isActive = active === category;
        return (
          <button
            key={category}
            onClick={() => onPick(category)}
            title={`${category} — ${tagline}`}
            className={`text-left rounded-lg border p-2 transition group ${
              isActive
                ? "border-primary/70 bg-primary/12 shadow-[inset_3px_0_0_var(--primary)]"
                : "border-border/80 bg-background/35 hover:bg-surface hover:border-primary/35"
            }`}
          >
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
                <div className="text-[12px] font-semibold leading-tight text-foreground truncate">
                  {category}
                </div>
                <p className="mt-0.5 text-[10.5px] leading-tight text-muted-foreground truncate">
                  {tagline}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

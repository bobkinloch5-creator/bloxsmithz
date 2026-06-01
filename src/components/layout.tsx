import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { createRobloxStyleAvatar } from "@/lib/generated-avatar";
import logo from "@/assets/logo.png";
import { useEffect, useState } from "react";
import {
  User,
  Settings,
  CreditCard,
  LogOut,
  ChevronDown,
  Home,
  LayoutDashboard,
  Puzzle,
  BookOpen,
  Sparkles,
  BadgeDollarSign,
  MessageCircle,
  Box,
  Shirt,
  Image as ImageIcon,
  Layout as LayoutIcon,
  Star,
  Users,
  GalleryHorizontal,
  Trophy,
  Lightbulb,
  Server,
  FileText,
  HelpCircle,
  Bug,
  Clock,
  Film,
} from "lucide-react";
import { PluginStatus } from "@/components/PluginStatus";
import { McpStatus } from "@/components/McpStatus";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { creditBalanceTitle, formatCreditBalance } from "@/lib/credit-display";
import { getBadgeDef } from "@/components/profile/ProfileBadges";
import {
  mergeProfileBadgeIds,
  normalizeProfileBadgeIds,
  roleProfileBadgeIds,
} from "@/lib/profile-badges";
import { ProfileMenuAvatar, ProfileMenuPreview } from "@/components/profile/ProfileMenuPreview";

type NavItem = {
  to: string;
  label: string;
  icon?: typeof Home;
  authOnly?: boolean;
  guestOnly?: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/dashboard", label: "Dashboard", authOnly: true },
  { to: "/templates", label: "Templates" },
  { to: "/script-doctor", label: "Script Doctor", authOnly: true },
  { to: "/clothing", label: "Clothing" },
  { to: "/image-generator", label: "Images" },
  { to: "/video-generator", label: "Video Generator" },
  { to: "/generate-3d", label: "3D Model Generator" },
  { to: "/ui-generator", label: "UI Generator" },
  { to: "/showcase", label: "Showcase" },
  { to: "/browse", label: "Community Chat" },
  { to: "/gallery", label: "Gallery" },
  { to: "/achievements", label: "Achievements" },
  { to: "/ideas", label: "Ideas" },
  { to: "/pricing", label: "Pricing" },
  { to: "/docs", label: "Docs" },
  { to: "/plugin", label: "Plugin" },
  { to: "/mcp", label: "MCP" },
  { to: "/mcp-servers", label: "MCP Servers", authOnly: true },
  { to: "/changelog", label: "Changelog" },
  { to: "/faq", label: "FAQ" },
];

const MOBILE_NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Build", icon: LayoutDashboard, authOnly: true },
  { to: "/account", label: "Profile", icon: User, authOnly: true },
  { to: "/login", label: "Login", icon: User, guestOnly: true },
  { to: "/pricing", label: "Credits", icon: BadgeDollarSign },
  { to: "/templates", label: "Templates", icon: Sparkles },
  { to: "/script-doctor", label: "Fix Scripts", icon: Bug, authOnly: true },
  { to: "/clothing", label: "Clothing", icon: Shirt },
  { to: "/image-generator", label: "Images", icon: ImageIcon },
  { to: "/video-generator", label: "Video Generator", icon: Film },
  { to: "/generate-3d", label: "3D Model Generator", icon: Box },
  { to: "/ui-generator", label: "UI Generator", icon: LayoutIcon },
  { to: "/showcase", label: "Showcase", icon: Star },
  { to: "/browse", label: "Community Chat", icon: Users },
  { to: "/gallery", label: "Gallery", icon: GalleryHorizontal },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/ideas", label: "Ideas", icon: Lightbulb },
  { to: "/docs", label: "Docs", icon: BookOpen },
  { to: "/plugin", label: "Plugin", icon: Puzzle },
  { to: "/mcp", label: "MCP", icon: Box },
  { to: "/mcp-servers", label: "MCP Servers", icon: Server, authOnly: true },
  { to: "/changelog", label: "Changelog", icon: FileText },
  { to: "/faq", label: "FAQ", icon: HelpCircle },
];

export function Header() {
  const { user, signOut, profile, isOwner, roles } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const bannerUrl = profile?.banner_url || user?.user_metadata?.banner_url || null;
  const fallbackAvatar = createRobloxStyleAvatar(user?.id || user?.email);
  const menuBadgeIds = mergeProfileBadgeIds([
    ...roleProfileBadgeIds(roles),
    ...normalizeProfileBadgeIds((profile as any)?.profile_badges),
    (profile as any)?.discord_claimed ? "booster" : "",
    (profile as any)?.credits > 0 ? "supporter" : "",
  ]);
  const menuBadgeNames = menuBadgeIds
    .map((id) => getBadgeDef(id)?.label)
    .filter(Boolean)
    .join(", ");

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.authOnly || user);
  const mobileItems = MOBILE_NAV_ITEMS.filter((item) => {
    if (item.authOnly && !user) return false;
    if (item.guestOnly && user) return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 shrink-0 notranslate"
          translate="no"
        >
          <img
            src={logo}
            alt="BloxSmith logo"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-md"
          />
          <span className="truncate text-base sm:text-lg font-bold whitespace-nowrap">
            Blox<span className="gradient-text">Smith</span>
          </span>
          <span className="ml-1 hidden lg:inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/20">
            Beta
          </span>
        </Link>

        <nav className="hidden shrink-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Browse
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[24rem] max-w-[calc(100vw-1.5rem)] p-2">
              <div className="mb-2 grid gap-2">
                <Link
                  to="/templates"
                  className="group rounded-lg border border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-surface/80 to-primary/10 p-3 transition hover:border-amber-400/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                        <Sparkles className="h-4 w-4 text-amber-300" />
                        Premium Templates
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Credit-costing Roblox starter kits: tycoons, RPG hubs, battle passes,
                        trading plazas, and more.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      credits
                    </span>
                  </div>
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/generate-3d"
                    className="rounded-lg border border-border/60 bg-background/50 p-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-surface"
                  >
                    <Box className="mb-1 h-4 w-4 text-primary" />
                    3D Model Generator
                  </Link>
                  <Link
                    to="/ui-generator"
                    className="rounded-lg border border-border/60 bg-background/50 p-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-surface"
                  >
                    <LayoutIcon className="mb-1 h-4 w-4 text-primary" />
                    Fancy UI Generator
                  </Link>
                </div>
              </div>
              <div className="my-2 h-px bg-border/70" />
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Pages
              </div>
              <div className="grid grid-cols-2 gap-1">
                {visibleNavItems.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to as any} className="w-full cursor-pointer">
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
              <div className="my-2 h-px bg-border/70" />
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Community
              </div>
              <DropdownMenuItem asChild>
                <a
                  href="https://discord.gg/ZzdqTpntB"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full cursor-pointer"
                >
                  Discord +10 free credits
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href="https://kingdavez.click"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full cursor-pointer"
                >
                  External 3D Model Site
                </a>
              </DropdownMenuItem>
              <div className="my-2 h-px bg-border/70" />
              <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Site controls
              </div>
              <div className="grid gap-2 px-2 pb-1" onClick={(event) => event.stopPropagation()}>
                <div className="grid grid-cols-2 gap-2">
                  <ThemeToggle />
                  <LanguageSwitcher compact />
                </div>
                {user && (
                  <div className="flex flex-wrap items-center gap-2">
                    <PluginStatus compact />
                    <McpStatus compact />
                  </div>
                )}
              </div>
              {user && (
                <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  Build status and MCP controls are tucked here so the header stays readable.
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex shrink-0 items-center gap-2 lg:gap-2.5 ml-auto">
          <LiveHeaderClock className="hidden 2xl:inline-flex" />
          <div className="hidden md:flex lg:hidden shrink-0 items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher compact />
          </div>

          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher compact />
          </div>

          {user ? (
            <>
              <Link
                to="/pricing"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 text-xs font-semibold text-primary-glow hover:bg-primary/20 transition whitespace-nowrap tabular-nums"
                title={profile ? creditBalanceTitle(profile.credits, isOwner) : "Loading credits"}
                aria-label={
                  profile ? creditBalanceTitle(profile.credits, isOwner) : "Loading credits"
                }
              >
                {profile ? formatCreditBalance(profile.credits, isOwner, { compact: true }) : "..."}
              </Link>

              <div className="relative">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="inline-flex h-9 max-w-[10.5rem] items-center gap-1.5 sm:gap-2 rounded-full border border-primary/20 bg-surface/85 pl-1.5 pr-2 text-xs font-semibold text-foreground shadow-sm hover:bg-surface-elevated transition"
                  aria-expanded={profileOpen}
                  aria-label="Open profile menu"
                  type="button"
                >
                  <ProfileMenuAvatar
                    src={avatarUrl}
                    fallback={fallbackAvatar}
                    profile={profile as any}
                    size={24}
                    compact
                  />
                  <span className="hidden 2xl:inline min-w-0 max-w-[7rem] truncate">
                    {profile?.display_name || "Builder"}
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 shrink-0 text-muted-foreground transition ${profileOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-[20rem] sm:w-[22rem]">
                      <ProfileMenuPreview
                        profile={profile as any}
                        roles={roles}
                        avatarUrl={avatarUrl}
                        fallbackAvatar={fallbackAvatar}
                        bannerUrl={bannerUrl}
                        badgeIds={menuBadgeIds}
                        badgeNames={menuBadgeNames}
                        lightweight
                      >
                        <div className="relative z-10 py-1.5">
                          <Link
                            to="/account"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface transition"
                          >
                            <User className="h-3.5 w-3.5 text-muted-foreground" /> Profile
                          </Link>
                          <Link
                            to="/account"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface transition"
                          >
                            <Settings className="h-3.5 w-3.5 text-muted-foreground" /> Settings
                          </Link>
                          <Link
                            to="/pricing"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/90 hover:bg-surface transition"
                          >
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" /> Buy Credits
                          </Link>
                        </div>
                        <div className="relative z-10 border-t border-border/40 py-1.5">
                          <button
                            onClick={() => {
                              setProfileOpen(false);
                              signOut();
                            }}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 w-full transition"
                            type="button"
                          >
                            <LogOut className="h-3.5 w-3.5" /> Sign out
                          </button>
                        </div>
                      </ProfileMenuPreview>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="btn-shine rounded-lg bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow)]"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      <nav
        className="md:hidden flex items-center gap-2 border-t border-border/70 bg-background/95 px-2 py-2"
        aria-label="Mobile navigation"
      >
        <LiveHeaderClock className="inline-flex md:hidden" />
        <div className="flex-1 min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full items-center gap-2">
            {mobileItems.map((item) => {
              const Icon = item.icon;
              const isProfile = item.to === "/account" && user;
              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-2 text-xs font-semibold text-foreground active:scale-[0.98] hover:bg-surface-elevated"
                >
                  {isProfile ? (
                    <ProfileMenuAvatar
                      src={avatarUrl}
                      fallback={fallbackAvatar}
                      profile={profile as any}
                      size={24}
                      compact
                    />
                  ) : (
                    Icon && <Icon className="h-3.5 w-3.5 text-primary" />
                  )}
                  {item.label}
                </Link>
              );
            })}
            <a
              href="https://kingdavez.click"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-2 text-xs font-semibold text-foreground active:scale-[0.98] hover:bg-surface-elevated"
            >
              <Box className="h-3.5 w-3.5 text-primary" /> 3D Model Generator
            </a>
            <a
              href="https://discord.gg/ZzdqTpntB"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#5865F2]/30 bg-[#5865F2]/15 px-3 py-2 text-xs font-bold text-[#8ea0ff] active:scale-[0.98] hover:bg-[#5865F2]/25"
            >
              Discord +10
            </a>
            {user && (
              <>
                <PluginStatus compact />
                <McpStatus compact />
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

function LiveHeaderClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now
    ? now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "--:--:-- --";

  return (
    <div
      className={`${className} h-9 shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/70 px-3 text-xs font-semibold text-foreground/90 shadow-sm tabular-nums`}
      title="Local 12-hour time"
      aria-label={`Local time ${time}`}
      suppressHydrationWarning
    >
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span>{time}</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} BloxSmith. Build real Roblox games with AI.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link to="/terms" className="hover:text-foreground transition">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-foreground transition">
            Privacy
          </Link>
          <Link to="/legal" className="hover:text-foreground transition">
            Legal
          </Link>
        </nav>
        <p className="text-[11px] text-muted-foreground/80">
          Made only by{" "}
          <a
            href="https://github.com/bobkinloch5-creator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-glow hover:underline font-semibold"
          >
            Dave Kinloch
          </a>
        </p>
      </div>
    </footer>
  );
}

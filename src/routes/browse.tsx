import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { GlobalChat } from "@/components/GlobalChat";
import { useAuth } from "@/lib/auth-context";
import { MASCOT_SRC } from "@/lib/emotes";
import {
  Gift,
  Image as ImageIcon,
  MessagesSquare,
  Palette,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

export const Route = createFileRoute("/browse")({
  component: BrowsePage,
  head: () => ({
    meta: [
      { title: "Browse — Global Chat | BloxSmith" },
      {
        name: "description",
        content:
          "Hang out with other BloxSmith builders in the full-size global chat. Share builds, get help, and react with custom emotes.",
      },
    ],
  }),
});

function BrowsePage() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={MASCOT_SRC}
              alt=""
              className="h-10 w-10 shrink-0 object-contain drop-shadow sm:h-12 sm:w-12"
              loading="lazy"
            />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-bold leading-tight sm:text-3xl">
                <MessagesSquare className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
                <span className="truncate">Browse the community</span>
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Full-screen global chat with channels, friends, emotes and live presence.
              </p>
            </div>
          </div>
          <div className="hidden gap-4 text-xs text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Friends &amp; DMs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> BloxSmith emotes
            </span>
          </div>
        </div>

        <section className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">How to earn credits</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Claim +10 daily credits, join Discord for +10, invite friends, send chat messages,
                  unlock badges, redeem promo codes, or submit BloxSmith promo videos for review.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                to="/account"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/30 bg-background/50 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
              >
                Claim daily
              </Link>
              <Link
                to="/achievements"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/30 bg-background/50 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
              >
                Chat & badges
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/30 bg-background/50 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
              >
                Credit packs
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-3 sm:grid-cols-3">
          <Link
            to="/video-generator"
            className="rounded-2xl border border-border bg-surface/70 p-4 transition hover:border-primary/45 hover:bg-surface"
          >
            <Video className="mb-2 h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold">Video & music</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Make Roblox promo videos, music loops, captions, and NPC voice kits.
            </p>
          </Link>
          <Link
            to="/texture-generator"
            className="rounded-2xl border border-border bg-surface/70 p-4 transition hover:border-primary/45 hover:bg-surface"
          >
            <Palette className="mb-2 h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold">Texture generator</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Create seamless materials, decals, terrain tiles, and UI patterns with Nano.
            </p>
          </Link>
          <Link
            to="/image-generator"
            className="rounded-2xl border border-border bg-surface/70 p-4 transition hover:border-primary/45 hover:bg-surface"
          >
            <ImageIcon className="mb-2 h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold">Images</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Generate thumbnails, icons, gamepass art, decals, and reference images.
            </p>
          </Link>
        </section>

        {user ? (
          <GlobalChat inline />
        ) : (
          <div className="rounded-2xl border border-border bg-surface-elevated p-8 text-center">
            <img src={MASCOT_SRC} alt="" className="mx-auto h-20 w-20 object-contain" />
            <h2 className="mt-3 text-xl font-bold">Sign in to chat</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The community chat is open to all signed-in BloxSmith builders.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

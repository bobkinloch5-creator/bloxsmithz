import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { GlobalChat } from "@/components/GlobalChat";
import { useAuth } from "@/lib/auth-context";
import { MASCOT_SRC } from "@/lib/emotes";
import { MessagesSquare, Users, Sparkles } from "lucide-react";

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
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Friends &amp; DMs</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> BloxSmith emotes</span>
          </div>
        </div>

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

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  MessagesSquare,
  Send,
  X,
  Loader2,
  Trash2,
  Volume2,
  VolumeX,
  ShieldAlert,
  Bot,
  MoreVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RoleBadges, type Role } from "@/components/RoleBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CHAT_ICON_MAP,
  gradientTextStyle,
  sanitizeGradient,
  sanitizeIcon,
} from "@/lib/chat-customization";

type DbMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
};

type Author = {
  display_name: string | null;
  avatar_url: string | null;
  roles: Role[];
  chat_name_gradient: string[] | null;
  chat_text_gradient: string[] | null;
  chat_icon: string | null;
};

type RenderMessage = DbMessage & { ephemeralBot?: boolean };

const OPEN_KEY = "bloxsmith.globalchat.open";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function GlobalChat() {
  const { user, isAdmin, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<RenderMessage[]>([]);
  const [authors, setAuthors] = useState<Map<string, Author>>(new Map());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [slow, setSlow] = useState(0);
  const [muted, setMuted] = useState<Date | null>(null);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Restore open state
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      setOpen(localStorage.getItem(OPEN_KEY) === "1");
    }
  }, []);
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    }
    if (open) setUnread(0);
  }, [open]);

  // Hydrate authors for any user_ids we don't have yet
  async function loadAuthors(ids: string[]) {
    const need = ids.filter((id) => id && !authors.has(id));
    if (!need.length) return;
    const [{ data: profs }, { data: rs }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,display_name,avatar_url,chat_name_gradient,chat_text_gradient,chat_icon",
        )
        .in("id", need),
      (supabase as any).from("user_roles").select("user_id,role").in("user_id", need),
    ]);
    const rolesByUser = new Map<string, Role[]>();
    ((rs ?? []) as { user_id: string; role: Role }[]).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    setAuthors((prev) => {
      const next = new Map(prev);
      (profs ?? []).forEach((p: any) => {
        next.set(p.id, {
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          roles: rolesByUser.get(p.id) ?? [],
          chat_name_gradient: sanitizeGradient(p.chat_name_gradient),
          chat_text_gradient: sanitizeGradient(p.chat_text_gradient),
          chat_icon: sanitizeIcon(p.chat_icon),
        });
      });
      return next;
    });
  }

  // Initial fetch + settings + mute status
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: msgs }, { data: settings }, { data: mute }] = await Promise.all([
        supabase
          .from("global_chat_messages")
          .select("id,user_id,content,created_at,deleted_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(100),
        supabase.from("global_chat_settings").select("slow_mode_seconds").eq("id", 1).maybeSingle(),
        (supabase as any)
          .from("global_chat_mutes")
          .select("muted_until")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const rows = (msgs ?? []) as DbMessage[];
      setMessages(rows);
      setSlow(((settings as any)?.slow_mode_seconds as number) ?? 0);
      const until = (mute as any)?.muted_until ? new Date((mute as any).muted_until) : null;
      setMuted(until && until > new Date() ? until : null);
      await loadAuthors(Array.from(new Set(rows.map((r) => r.user_id))));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("global_chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_chat_messages" },
        async (payload) => {
          const row = payload.new as DbMessage;
          if (row.deleted_at) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (!open && row.user_id !== user.id) setUnread((u) => u + 1);
          await loadAuthors([row.user_id]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "global_chat_messages" },
        (payload) => {
          const row = payload.new as DbMessage;
          if (row.deleted_at) {
            setMessages((prev) => prev.filter((m) => m.id !== row.id));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "global_chat_settings" },
        (payload) => {
          setSlow(((payload.new as any).slow_mode_seconds as number) ?? 0);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, open]);

  // Autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  async function runSlashCommand(text: string): Promise<boolean> {
    const m = text.match(/^\/(\w+)(?:\s+(.*))?$/s);
    if (!m) return false;
    const cmd = m[1].toLowerCase();
    const args = (m[2] ?? "").trim();

    if (cmd === "help") {
      const help = [
        "Commands:",
        "/help — this menu",
        "/ask <question> — ask the BloxBot AI (only you see the answer)",
        ...(isAdmin
          ? [
              "/slow <seconds> — set slow mode (0 = off, admin)",
              "/clear — soft-delete every message (admin)",
            ]
          : []),
      ].join("\n");
      pushEphemeralBot(help);
      return true;
    }

    if (cmd === "ask") {
      if (!args) {
        pushEphemeralBot("Usage: /ask <your question>");
        return true;
      }
      pushEphemeralBot("Thinking…", "tmp-thinking");
      try {
        const res = await fetch("/api/public/help-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: args, history: [] }),
        });
        const data = await res.json().catch(() => ({}));
        const reply = typeof data?.reply === "string" ? data.reply : "Sorry, I couldn't answer.";
        setMessages((prev) => prev.filter((p) => p.id !== "tmp-thinking"));
        pushEphemeralBot(reply);
      } catch {
        setMessages((prev) => prev.filter((p) => p.id !== "tmp-thinking"));
        pushEphemeralBot("Network error talking to the bot.");
      }
      return true;
    }

    if (cmd === "slow") {
      if (!isAdmin) {
        toast.error("Admins only");
        return true;
      }
      const n = parseInt(args, 10);
      if (Number.isNaN(n) || n < 0 || n > 3600) {
        toast.error("Usage: /slow 0-3600");
        return true;
      }
      const { error } = await (supabase as any).rpc("admin_chat_set_slow_mode", { _seconds: n });
      if (error) toast.error(error.message);
      else toast.success(n === 0 ? "Slow mode off" : `Slow mode: ${n}s`);
      return true;
    }

    if (cmd === "clear") {
      if (!isAdmin) {
        toast.error("Admins only");
        return true;
      }
      const { error } = await (supabase as any).rpc("admin_chat_clear_all");
      if (error) toast.error(error.message);
      else {
        setMessages([]);
        toast.success("Chat cleared");
      }
      return true;
    }

    pushEphemeralBot(`Unknown command: /${cmd}. Try /help`);
    return true;
  }

  function pushEphemeralBot(content: string, id?: string) {
    const msg: RenderMessage = {
      id: id ?? `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      user_id: "bloxbot",
      content,
      created_at: new Date().toISOString(),
      deleted_at: null,
      ephemeralBot: true,
    };
    setMessages((prev) => [...prev, msg]);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setDraft("");
    try {
      if (trimmed.startsWith("/")) {
        await runSlashCommand(trimmed);
        return;
      }
      const { error } = await (supabase as any).rpc("send_global_chat_message", {
        _content: trimmed,
      });
      if (error) {
        const msg = error.message || "Failed to send";
        if (msg.includes("slow_mode")) toast.error(`Slow mode active — wait ${slow}s between messages`);
        else if (msg.includes("muted")) toast.error("You're muted in chat");
        else if (msg.includes("banned")) toast.error("You're banned");
        else if (msg.includes("too_long")) toast.error("Message is too long");
        else toast.error(msg);
        setDraft(trimmed);
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function deleteMessage(id: string) {
    const { error } = await (supabase as any).rpc("admin_chat_delete_message", { _message_id: id });
    if (error) toast.error(error.message);
  }
  async function muteUser(uid: string, minutes: number | null, reason: string) {
    const { error } = await (supabase as any).rpc("admin_chat_mute", {
      _user_id: uid,
      _minutes: minutes,
      _reason: reason,
    });
    if (error) toast.error(error.message);
    else toast.success(minutes ? `Muted for ${minutes}m` : "Muted permanently");
  }
  async function unmuteUser(uid: string) {
    const { error } = await (supabase as any).rpc("admin_chat_unmute", { _user_id: uid });
    if (error) toast.error(error.message);
    else toast.success("Unmuted");
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(draft);
  }

  const myRoles = useMemo(() => roles as Role[], [roles]);

  if (!user) return null;

  return (
    <>
      {/* Launcher (bottom-left) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open global chat"
          className="fixed left-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[9998] flex h-14 items-center gap-2 rounded-full border-2 border-foreground/10 bg-surface-elevated px-4 text-foreground shadow-lg ring-2 ring-border ring-offset-2 ring-offset-background transition hover:-translate-y-0.5 hover:bg-surface active:scale-95 sm:left-5 sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
        >
          <MessagesSquare className="h-5 w-5" />
          <span className="text-sm font-bold">Chat</span>
          {unread > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <aside
          role="dialog"
          aria-label="Global chat"
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[9999] flex h-[min(78dvh,640px)] max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated/98 shadow-2xl backdrop-blur-xl md:inset-x-auto md:left-5 md:right-auto md:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] md:h-[min(620px,calc(100dvh-2.5rem))] md:w-[400px]"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15">
                <MessagesSquare className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight">Global Chat</div>
                <div className="flex items-center gap-1.5 text-[10.5px] leading-tight text-muted-foreground">
                  {slow > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-500">
                      <VolumeX className="h-3 w-3" /> Slow {slow}s
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Volume2 className="h-3 w-3" /> Live
                    </span>
                  )}
                  <span>·</span>
                  <span>/help for commands</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3"
          >
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground">No messages yet — say hi!</p>
            )}
            {messages.map((m) => {
              const isMe = m.user_id === user.id;
              const isBot = m.ephemeralBot;
              const author = !isBot ? authors.get(m.user_id) : null;
              const name = isBot
                ? "BloxBot"
                : author?.display_name || (isMe ? "You" : "User");
              return (
                <div key={m.id} className="group flex gap-2">
                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                      isBot
                        ? "bg-gradient-to-br from-primary/30 to-primary/10 text-primary"
                        : "bg-surface text-muted-foreground",
                    )}
                  >
                    {isBot ? (
                      <Bot className="h-4 w-4" />
                    ) : author?.avatar_url ? (
                      <img
                        src={author.avatar_url}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isBot && author?.chat_icon && CHAT_ICON_MAP[author.chat_icon] ? (
                        (() => {
                          const Ico = CHAT_ICON_MAP[author.chat_icon!];
                          const stops = author.chat_name_gradient;
                          return (
                            <Ico
                              className="h-3.5 w-3.5 shrink-0"
                              style={stops?.length ? { color: stops[0] } : undefined}
                              aria-hidden
                            />
                          );
                        })()
                      ) : null}
                      <span
                        className="truncate text-xs font-semibold"
                        style={!isBot ? gradientTextStyle(author?.chat_name_gradient) : undefined}
                      >
                        {name}
                      </span>
                      {isBot ? (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                          BOT
                        </span>
                      ) : (
                        author && <RoleBadges roles={author.roles} size="sm" showLabel={false} />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(m.created_at)}
                      </span>
                      {isBot && (
                        <span className="text-[10px] text-muted-foreground">· only you see this</span>
                      )}
                      {isAdmin && !isBot && (
                        <ModMenu
                          onDelete={() => deleteMessage(m.id)}
                          onMute={(mins) => muteUser(m.user_id, mins, "via chat moderation")}
                          onUnmute={() => unmuteUser(m.user_id)}
                          isSelf={isMe}
                        />
                      )}
                    </div>
                    <div
                      className="mt-0.5 break-words text-sm leading-relaxed whitespace-pre-wrap text-foreground"
                      style={!isBot ? gradientTextStyle(author?.chat_text_gradient) : undefined}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={onSubmit} className="shrink-0 border-t border-border p-2">
            {muted && (
              <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                <ShieldAlert className="h-3 w-3" />
                You're muted until {muted.toLocaleString()}.
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                placeholder={muted ? "You're muted" : "Message everyone… (/help)"}
                disabled={!!muted || sending}
                maxLength={500}
                rows={1}
                className="max-h-24 min-w-0 flex-1 resize-none rounded-lg border border-border bg-background/60 px-2.5 py-2 text-sm leading-relaxed focus:border-primary/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim() || !!muted}
                aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                You as <RoleBadges roles={myRoles} size="sm" showLabel /> · {draft.length}/500
              </span>
              {slow > 0 && !isAdmin && <span>Slow mode {slow}s</span>}
            </div>
          </form>
        </aside>
      )}
    </>
  );
}

function ModMenu({
  onDelete,
  onMute,
  onUnmute,
  isSelf,
}: {
  onDelete: () => void;
  onMute: (minutes: number | null) => void;
  onUnmute: () => void;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onClick = () => setOpen(false);
    setTimeout(() => window.addEventListener("click", onClick, { once: true }), 0);
    return () => window.removeEventListener("click", onClick);
  }, [open]);
  return (
    <div className="relative ml-auto opacity-0 transition group-hover:opacity-100">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
        aria-label="Moderation"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-7 z-50 w-44 overflow-hidden rounded-lg border border-border bg-surface-elevated text-xs shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface"
          >
            <Trash2 className="h-3 w-3" /> Delete message
          </button>
          {!isSelf && (
            <>
              <button
                type="button"
                onClick={() => {
                  onMute(5);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface"
              >
                <VolumeX className="h-3 w-3" /> Mute 5 min
              </button>
              <button
                type="button"
                onClick={() => {
                  onMute(60);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface"
              >
                <VolumeX className="h-3 w-3" /> Mute 1 hour
              </button>
              <button
                type="button"
                onClick={() => {
                  onMute(null);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface"
              >
                <VolumeX className="h-3 w-3" /> Mute permanently
              </button>
              <button
                type="button"
                onClick={() => {
                  onUnmute();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface"
              >
                <Volume2 className="h-3 w-3" /> Unmute
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

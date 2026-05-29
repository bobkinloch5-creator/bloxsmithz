import { useState, useRef, useEffect, type FormEvent } from "react";
import { MessageCircle, X, Send, Loader2, RotateCcw, Trash2, Minus, Sparkles } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_HISTORY = "bloxsmith.helpchat.history";
const STORAGE_OPEN = "bloxsmith.helpchat.open";
const STORAGE_MIN = "bloxsmith.helpchat.minimized";
const MAX_STORED = 12;

const SUGGESTED = [
  "How do I install the Studio plugin?",
  "How do credits and pricing work?",
  "How do I design clothing or accessories?",
  "How do I build a game with the AI?",
];

function loadHistory(): Message[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m: unknown): m is Message =>
          !!m &&
          typeof m === "object" &&
          "role" in m &&
          ((m as Message).role === "user" || (m as Message).role === "assistant") &&
          typeof (m as Message).content === "string",
      )
      .slice(-MAX_STORED);
  } catch {
    return [];
  }
}

function saveHistory(history: Message[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(-MAX_STORED)));
  } catch {
    /* ignore */
  }
}

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Hydrate once.
  useEffect(() => {
    setMessages(loadHistory());
    if (typeof localStorage !== "undefined") {
      const wasOpen = localStorage.getItem(STORAGE_OPEN) === "1";
      const wasMin = localStorage.getItem(STORAGE_MIN) === "1";
      setOpen(wasOpen && !wasMin);
      setMinimized(wasMin);
    }
  }, []);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_OPEN, open ? "1" : "0");
    }
  }, [open]);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_MIN, minimized ? "1" : "0");
    }
  }, [minimized]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Pin transcript to bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  // Focus input on open.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 160);
    return () => clearTimeout(t);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    setLastFailed(null);
    setInput("");
    const priorHistory = messages.slice(-8);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setSending(true);
    try {
      const res = await fetch("/api/public/help-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: priorHistory }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.message === "string"
            ? data.message
            : "Sorry — I couldn't answer that. Please try again.",
        );
        setLastFailed(trimmed);
        return;
      }
      const reply = typeof data?.reply === "string" ? data.reply : "";
      if (!reply) {
        setError("No reply received — please try again.");
        setLastFailed(trimmed);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setError("Network error — check your connection and try again.");
      setLastFailed(trimmed);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  function retry() {
    if (lastFailed) send(lastFailed);
  }

  function clearChat() {
    setMessages([]);
    setError(null);
    setLastFailed(null);
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_HISTORY);
  }

  function openChat() {
    setMinimized(false);
    setOpen(true);
  }

  function minimizeChat() {
    setOpen(false);
    setMinimized(true);
  }

  function closeChat() {
    setOpen(false);
    setMinimized(false);
  }

  return (
    <>
      {/* Floating launcher — fixed bottom-right with safe-area padding */}
      {!open && (
        <button
          type="button"
          onClick={openChat}
          aria-label="Open BloxSmith AI Help"
          title="BloxSmith AI Help"
          className="group fixed z-[9998] flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-gradient-to-br from-primary to-primary/85 px-4 py-3 text-primary-foreground shadow-[0_10px_32px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] backdrop-blur-md transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_14px_42px_-10px_color-mix(in_oklab,var(--primary)_75%,transparent)] active:scale-95 animate-fade-in right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/15 backdrop-blur-sm transition group-hover:bg-primary-foreground/25">
            <MessageCircle className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 grid h-3 w-3 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/70" />
              <span className="relative h-2 w-2 rounded-full bg-accent" />
            </span>
          </span>
          <span className="text-sm font-semibold tracking-tight">
            {minimized ? "Resume chat" : "AI Help"}
          </span>
        </button>
      )}

      {/* Mobile backdrop only */}
      {open && (
        <div
          className="fixed inset-0 z-[9997] bg-black/45 backdrop-blur-[2px] animate-fade-in md:hidden"
          onClick={minimizeChat}
          aria-hidden
        />
      )}

      {open && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label="BloxSmith AI Help"
          className="fixed z-[9999] flex flex-col overflow-hidden border border-border/70 bg-surface-elevated/95 backdrop-blur-xl shadow-2xl animate-scale-in
            inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] top-auto
            h-[min(80dvh,640px)] max-h-[calc(100dvh-1rem-env(safe-area-inset-bottom))]
            rounded-2xl
            md:inset-x-auto md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:right-6
            md:w-[400px] md:h-[min(640px,calc(100dvh-3rem))]
            md:rounded-2xl"
        >
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-gradient-to-br from-primary/15 via-surface-elevated to-surface-elevated px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_45%,transparent)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold leading-tight">
                  BloxSmith AI
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
                  </span>
                </div>
                <div className="truncate text-[11px] leading-tight text-muted-foreground">
                  Plugin, credits, building & more
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  aria-label="Clear conversation"
                  title="Clear"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={minimizeChat}
                aria-label="Minimize"
                title="Minimize"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={closeChat}
                aria-label="Close"
                title="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Transcript */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 py-3.5"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Hi! I'm the BloxSmith help assistant. Ask about the Studio plugin, credits,
                  building games, clothing, accessories, assets, or anything on the site.
                </p>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Try asking
                  </div>
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left text-xs transition hover:border-primary/60 hover:bg-surface hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex animate-fade-in ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[86%] break-words rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                    m.role === "user"
                      ? "rounded-br-md bg-gradient-to-br from-primary to-primary/85 text-primary-foreground"
                      : "rounded-bl-md border border-border/60 bg-background/70 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/60 bg-background/70 px-3.5 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}

            {error && (
              <div className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                <div>{error}</div>
                {lastFailed && !sending && (
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-medium transition hover:bg-destructive/25"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={onSubmit}
            className="flex shrink-0 items-end gap-2 border-t border-border/70 bg-background/40 p-2.5"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask anything…"
              disabled={sending}
              maxLength={1500}
              rows={1}
              className="max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs leading-relaxed transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-[0_6px_20px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

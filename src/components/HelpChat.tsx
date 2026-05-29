import { useState, useRef, useEffect, useCallback, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { MessageCircle, X, Send, Loader2, RotateCcw, Trash2, GripVertical } from "lucide-react";

const STORAGE_POS_KEY = "bloxsmith.helpchat.pos";
const STORAGE_PANEL_POS_KEY = "bloxsmith.helpchat.panel-pos";
type Pos = { x: number; y: number };

function loadPosFrom(key: string): Pos | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch {}
  return null;
}
function loadPos(): Pos | null {
  return loadPosFrom(STORAGE_POS_KEY);
}

type Message = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "bloxsmith.helpchat.history";
const STORAGE_OPEN_KEY = "bloxsmith.helpchat.open";
const MAX_STORED_TURNS = 12;

const SUGGESTED = [
  "How do I install the Studio plugin?",
  "How do credits and pricing work?",
  "How do I design clothing or accessories?",
  "How do I build a game with the AI?",
];

function loadHistory(): Message[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
      .slice(-MAX_STORED_TURNS);
  } catch {
    return [];
  }
}

function saveHistory(history: Message[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_STORED_TURNS)));
  } catch {
    // ignore quota
  }
}

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Restore history + open state once on mount.
  useEffect(() => {
    setMessages(loadHistory());
    if (typeof localStorage !== "undefined") {
      setOpen(localStorage.getItem(STORAGE_OPEN_KEY) === "1");
    }
  }, []);

  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragInfo = useRef<{ startX: number; startY: number; offX: number; offY: number; moved: boolean; pointerId: number } | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setPos(loadPos());
  }, []);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_OPEN_KEY, open ? "1" : "0");
    }
  }, [open]);

  // Clamp position into viewport on resize.
  useEffect(() => {
    if (!pos) return;
    function clamp() {
      const el = launcherRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos((p) => {
        if (!p) return p;
        const maxX = window.innerWidth - r.width - 8;
        const maxY = window.innerHeight - r.height - 8;
        const nx = Math.min(Math.max(8, p.x), Math.max(8, maxX));
        const ny = Math.min(Math.max(8, p.y), Math.max(8, maxY));
        return nx === p.x && ny === p.y ? p : { x: nx, y: ny };
      });
    }
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [pos]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = launcherRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - r.left,
      offY: e.clientY - r.top,
      moved: false,
      pointerId: e.pointerId,
    };
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const info = dragInfo.current;
    if (!info || info.pointerId !== e.pointerId) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (!info.moved && Math.hypot(dx, dy) < 5) return;
    info.moved = true;
    setDragging(true);
    const el = launcherRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = Math.min(Math.max(8, e.clientX - info.offX), window.innerWidth - r.width - 8);
    const ny = Math.min(Math.max(8, e.clientY - info.offY), window.innerHeight - r.height - 8);
    setPos({ x: nx, y: ny });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const info = dragInfo.current;
    if (!info) return;
    const wasMoved = info.moved;
    dragInfo.current = null;
    setDragging(false);
    try { launcherRef.current?.releasePointerCapture(e.pointerId); } catch {}
    if (wasMoved) {
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
      setPos((p) => {
        if (p && typeof localStorage !== "undefined") {
          try { localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(p)); } catch {}
        }
        return p;
      });
    }
  }, []);


  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
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
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <>
      {/* Floating launcher — premium pill, safe bottom-right placement across all pages. */}
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => {
            if (suppressClickRef.current) { e.preventDefault(); return; }
            setOpen(true);
          }}
          aria-label="Open BloxSmith AI help chat (drag to move)"
          title="BloxSmith AI Help — drag to move"
          style={
            pos
              ? { left: `${pos.x}px`, top: `${pos.y}px`, right: "auto", bottom: "auto", touchAction: "none" }
              : { touchAction: "none" }
          }
          className={`group fixed z-[9998] flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary/80 pl-2.5 pr-4 text-primary-foreground shadow-[0_8px_28px_-6px_color-mix(in_oklab,var(--primary)_55%,transparent)] ring-1 ring-primary-foreground/10 transition-shadow duration-300 hover:shadow-[0_12px_36px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)] sm:h-14 sm:pl-3 sm:pr-5 animate-fade-in select-none ${
            dragging ? "cursor-grabbing scale-[1.04]" : "cursor-grab hover:scale-[1.03] active:scale-95"
          } ${pos ? "" : "right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-[calc(1.75rem+env(safe-area-inset-bottom))]"}`}
        >
          <span className="grid h-6 w-6 place-items-center rounded-full text-primary-foreground/60 sm:h-7 sm:w-7" aria-hidden>
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 backdrop-blur-sm transition group-hover:bg-primary-foreground/20 sm:h-8 sm:w-8">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">AI Help</span>
        </button>
      )}


      {/* Mobile/tablet backdrop. Desktop stays light so the page is still visible. */}
      {open && (
        <div
          className="fixed inset-0 z-[9997] bg-black/45 backdrop-blur-[2px] animate-fade-in md:bg-transparent md:backdrop-blur-0 md:pointer-events-none"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Responsive panel — bottom sheet on mobile, floating card on desktop. */}
      {open && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label="BloxSmith AI help chat"
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[9999] flex h-[min(78dvh,640px)] max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated/98 shadow-2xl backdrop-blur-xl animate-scale-in md:inset-x-auto md:right-6 md:bottom-[calc(1.75rem+env(safe-area-inset-bottom))] md:h-[min(620px,calc(100dvh-3rem))] md:w-[380px] lg:w-[400px]"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_35%,transparent)]">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight">BloxSmith AI Help</div>
                <div className="truncate text-[10.5px] leading-tight text-muted-foreground">
                  Plugin, credits, building, clothing &amp; more
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
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
                onClick={() => setOpen(false)}
                aria-label="Close help chat"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Hi! I'm the BloxSmith help bot. Ask about the Studio plugin, credits, building
                  games, clothing &amp; accessories, assets, or how anything on the site works.
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
                      className="w-full rounded-lg border border-border/60 bg-background/40 px-2.5 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-surface"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] break-words rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background/60 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}

            {error && (
              <div className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
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

          <form onSubmit={onSubmit} className="flex shrink-0 items-end gap-2 border-t border-border p-2">
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
              placeholder="Ask a question…"
              disabled={sending}
              maxLength={1500}
              rows={1}
              className="max-h-24 min-w-0 flex-1 resize-none rounded-lg border border-border bg-background/60 px-2.5 py-2 text-xs leading-relaxed focus:border-primary/50 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

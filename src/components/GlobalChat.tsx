import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  MessagesSquare, Send, X, Loader2, Trash2, Volume2, VolumeX,
  ShieldAlert, Bot, MoreVertical, Reply, Pin, PinOff, Flag,
  Image as ImageIcon, Settings2, Shield, AtSign, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RoleBadges, type Role } from "@/components/RoleBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CHAT_ICON_MAP, gradientTextStyle, sanitizeGradient, sanitizeIcon, sanitizeFont, chatFontStyle,
} from "@/lib/chat-customization";
import { EmojiPicker, QUICK_REACTIONS } from "@/components/chat/EmojiPicker";
import { EmotePicker } from "@/components/chat/EmotePicker";
import { EMOTE_MAP } from "@/lib/emotes";
import { ChatSettingsPanel } from "@/components/chat/ChatSettingsPanel";
import { ChatModerationPanel } from "@/components/chat/ChatModerationPanel";
import { useChatPrefs, fontSizeClass, densityClass, chatBackgroundStyle } from "@/lib/chat-prefs";
import { useServerFn } from "@tanstack/react-start";
import { moderateChatMessage } from "@/lib/chat-moderation.functions";

import { ChannelSidebar, type Channel } from "@/components/chat/ChannelSidebar";
import { FriendsPanel } from "@/components/chat/FriendsPanel";
import { UserProfilePopover } from "@/components/chat/UserProfilePopover";

type DbMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  reply_to_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  pinned_at: string | null;
  flagged: boolean | null;
  channel_id?: string | null;
};

type Author = {
  display_name: string | null;
  avatar_url: string | null;
  roles: Role[];
  badges: string[];
  chat_name_gradient: string[] | null;
  chat_text_gradient: string[] | null;
  chat_icon: string | null;
  chat_nickname: string | null;
  chat_font: string | null;
};

type Reaction = { id: string; message_id: string; user_id: string; emoji: string };
type RenderMessage = DbMessage & { ephemeralBot?: boolean };

const OPEN_KEY = "bloxsmith.globalchat.open";

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

// Tiny safe markdown: **bold**, *italic*, `code`, links + @mentions
function renderRich(text: string, currentUserName: string | null, accent?: string | null) {
  const parts: Array<{ t: "text" | "b" | "i" | "code" | "link" | "mention" | "emote"; v: string; href?: string }> = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/\S+|@[A-Za-z0-9_]{2,32}|:[a-z][a-z0-9_]{1,24}:)/g;
  let last = 0; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: "text", v: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) parts.push({ t: "b", v: tok.slice(2, -2) });
    else if (tok.startsWith("`")) parts.push({ t: "code", v: tok.slice(1, -1) });
    else if (tok.startsWith("*")) parts.push({ t: "i", v: tok.slice(1, -1) });
    else if (tok.startsWith("@")) parts.push({ t: "mention", v: tok });
    else if (tok.startsWith(":") && tok.endsWith(":")) {
      const key = tok.slice(1, -1).toLowerCase();
      if (EMOTE_MAP[key]) parts.push({ t: "emote", v: key });
      else parts.push({ t: "text", v: tok });
    }
    else parts.push({ t: "link", v: tok, href: tok });
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ t: "text", v: text.slice(last) });
  // If the entire message is just a single emote token, render it larger.
  const onlyEmote = parts.length === 1 && parts[0].t === "emote";
  return parts.map((p, i) => {
    if (p.t === "b") return <strong key={i}>{p.v}</strong>;
    if (p.t === "i") return <em key={i}>{p.v}</em>;
    if (p.t === "code") return <code key={i} className="rounded bg-surface px-1 py-0.5 text-[0.85em] font-mono">{p.v}</code>;
    if (p.t === "link") return <a key={i} href={p.href} target="_blank" rel="noreferrer noopener" className="underline text-primary break-all">{p.v}</a>;
    if (p.t === "emote") {
      const e = EMOTE_MAP[p.v];
      return (
        <img
          key={i}
          src={e.src}
          alt={`:${e.name}:`}
          title={`:${e.name}:`}
          loading="lazy"
          className={cn(
            "inline-block align-[-0.35em] object-contain select-none",
            onlyEmote ? "h-16 w-16" : "h-6 w-6",
          )}
        />
      );
    }
    if (p.t === "mention") {
      const mine = currentUserName && p.v.slice(1).toLowerCase() === currentUserName.toLowerCase();
      return (
        <span key={i} className={cn(
          "rounded px-1 font-semibold",
          mine ? "bg-primary/30 text-primary-foreground" : "bg-primary/15 text-primary",
        )} style={!mine && accent ? { backgroundColor: `${accent}26`, color: accent } : undefined}>
          {p.v}
        </span>
      );
    }
    return <span key={i}>{p.v}</span>;
  });
}

export function GlobalChat({ inline = false }: { inline?: boolean } = {}) {
  const { user, profile, isAdmin, roles, refresh } = useAuth();
  const { prefs, update: updatePrefs } = useChatPrefs();
  const moderate = useServerFn(moderateChatMessage);

  const [open, setOpen] = useState(inline);
  const [messages, setMessages] = useState<RenderMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [authors, setAuthors] = useState<Map<string, Author>>(new Map());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [slow, setSlow] = useState(0);
  const [muted, setMuted] = useState<Date | null>(null);
  const [unread, setUnread] = useState(0);
  const [replyTo, setReplyTo] = useState<RenderMessage | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMod, setShowMod] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [localMuted, setLocalMuted] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<{ id: string; reason: string | null }[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string>("general");
  const [view, setView] = useState<"channels" | "friends">("channels");
  const [activeDm, setActiveDm] = useState<string | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [dmUnread, setDmUnread] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const presenceChanRef = useRef<any>(null);
  const lastTypingSentRef = useRef(0);

  // Open state
  useEffect(() => {
    if (typeof localStorage !== "undefined") setOpen(localStorage.getItem(OPEN_KEY) === "1");
  }, []);
  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    if (open) setUnread(0);
  }, [open]);

  // Hydrate authors
  const loadAuthors = useCallback(async (ids: string[]) => {
    const need = ids.filter((id) => id && !authors.has(id));
    if (!need.length) return;
    const [{ data: profs }, { data: rs }, { data: badges }] = await Promise.all([
      supabase.from("profiles").select(
        "id,display_name,avatar_url,chat_name_gradient,chat_text_gradient,chat_icon,chat_nickname,chat_font",
      ).in("id", need),
      (supabase as any).from("user_roles").select("user_id,role").in("user_id", need),
      (supabase as any).from("user_badges").select("user_id,badge").in("user_id", need),
    ]);
    const rolesByUser = new Map<string, Role[]>();
    ((rs ?? []) as { user_id: string; role: Role }[]).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    const badgesByUser = new Map<string, string[]>();
    ((badges ?? []) as { user_id: string; badge: string }[]).forEach((b) => {
      const arr = badgesByUser.get(b.user_id) ?? [];
      arr.push(b.badge);
      badgesByUser.set(b.user_id, arr);
    });
    setAuthors((prev) => {
      const next = new Map(prev);
      (profs ?? []).forEach((p: any) => {
        const nick = typeof p.chat_nickname === "string" && p.chat_nickname.trim() ? p.chat_nickname.trim() : null;
        next.set(p.id, {
          display_name: nick ?? p.display_name,
          avatar_url: p.avatar_url,
          roles: rolesByUser.get(p.id) ?? [],
          badges: badgesByUser.get(p.id) ?? [],
          chat_name_gradient: sanitizeGradient(p.chat_name_gradient),
          chat_text_gradient: sanitizeGradient(p.chat_text_gradient),
          chat_icon: sanitizeIcon(p.chat_icon),
          chat_nickname: nick,
          chat_font: sanitizeFont(p.chat_font),
        });
      });
      return next;
    });
  }, [authors]);

  // Initial fetch
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [msgRes, settingsRes, muteRes, reactRes, wordsRes, warnRes, localMuteRes] = await Promise.all([
        supabase.from("global_chat_messages")
          .select("id,user_id,content,created_at,deleted_at,reply_to_id,attachment_url,attachment_type,pinned_at,flagged")
          .is("deleted_at", null).order("created_at", { ascending: true }).limit(100),
        supabase.from("global_chat_settings").select("slow_mode_seconds").eq("id", 1).maybeSingle(),
        (supabase as any).from("global_chat_mutes").select("muted_until").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("global_chat_reactions").select("id,message_id,user_id,emoji").limit(500),
        (supabase as any).from("global_chat_blocked_words").select("word"),
        (supabase as any).from("global_chat_warnings").select("id,reason").eq("user_id", user.id).is("acknowledged_at", null),
        (supabase as any).from("user_chat_local_mutes").select("muted_user_id").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const rows = (msgRes.data ?? []) as DbMessage[];
      setMessages(rows);
      setSlow(((settingsRes.data as any)?.slow_mode_seconds as number) ?? 0);
      const until = (muteRes.data as any)?.muted_until ? new Date((muteRes.data as any).muted_until) : null;
      setMuted(until && until > new Date() ? until : null);
      setReactions((reactRes.data ?? []) as Reaction[]);
      setBlockedWords(((wordsRes.data ?? []) as any[]).map((w) => String(w.word).toLowerCase()));
      setWarnings((warnRes.data ?? []) as any);
      setLocalMuted(new Set(((localMuteRes.data ?? []) as any[]).map((r) => String(r.muted_user_id))));
      await loadAuthors(Array.from(new Set(rows.map((r) => r.user_id))));
    })();
    return () => { cancelled = true; };
  }, [user?.id, loadAuthors]);

  // Realtime: messages + reactions + settings + presence + typing
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("global_chat_v2", { config: { presence: { key: user.id } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "global_chat_messages" }, async (payload) => {
        const row = payload.new as DbMessage;
        if (row.deleted_at) return;
        setMessages((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row]);
        if (!open && row.user_id !== user.id) setUnread((u) => u + 1);
        await loadAuthors([row.user_id]);
        // Sound + notification
        if (row.user_id !== user.id) {
          const mentioned = mentionsMe(row.content, authors.get(user.id)?.display_name);
          if (prefs.sound_enabled && (prefs.notify_mode === "all" || (prefs.notify_mode === "mentions" && mentioned))) {
            playPing();
          }
          if (prefs.notify_mode !== "off" && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
            if (prefs.notify_mode === "all" || mentioned) {
              const a = authors.get(row.user_id);
              new Notification(a?.display_name ?? "New message", { body: row.content.slice(0, 140), silent: !prefs.sound_enabled });
            }
          }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "global_chat_messages" }, (payload) => {
        const row = payload.new as DbMessage;
        setMessages((prev) => {
          if (row.deleted_at) return prev.filter((m) => m.id !== row.id);
          return prev.map((m) => m.id === row.id ? { ...m, ...row } : m);
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "global_chat_settings" }, (payload) => {
        setSlow(((payload.new as any).slow_mode_seconds as number) ?? 0);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "global_chat_reactions" }, (payload) => {
        setReactions((prev) => [...prev, payload.new as Reaction]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "global_chat_reactions" }, (payload) => {
        const r = payload.old as Reaction;
        setReactions((prev) => prev.filter((x) => x.id !== r.id));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        setOnlineUsers(Object.keys(state));
        loadAuthors(Object.keys(state));
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const uid = (payload.payload as any)?.user_id;
        if (!uid || uid === user.id) return;
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(uid, Date.now());
          return next;
        });
      });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });
    presenceChanRef.current = channel;
    return () => { supabase.removeChannel(channel); presenceChanRef.current = null; };
  }, [user?.id, open, prefs.sound_enabled, prefs.notify_mode, loadAuthors, authors]);

  // Prune stale typing entries
  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers((prev) => {
        const cutoff = Date.now() - 4000;
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of next) if (v < cutoff) { next.delete(k); changed = true; }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  // Autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Request notification permission on first open if mode != off
  useEffect(() => {
    if (open && prefs.notify_mode !== "off" && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [open, prefs.notify_mode]);

  function playPing() {
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        audioCtxRef.current = ctx;
      }
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o.start();
      o.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  function mentionsMe(text: string, name?: string | null) {
    if (!name) return false;
    return new RegExp(`@${escapeRegex(name)}\\b`, "i").test(text);
  }

  function checkBlocked(text: string): string | null {
    if (!blockedWords.length) return null;
    const lower = text.toLowerCase();
    for (const w of blockedWords) if (w && lower.includes(w)) return w;
    return null;
  }

  function checkAllCapsSpam(text: string) {
    if (text.length < 15) return false;
    const letters = text.replace(/[^A-Za-z]/g, "");
    if (letters.length < 12) return false;
    const upper = letters.replace(/[^A-Z]/g, "").length;
    return upper / letters.length > 0.85;
  }

  async function uploadAttachment(file: File): Promise<string | null> {
    if (!user) return null;
    if (!file.type.startsWith("image/")) { toast.error("Only images are allowed"); return null; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be < 5 MB"); return null; }
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type });
    if (error) { toast.error(error.message); return null; }
    const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    return pub.publicUrl;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !pendingFile) || sending) return;

    // Slash commands
    if (trimmed.startsWith("/")) {
      setSending(true); setDraft("");
      try { await runSlashCommand(trimmed); }
      finally { setSending(false); inputRef.current?.focus(); }
      return;
    }

    setSending(true);
    try {
      // Profanity
      const bad = checkBlocked(trimmed);
      if (bad) { toast.error(`Blocked word: "${bad}"`); setSending(false); return; }
      if (checkAllCapsSpam(trimmed)) { toast.error("Please don't shout (too many CAPS)"); setSending(false); return; }

      // AI moderation (best-effort)
      if (trimmed.length > 5) {
        try {
          const verdict = await moderate({ data: { content: trimmed } });
          if (!verdict.allow) {
            toast.error(`Blocked by AI moderation: ${verdict.reason || "violates rules"}`);
            setSending(false);
            return;
          }
        } catch { /* fail open */ }
      }

      // Upload file
      let attachment_url: string | null = null;
      let attachment_type: string | null = null;
      if (pendingFile) {
        attachment_url = await uploadAttachment(pendingFile);
        if (!attachment_url) { setSending(false); return; }
        attachment_type = "image";
      }

      const { error } = await (supabase as any).rpc("send_global_chat_message_v2", {
        _content: trimmed,
        _reply_to_id: replyTo?.id ?? null,
        _attachment_url: attachment_url,
        _attachment_type: attachment_type,
      });
      if (error) {
        const m = String(error.message || "Failed to send");
        if (m.includes("slow_mode")) toast.error(`Slow mode — wait ${slow}s`);
        else if (m.includes("muted")) toast.error("You're muted");
        else if (m.includes("duplicate")) toast.error("That looks like a duplicate");
        else if (m.includes("too_long")) toast.error("Message is too long");
        else toast.error(m);
        setDraft(trimmed);
      } else {
        setDraft(""); setReplyTo(null); setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function runSlashCommand(text: string) {
    const m = text.match(/^\/(\w+)(?:\s+(.*))?$/s);
    if (!m) return;
    const cmd = m[1].toLowerCase();
    const args = (m[2] ?? "").trim();
    const findMention = (input: string) => {
      const mm = input.match(/@([A-Za-z0-9_ .-]{2,40})/);
      const q = mm?.[1]?.trim().toLowerCase();
      if (!q) return null;
      for (const [id, a] of authors) if (a.display_name?.toLowerCase() === q) return { id, name: a.display_name };
      return null;
    };
    const staffOnly = () => {
      if (!isAdmin) { toast.error("Owner/staff command only"); return false; }
      return true;
    };
    if (cmd === "help") {
      pushEphemeralBot([
        "BloxBot commands:",
        "/rules, /credits, /daily, /profile, /badges, /rank, /project, /publish, /plugin, /models, /updates",
        "/report @user reason, /mute @user, /follow @user, /friend @user, /dm @user message, /online, /staff",
        "/me <action>, /shrug, /clear-mine",
        ...(isAdmin ? ["Staff: /announce, /givecredits, /takecredits, /badge, /role, /warn, /timeout, /ban, /unban, /feature, /changelog, /slow, /clear"] : []),
      ].join("\n"));
      return;
    }
    if (cmd === "rules") { pushEphemeralBot("Rules: be kind, keep it Roblox/BloxSmith related, no spam, no harassment, no NSFW, no scams, and follow staff directions."); return; }
    if (cmd === "credits") { pushEphemeralBot(`Credit balance: ${roles.includes("owner") ? "unlimited (owner)" : `${profile?.credits ?? 0} credits`}.`); return; }
    if (cmd === "daily") { const { data, error } = await (supabase as any).rpc("claim_daily_credits"); if (error) toast.error(error.message); else { await refresh(); pushEphemeralBot((data as any)?.claimed ? `Daily claimed: +${(data as any).amount} credits. Balance: ${(data as any).credits}.` : "Daily already claimed today."); } return; }
    if (cmd === "profile") { pushEphemeralBot(`Profile: ${profile?.display_name ?? user?.email ?? "Builder"}\nRank: ${roles.join(", ") || "user"}\nCredits: ${profile?.credits ?? 0}`); return; }
    if (cmd === "badges") { pushEphemeralBot(`Badges: ${(authors.get(user!.id)?.badges ?? []).join(", ") || "none yet"}.`); return; }
    if (cmd === "rank") { pushEphemeralBot(`Rank: ${roles.includes("owner") ? "Owner" : roles.includes("admin") ? "Staff/Admin" : "Member"}.`); return; }
    if (cmd === "project") { const id = location.pathname.match(/\/project\/([^/]+)/)?.[1]; pushEphemeralBot(id ? `Current project ID: ${id}` : "Open a project page to see current project info."); return; }
    if (cmd === "publish") { pushEphemeralBot("To publish: open a project, polish the build, use the project publish/showcase controls, add a title/description/thumbnail, then submit it to Published Creations."); return; }
    if (cmd === "plugin") { pushEphemeralBot("Plugin setup: open /plugin, install the Roblox Studio plugin, sign in, copy/connect your token, then use Sync in Studio to pull BloxSmith commands."); return; }
    if (cmd === "models") { pushEphemeralBot("AI features: Roblox game builder, Luau scripting, UI Generator, image/clothing generation, toolbox assets, project planning, fixes, and plugin sync."); return; }
    if (cmd === "updates") { pushEphemeralBot("Latest update: auth/session cleanup, AI Help removed, Global Chat kept, and BloxBot command upgrades. Open /changelog for the full list."); return; }
    if (["report", "mute", "follow", "friend", "dm"].includes(cmd)) {
      const target = findMention(args); if (!target) { pushEphemeralBot("I couldn't find that @user in this chat session."); return; }
      const rest = args.replace(/@([A-Za-z0-9_ .-]{2,40})/, "").trim();
      if (cmd === "report") { const { error } = await (supabase as any).rpc("report_chat_user", { _reported_user_id: target.id, _reason: rest || "Reported from BloxBot" }); if (error) toast.error(error.message); else toast.success("Report sent"); return; }
      if (cmd === "mute") { await (supabase as any).from("user_chat_local_mutes").upsert({ user_id: user!.id, muted_user_id: target.id }); setLocalMuted((s) => new Set([...s, target.id])); pushEphemeralBot(`${target.name} muted locally.`); return; }
      if (cmd === "follow") { const { error } = await (supabase as any).from("user_follows").upsert({ follower_id: user!.id, following_id: target.id }); if (error) toast.error(error.message); else pushEphemeralBot(`You now follow ${target.name}.`); return; }
      if (cmd === "friend") { const { error } = await (supabase as any).from("friend_requests").upsert({ requester_id: user!.id, addressee_id: target.id, status: "pending" }); if (error) toast.error(error.message); else pushEphemeralBot(`Friend request sent to ${target.name}.`); return; }
      if (cmd === "dm") { const { error } = await (supabase as any).from("direct_messages").insert({ sender_id: user!.id, recipient_id: target.id, content: rest || "👋" }); if (error) toast.error(error.message); else pushEphemeralBot(`DM sent to ${target.name}.`); return; }
    }
    if (cmd === "online") { pushEphemeralBot(`Online: ${onlineUsers.map((id) => authors.get(id)?.display_name ?? id.slice(0, 6)).join(", ") || "none"}.`); return; }
    if (cmd === "staff") { pushEphemeralBot(`Staff online: ${onlineUsers.filter((id) => authors.get(id)?.roles.some((r) => r === "owner" || r === "admin")).map((id) => authors.get(id)?.display_name ?? "Staff").join(", ") || "none visible"}.`); return; }
    if (cmd === "announce") { if (!staffOnly()) return; const { error } = await (supabase as any).rpc("admin_chat_announce", { _content: args }); if (error) toast.error(error.message); return; }
    if (["givecredits", "takecredits", "badge", "role", "warn", "timeout", "ban", "unban"].includes(cmd)) { if (!staffOnly()) return; const target = findMention(args); if (!target) return toast.error("Use @user"); const rest = args.replace(/@([A-Za-z0-9_ .-]{2,40})/, "").trim(); const [first, ...tail] = rest.split(/\s+/); const reason = tail.join(" ") || "BloxBot staff command";
      if (cmd === "givecredits" || cmd === "takecredits") { const amount = Math.abs(parseInt(first, 10)); if (!amount) return toast.error("Enter amount"); const { error } = await (supabase as any).rpc("admin_adjust_credits", { _user_id: target.id, _amount: cmd === "takecredits" ? -amount : amount, _reason: reason }); if (error) toast.error(error.message); else toast.success("Credits updated"); return; }
      if (cmd === "badge") { const { error } = await (supabase as any).rpc("admin_grant_badge", { _user_id: target.id, _badge: first }); if (error) toast.error(error.message); else toast.success("Badge granted"); return; }
      if (cmd === "role") { const role = first === "owner" ? "admin" : first; const { error } = await (supabase as any).rpc("admin_set_role", { _user_id: target.id, _role: role, _grant: true }); if (error) toast.error(error.message); else toast.success("Role updated"); return; }
      if (cmd === "warn") { const { error } = await (supabase as any).rpc("admin_chat_warn", { _user_id: target.id, _reason: rest || "Warning" }); if (error) toast.error(error.message); else toast.success("Warned"); return; }
      if (cmd === "timeout") { const minutes = parseInt(first, 10) || 5; await muteUser(target.id, minutes, reason); return; }
      if (cmd === "ban" || cmd === "unban") { const { error } = await (supabase as any).rpc("admin_set_ban", { _user_id: target.id, _banned: cmd === "ban", _reason: reason }); if (error) toast.error(error.message); else toast.success(cmd === "ban" ? "Banned" : "Unbanned"); return; }
    }
    if (cmd === "feature") { if (!staffOnly()) return; const { error } = await (supabase as any).rpc("admin_feature_project", { _project_id: args }); if (error) toast.error(error.message); else toast.success("Project featured"); return; }
    if (cmd === "changelog") { if (!staffOnly()) return; const { error } = await (supabase as any).rpc("admin_quick_changelog", { _message: args }); if (error) toast.error(error.message); else toast.success("Changelog note added"); return; }
    if (cmd === "me") { await sendRaw(`_${args || "…"}_`); return; }
    if (cmd === "shrug") { await sendRaw(`¯\\_(ツ)_/¯ ${args}`); return; }
    if (cmd === "clear-mine") {
      const { error } = await supabase.from("global_chat_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", user!.id).is("deleted_at", null);
      if (error) toast.error(error.message); else toast.success("Your messages cleared");
      return;
    }
    if (cmd === "slow") {
      if (!isAdmin) return toast.error("Admins only");
      const n = parseInt(args, 10);
      if (Number.isNaN(n) || n < 0 || n > 3600) return toast.error("Usage: /slow 0-3600");
      const { error } = await (supabase as any).rpc("admin_chat_set_slow_mode", { _seconds: n });
      if (error) toast.error(error.message); else toast.success(n === 0 ? "Slow mode off" : `Slow mode: ${n}s`);
      return;
    }
    if (cmd === "clear") {
      if (!isAdmin) return toast.error("Admins only");
      const { error } = await (supabase as any).rpc("admin_chat_clear_all");
      if (error) toast.error(error.message); else { setMessages([]); toast.success("Chat cleared"); }
      return;
    }
    pushEphemeralBot(`Unknown command: /${cmd}. Try /help`);
  }

  async function sendRaw(content: string) {
    await (supabase as any).rpc("send_global_chat_message_v2", { _content: content });
  }

  function pushEphemeralBot(content: string) {
    setMessages((prev) => [...prev, {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      user_id: "bloxbot", content, created_at: new Date().toISOString(),
      deleted_at: null, reply_to_id: null, attachment_url: null, attachment_type: null,
      pinned_at: null, flagged: false, ephemeralBot: true,
    }]);
  }

  async function deleteMessage(id: string) {
    const { error } = await (supabase as any).rpc("admin_chat_delete_message", { _message_id: id });
    if (error) toast.error(error.message);
  }
  async function muteUser(uid: string, minutes: number | null, reason: string) {
    const { error } = await (supabase as any).rpc("admin_chat_mute", { _user_id: uid, _minutes: minutes, _reason: reason });
    if (error) toast.error(error.message); else toast.success(minutes ? `Muted ${minutes}m` : "Muted permanently");
  }
  async function unmuteUser(uid: string) {
    const { error } = await (supabase as any).rpc("admin_chat_unmute", { _user_id: uid });
    if (error) toast.error(error.message); else toast.success("Unmuted");
  }
  async function pinMessage(id: string, pin: boolean) {
    const { error } = await (supabase as any).rpc("admin_chat_pin_message", { _message_id: id, _pin: pin });
    if (error) toast.error(error.message); else toast.success(pin ? "Pinned" : "Unpinned");
  }
  async function warnUser(uid: string) {
    const reason = window.prompt("Warning reason?");
    if (!reason) return;
    const { error } = await (supabase as any).rpc("admin_chat_warn", { _user_id: uid, _reason: reason });
    if (error) toast.error(error.message); else toast.success("Warning sent");
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const mine = reactions.find((r) => r.message_id === messageId && r.user_id === user!.id && r.emoji === emoji);
    if (mine) {
      await (supabase as any).from("global_chat_reactions").delete().eq("id", mine.id);
    } else {
      await (supabase as any).from("global_chat_reactions").insert({ message_id: messageId, user_id: user!.id, emoji });
    }
  }

  async function reportMessage(m: RenderMessage) {
    const reason = window.prompt("Why are you reporting this?");
    if (reason === null) return;
    const { error } = await (supabase as any).from("global_chat_reports").insert({
      message_id: m.id, reported_user_id: m.user_id, reporter_id: user!.id, reason,
    });
    if (error) {
      if (error.code === "23505") toast.error("You already reported this message");
      else toast.error(error.message);
    } else toast.success("Reported — thanks");
  }

  async function ackWarning(id: string) {
    await (supabase as any).from("global_chat_warnings").update({ acknowledged_at: new Date().toISOString() }).eq("id", id);
    setWarnings((w) => w.filter((x) => x.id !== id));
  }

  function onDraftChange(v: string) {
    setDraft(v);
    // mention detection
    const at = v.lastIndexOf("@");
    if (at >= 0) {
      const tail = v.slice(at + 1);
      if (/^[A-Za-z0-9_]*$/.test(tail) && tail.length <= 24) setMentionQuery(tail);
      else setMentionQuery(null);
    } else setMentionQuery(null);
    // typing broadcast (throttled)
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000 && presenceChanRef.current) {
      lastTypingSentRef.current = now;
      presenceChanRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user!.id } }).catch(() => {});
    }
  }

  function applyMention(name: string) {
    const at = draft.lastIndexOf("@");
    if (at < 0) return;
    setDraft(draft.slice(0, at) + "@" + name + " ");
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(draft);
  }

  const myRoles = useMemo(() => roles as Role[], [roles]);
  const myName = user ? authors.get(user.id)?.display_name ?? null : null;
  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const pinned = useMemo(() => messages.filter((m) => m.pinned_at).slice(-3), [messages]);
  const accent = prefs.theme_accent;

  // Mention suggestions
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [] as { id: string; name: string }[];
    const q = mentionQuery.toLowerCase();
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    for (const [id, a] of authors) {
      const n = a.display_name;
      if (!n || seen.has(id)) continue;
      if (q === "" || n.toLowerCase().includes(q)) { out.push({ id, name: n }); seen.add(id); }
      if (out.length >= 5) break;
    }
    return out;
  }, [mentionQuery, authors]);

  if (!user) return null;

  return (
    <>
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
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[9999] flex h-[min(82dvh,720px)] max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated/98 shadow-2xl backdrop-blur-xl md:inset-x-auto md:left-5 md:right-auto md:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] md:h-[min(720px,calc(100dvh-2.5rem))] md:w-[480px] lg:w-[540px]"
          style={{
            ...(chatBackgroundStyle(prefs) ?? {}),
            ...(accent ? ({ ["--chat-accent" as any]: accent } as React.CSSProperties) : {}),
          }}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15" style={accent ? { background: `${accent}22`} : undefined}>
                <MessagesSquare className="h-4 w-4 text-primary" style={accent ? { color: accent } : undefined} />
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
                  <button type="button" onClick={() => setShowUsers((v) => !v)} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Users className="h-3 w-3" /> {onlineUsers.length} online
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => setShowSettings(true)} aria-label="Settings"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground">
                <Settings2 className="h-4 w-4" />
              </button>
              {isAdmin && (
                <button type="button" onClick={() => setShowMod(true)} aria-label="Moderation"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground">
                  <Shield className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Warnings banner */}
          {warnings.map((w) => (
            <div key={w.id} className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Moderator warning</div>
                <div className="text-amber-200/90">{w.reason || "Please review the chat rules."}</div>
              </div>
              <button type="button" onClick={() => ackWarning(w.id)} className="rounded border border-amber-400/40 px-2 py-0.5 text-[11px] hover:bg-amber-500/20">OK</button>
            </div>
          ))}

          {/* Pinned bar */}
          {pinned.length > 0 && (
            <div className="border-b border-border bg-primary/5 px-3 py-1.5">
              {pinned.map((p) => {
                const a = authors.get(p.user_id);
                return (
                  <div key={p.id} className="flex items-center gap-1.5 text-[11px]">
                    <Pin className="h-3 w-3 text-primary shrink-0" />
                    <span className="font-semibold">{a?.display_name ?? "User"}:</span>
                    <span className="truncate text-muted-foreground">{p.content}</span>
                    {isAdmin && (
                      <button type="button" onClick={() => pinMessage(p.id, false)} className="ml-auto text-muted-foreground hover:text-destructive">
                        <PinOff className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Online users dropdown */}
          {showUsers && (
            <div className="border-b border-border bg-background/40 px-3 py-2 text-xs">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Online ({onlineUsers.length})</div>
              <div className="flex flex-wrap gap-1">
                {onlineUsers.map((id) => {
                  const a = authors.get(id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {a?.display_name ?? id.slice(0, 6)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-3", densityClass(prefs.density))}>
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground">No messages yet — say hi!</p>
            )}
            {messages.map((m) => {
              const isMe = m.user_id === user.id;
              const isBot = m.ephemeralBot;
              const author = !isBot ? authors.get(m.user_id) : null;
              const name = isBot ? "BloxBot" : author?.display_name || (isMe ? "You" : "User");
              const replyTarget = m.reply_to_id ? messagesById.get(m.reply_to_id) : null;
              const replyAuthor = replyTarget ? authors.get(replyTarget.user_id) : null;
              const msgReacts = reactions.filter((r) => r.message_id === m.id);
              const grouped = new Map<string, { count: number; mine: boolean }>();
              for (const r of msgReacts) {
                const g = grouped.get(r.emoji) ?? { count: 0, mine: false };
                g.count++; if (r.user_id === user.id) g.mine = true;
                grouped.set(r.emoji, g);
              }
              return (
                <div key={m.id} className="group flex gap-2">
                  <div className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                    isBot ? "bg-gradient-to-br from-primary/30 to-primary/10 text-primary" : "bg-surface text-muted-foreground",
                  )}>
                    {isBot ? <Bot className="h-4 w-4" />
                      : author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      : name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {replyTarget && (
                      <div className="mb-1 flex items-center gap-1 rounded-md border-l-2 border-primary/50 bg-surface/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                        <Reply className="h-2.5 w-2.5" />
                        <span className="font-semibold">{replyAuthor?.display_name ?? "User"}:</span>
                        <span className="truncate">{replyTarget.content || "(image)"}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isBot && author?.chat_icon && CHAT_ICON_MAP[author.chat_icon] ? (() => {
                        const Ico = CHAT_ICON_MAP[author.chat_icon!];
                        const stops = author.chat_name_gradient;
                        return <Ico className="h-3.5 w-3.5 shrink-0" style={stops?.length ? { color: stops[0] } : undefined} aria-hidden />;
                      })() : null}
                      <span className="truncate text-xs font-semibold" style={!isBot ? { ...gradientTextStyle(author?.chat_name_gradient), ...chatFontStyle(author?.chat_font) } : undefined}>
                        {name}
                      </span>
                      {isBot ? (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">BOT</span>
                      ) : (author && <RoleBadges roles={author.roles} size="sm" showLabel={false} />)}
                      <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                      {m.pinned_at && <Pin className="h-2.5 w-2.5 text-primary" />}
                      {isBot && <span className="text-[10px] text-muted-foreground">· only you see this</span>}
                      {!isBot && (
                        <MsgActions
                          isAdmin={!!isAdmin}
                          isSelf={isMe}
                          pinned={!!m.pinned_at}
                          onReply={() => { setReplyTo(m); inputRef.current?.focus(); }}
                          onReact={(e) => toggleReaction(m.id, e)}
                          onReport={() => reportMessage(m)}
                          onDelete={() => deleteMessage(m.id)}
                          onMute={(min) => muteUser(m.user_id, min, "via chat")}
                          onUnmute={() => unmuteUser(m.user_id)}
                          onPin={() => pinMessage(m.id, !m.pinned_at)}
                          onWarn={() => warnUser(m.user_id)}
                        />
                      )}
                    </div>
                    {m.content && (
                      <div className={cn("mt-0.5 break-words leading-relaxed whitespace-pre-wrap text-foreground", fontSizeClass(prefs.font_size))}
                        style={!isBot ? { ...gradientTextStyle(author?.chat_text_gradient), ...chatFontStyle(author?.chat_font) } : undefined}>
                        {renderRich(m.content, myName, accent)}
                      </div>
                    )}
                    {m.attachment_url && m.attachment_type === "image" && (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer noopener" className="mt-1 block">
                        <img src={m.attachment_url} alt="attachment" className="max-h-60 rounded-lg border border-border object-cover" />
                      </a>
                    )}
                    {grouped.size > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Array.from(grouped.entries()).map(([emoji, g]) => (
                          <button key={emoji} type="button" onClick={() => toggleReaction(m.id, emoji)}
                            className={cn("flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]",
                              g.mine ? "border-primary/50 bg-primary/15" : "border-border bg-surface/50 hover:bg-surface")}>
                            <span>{emoji}</span><span className="text-muted-foreground">{g.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {typingUsers.size > 0 && (
              <div className="text-[11px] italic text-muted-foreground">
                {Array.from(typingUsers.keys()).slice(0, 3).map((id) => authors.get(id)?.display_name ?? "Someone").join(", ")} typing…
              </div>
            )}
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="flex items-center gap-2 border-t border-border bg-surface/40 px-3 py-1.5 text-[11px]">
              <Reply className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground">Replying to <strong className="text-foreground">{authors.get(replyTo.user_id)?.display_name ?? "User"}</strong>: {replyTo.content.slice(0, 60)}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
            </div>
          )}

          {/* File preview */}
          {pendingFile && (
            <div className="flex items-center gap-2 border-t border-border bg-surface/40 px-3 py-1.5 text-[11px]">
              <ImageIcon className="h-3 w-3 text-primary" />
              <span className="truncate text-muted-foreground">{pendingFile.name} · {Math.round(pendingFile.size / 1024)} KB</span>
              <button type="button" onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value=""; }} className="ml-auto text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
            </div>
          )}

          <form onSubmit={onSubmit} className="relative shrink-0 border-t border-border p-2">
            {/* Mention suggestions */}
            {mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-2 right-2 mb-1 overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-xl">
                {mentionSuggestions.map((s) => (
                  <button key={s.id} type="button" onClick={() => applyMention(s.name)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-surface">
                    <AtSign className="h-3 w-3 text-primary" /> {s.name}
                  </button>
                ))}
              </div>
            )}

            {muted && (
              <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                <ShieldAlert className="h-3 w-3" />
                You're muted until {muted.toLocaleString()}.
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach image"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground" disabled={!!muted}>
                <ImageIcon className="h-4 w-4" />
              </button>
              <EmojiPicker onPick={(em) => { setDraft((d) => d + em); inputRef.current?.focus(); }} />
              <EmotePicker onPick={(tok) => { setDraft((d) => d + (d && !d.endsWith(" ") ? " " : "") + tok + " "); inputRef.current?.focus(); }} />
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); }
                  else if (e.key === "Escape") { setReplyTo(null); setMentionQuery(null); }
                }}
                placeholder={muted ? "You're muted" : "Message everyone… (@ to mention, / for commands)"}
                disabled={!!muted || sending} maxLength={500} rows={2}
                className={cn("max-h-32 min-h-[44px] min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border border-border bg-background/60 px-2.5 py-2 leading-relaxed focus:border-primary/50 focus:outline-none disabled:opacity-50 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border", fontSizeClass(prefs.font_size), chatFontStyle(profile?.chat_font) && "")}
                style={chatFontStyle(profile?.chat_font)}
              />
              <button type="submit" disabled={sending || (!draft.trim() && !pendingFile) || !!muted} aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                style={accent ? { background: accent } : undefined}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>You as <RoleBadges roles={myRoles} size="sm" showLabel /> · {draft.length}/500</span>
              {slow > 0 && !isAdmin && <span>Slow mode {slow}s</span>}
            </div>
          </form>

          {showSettings && <ChatSettingsPanel prefs={prefs} onChange={updatePrefs} onClose={() => setShowSettings(false)} />}
          {showMod && isAdmin && <ChatModerationPanel onClose={() => setShowMod(false)} onDeleteMessage={deleteMessage} />}
        </aside>
      )}
    </>
  );
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function MsgActions({
  isAdmin, isSelf, pinned,
  onReply, onReact, onReport, onDelete, onMute, onUnmute, onPin, onWarn,
}: {
  isAdmin: boolean; isSelf: boolean; pinned: boolean;
  onReply: () => void; onReact: (e: string) => void; onReport: () => void;
  onDelete: () => void; onMute: (min: number | null) => void; onUnmute: () => void;
  onPin: () => void; onWarn: () => void;
}) {
  const [more, setMore] = useState(false);
  const [pickReact, setPickReact] = useState(false);
  useEffect(() => {
    if (!more && !pickReact) return;
    const close = () => { setMore(false); setPickReact(false); };
    setTimeout(() => window.addEventListener("click", close, { once: true }), 0);
    return () => window.removeEventListener("click", close);
  }, [more, pickReact]);
  return (
    <div className="relative ml-auto flex items-center opacity-0 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setPickReact((v) => !v)} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground" aria-label="React">
        <span className="text-xs">😊</span>
      </button>
      {pickReact && (
        <div className="absolute right-0 top-7 z-50 flex gap-0.5 rounded-lg border border-border bg-surface-elevated p-1 shadow-xl">
          {QUICK_REACTIONS.map((e) => (
            <button key={e} type="button" onClick={() => { onReact(e); setPickReact(false); }}
              className="grid h-7 w-7 place-items-center rounded text-base hover:bg-surface">{e}</button>
          ))}
        </div>
      )}
      <button type="button" onClick={onReply} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground" aria-label="Reply">
        <Reply className="h-3 w-3" />
      </button>
      <button type="button" onClick={() => setMore((v) => !v)} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface hover:text-foreground" aria-label="More">
        <MoreVertical className="h-3 w-3" />
      </button>
      {more && (
        <div className="absolute right-0 top-7 z-50 w-44 overflow-hidden rounded-lg border border-border bg-surface-elevated text-xs shadow-xl">
          {!isSelf && (
            <button type="button" onClick={() => { onReport(); setMore(false); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface">
              <Flag className="h-3 w-3" /> Report
            </button>
          )}
          {isAdmin && (
            <>
              <button type="button" onClick={() => { onPin(); setMore(false); }} className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface">
                {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />} {pinned ? "Unpin" : "Pin"}
              </button>
              <button type="button" onClick={() => { onDelete(); setMore(false); }} className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
              {!isSelf && (
                <>
                  <button type="button" onClick={() => { onWarn(); setMore(false); }} className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface">
                    <ShieldAlert className="h-3 w-3" /> Warn
                  </button>
                  <button type="button" onClick={() => { onMute(5); setMore(false); }} className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface">
                    <VolumeX className="h-3 w-3" /> Mute 5m
                  </button>
                  <button type="button" onClick={() => { onMute(60); setMore(false); }} className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface">
                    <VolumeX className="h-3 w-3" /> Mute 1h
                  </button>
                  <button type="button" onClick={() => { onMute(null); setMore(false); }} className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface">
                    <VolumeX className="h-3 w-3" /> Mute perm
                  </button>
                  <button type="button" onClick={() => { onUnmute(); setMore(false); }} className="flex w-full items-center gap-2 border-t border-border px-2.5 py-1.5 text-left hover:bg-surface">
                    <Volume2 className="h-3 w-3" /> Unmute
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

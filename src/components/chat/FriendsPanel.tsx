import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Check, X, Send, MessageCircle, UserPlus, Search, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FriendRow = { id: string; requester_id: string; addressee_id: string; status: string };
type ProfileLite = { id: string; display_name: string | null; chat_nickname: string | null; avatar_url: string | null };
type DM = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string; read_at: string | null };

export function FriendsPanel({
  activeDm,
  setActiveDm,
  onOpenProfile,
}: {
  activeDm: string | null;
  setActiveDm: (uid: string | null) => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
  const [searching, setSearching] = useState(false);

  // Initial load
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("friend_requests")
        .select("id,requester_id,addressee_id,status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      if (cancel || !data) return;
      const rows = data as FriendRow[];
      setRequests(rows);
      const ids = Array.from(new Set(rows.flatMap((r) => [r.requester_id, r.addressee_id]).filter((id) => id !== user.id)));
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id,display_name,chat_nickname,avatar_url")
          .in("id", ids);
        if (ps) setProfiles(new Map((ps as ProfileLite[]).map((p) => [p.id, p])));
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id]);

  // Realtime friendship updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`fr_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, (payload) => {
        const row = (payload.new ?? payload.old) as FriendRow;
        if (row.requester_id !== user.id && row.addressee_id !== user.id) return;
        setRequests((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== row.id);
          const idx = prev.findIndex((r) => r.id === row.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = row;
            return next;
          }
          return [...prev, row];
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const friends = useMemo(
    () =>
      requests
        .filter((r) => r.status === "accepted")
        .map((r) => (r.requester_id === user?.id ? r.addressee_id : r.requester_id)),
    [requests, user?.id],
  );
  const incoming = useMemo(
    () => requests.filter((r) => r.status === "pending" && r.addressee_id === user?.id),
    [requests, user?.id],
  );
  const outgoing = useMemo(
    () => requests.filter((r) => r.status === "pending" && r.requester_id === user?.id),
    [requests, user?.id],
  );

  async function runSearch(q: string) {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,chat_nickname,avatar_url")
      .or(`display_name.ilike.%${q}%,chat_nickname.ilike.%${q}%`)
      .neq("id", user?.id ?? "")
      .limit(8);
    setSearchResults((data ?? []) as ProfileLite[]);
    setSearching(false);
  }

  async function sendRequest(targetId: string) {
    const { error } = await (supabase as any).rpc("send_friend_request", { _target: targetId });
    if (error) return toast.error(error.message);
    toast.success("Friend request sent");
    setSearch("");
    setSearchResults([]);
  }
  async function respond(id: string, accept: boolean) {
    const { error } = await (supabase as any).rpc("respond_friend_request", { _id: id, _accept: accept });
    if (error) toast.error(error.message);
  }

  function nameFor(id: string) {
    const p = profiles.get(id);
    return p?.chat_nickname || p?.display_name || id.slice(0, 8);
  }

  if (activeDm) {
    return <DmView otherId={activeDm} otherName={nameFor(activeDm)} onBack={() => setActiveDm(null)} onOpenProfile={onOpenProfile} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search */}
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Find people by name…"
            className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary"
          />
        </div>
        {search && (
          <div className="mt-2 space-y-1">
            {searching ? (
              <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : searchResults.length === 0 ? (
              <p className="px-2 py-1 text-[11px] text-muted-foreground">No matches.</p>
            ) : (
              searchResults.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
                  <Avatar p={p} />
                  <button onClick={() => onOpenProfile(p.id)} className="flex-1 truncate text-left text-xs font-medium hover:underline">
                    {p.chat_nickname || p.display_name || "User"}
                  </button>
                  <button onClick={() => sendRequest(p.id)} className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90" title="Add friend">
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2 text-xs">
        {incoming.length > 0 && (
          <Section title={`Incoming (${incoming.length})`}>
            {incoming.map((r) => (
              <Row
                key={r.id}
                left={<><Avatar p={profiles.get(r.requester_id)} /><button onClick={() => onOpenProfile(r.requester_id)} className="truncate text-left hover:underline">{nameFor(r.requester_id)}</button></>}
                right={
                  <>
                    <button onClick={() => respond(r.id, true)} className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-white hover:opacity-90" title="Accept">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => respond(r.id, false)} className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface" title="Decline">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                }
              />
            ))}
          </Section>
        )}

        {outgoing.length > 0 && (
          <Section title={`Sent (${outgoing.length})`}>
            {outgoing.map((r) => (
              <Row
                key={r.id}
                left={<><Avatar p={profiles.get(r.addressee_id)} /><span className="truncate text-muted-foreground">{nameFor(r.addressee_id)}</span></>}
                right={<span className="text-[10px] text-muted-foreground">pending</span>}
              />
            ))}
          </Section>
        )}

        <Section title={`Friends (${friends.length})`}>
          {friends.length === 0 ? (
            <p className="px-1 py-2 text-[11px] text-muted-foreground">No friends yet. Search above to find people.</p>
          ) : (
            friends.map((id) => (
              <Row
                key={id}
                left={<><Avatar p={profiles.get(id)} /><button onClick={() => onOpenProfile(id)} className="truncate text-left hover:underline">{nameFor(id)}</button></>}
                right={
                  <button onClick={() => setActiveDm(id)} className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90" title="Message">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                }
              />
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      <div className="flex shrink-0 items-center gap-1">{right}</div>
    </div>
  );
}

function Avatar({ p }: { p?: ProfileLite }) {
  if (!p) return <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[9px] text-muted-foreground">?</div>;
  return p.avatar_url ? (
    <img src={p.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
  ) : (
    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[9px] font-bold text-muted-foreground">
      {(p.chat_nickname || p.display_name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function DmView({
  otherId,
  otherName,
  onBack,
  onOpenProfile,
}: {
  otherId: string;
  otherName: string;
  onBack: () => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DM[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("direct_messages")
        .select("id,sender_id,recipient_id,content,created_at,read_at")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancel) return;
      setMessages((data ?? []) as DM[]);
      // Mark inbound as read
      await (supabase as any)
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", otherId)
        .eq("recipient_id", user.id)
        .is("read_at", null);
    })();
    const ch = supabase
      .channel(`dm_${user.id}_${otherId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const row = payload.new as DM;
        const isMine = (row.sender_id === user.id && row.recipient_id === otherId) || (row.sender_id === otherId && row.recipient_id === user.id);
        if (!isMine) return;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        if (row.sender_id === otherId) {
          (supabase as any).from("direct_messages").update({ read_at: new Date().toISOString() }).eq("id", row.id);
        }
      })
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id, otherId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t || sending || !user) return;
    setSending(true);
    const { error } = await (supabase as any)
      .from("direct_messages")
      .insert({ sender_id: user.id, recipient_id: otherId, content: t.slice(0, 2000) });
    setSending(false);
    if (error) return toast.error(error.message);
    setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2">
        <button onClick={onBack} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button onClick={() => onOpenProfile(otherId)} className="truncate text-sm font-bold hover:underline">
          {otherName}
        </button>
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 text-sm">
        {messages.length === 0 && <p className="text-xs text-muted-foreground">No messages yet — say hi!</p>}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-1.5 text-sm leading-relaxed", mine ? "bg-primary text-primary-foreground" : "bg-surface")}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div className={cn("mt-0.5 text-[9px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex shrink-0 items-end gap-1.5 border-t border-border p-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as FormEvent);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={`Message ${otherName}…`}
          className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-border bg-background/60 px-2.5 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

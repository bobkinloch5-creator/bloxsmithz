import { useEffect, useState } from "react";
import { Shield, X, Plus, Trash2, FileText, Flag, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tab = "reports" | "words" | "audit";

export function ChatModerationPanel({
  onClose,
  onDeleteMessage,
}: {
  onClose: () => void;
  onDeleteMessage: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("reports");
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-surface-elevated/98 backdrop-blur-xl">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <h2 className="text-sm font-bold">Moderation</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <nav className="flex shrink-0 border-b border-border">
        {[
          { id: "reports" as Tab, l: "Reports", icon: Flag },
          { id: "words" as Tab, l: "Words", icon: FileText },
          { id: "audit" as Tab, l: "Audit", icon: History },
        ].map((t) => {
          const Ico = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium ${
                tab === t.id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Ico className="h-3.5 w-3.5" /> {t.l}
            </button>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "reports" && <ReportsTab onDeleteMessage={onDeleteMessage} />}
        {tab === "words" && <WordsTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

function ReportsTab({ onDeleteMessage }: { onDeleteMessage: (id: string) => Promise<void> }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("global_chat_reports")
      .select("id,message_id,reported_user_id,reporter_id,reason,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  async function resolve(id: string) {
    const { error } = await (supabase as any)
      .from("global_chat_reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Resolved");
      load();
    }
  }
  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (!items.length) return <p className="text-xs text-muted-foreground">No reports — quiet on the western front.</p>;
  return (
    <ul className="space-y-2 text-xs">
      {items.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-background/40 p-2">
          <div className="flex items-center justify-between">
            <span className={r.status === "open" ? "text-amber-400" : "text-muted-foreground"}>
              {r.status}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 break-words">{r.reason || <em>no reason</em>}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">msg: {r.message_id.slice(0, 8)}</p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={async () => {
                await onDeleteMessage(r.message_id);
                await resolve(r.id);
              }}
              className="rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive hover:bg-destructive/20"
            >
              Delete msg
            </button>
            {r.status === "open" && (
              <button
                type="button"
                onClick={() => resolve(r.id)}
                className="rounded border border-border px-2 py-0.5 hover:bg-surface"
              >
                Dismiss
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function WordsTab() {
  const [items, setItems] = useState<{ id: string; word: string; severity: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [severity, setSeverity] = useState("block");
  async function load() {
    const { data } = await (supabase as any)
      .from("global_chat_blocked_words")
      .select("id,word,severity")
      .order("word");
    setItems(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);
  async function add() {
    const w = draft.trim().toLowerCase();
    if (!w) return;
    const { error } = await (supabase as any)
      .from("global_chat_blocked_words")
      .insert({ word: w, severity });
    if (error) toast.error(error.message);
    else {
      setDraft("");
      load();
    }
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from("global_chat_blocked_words").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }
  return (
    <div className="space-y-2 text-xs">
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="word or phrase"
          className="flex-1 rounded border border-border bg-background/60 px-2 py-1"
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded border border-border bg-background/60 px-1 py-1"
        >
          <option value="block">Block</option>
          <option value="warn">Warn</option>
        </select>
        <button
          type="button"
          onClick={add}
          className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between rounded border border-border bg-background/40 px-2 py-1">
            <span>
              <span className="font-mono">{i.word}</span>{" "}
              <span className="text-[10px] text-muted-foreground">· {i.severity}</span>
            </span>
            <button type="button" onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
        {!items.length && <p className="text-muted-foreground">No words yet.</p>}
      </ul>
    </div>
  );
}

function AuditTab() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("global_chat_audit")
        .select("id,actor_id,action,target_user_id,target_message_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      setItems(data ?? []);
    })();
  }, []);
  if (!items.length) return <p className="text-xs text-muted-foreground">No mod actions yet.</p>;
  return (
    <ul className="space-y-1 text-[11px]">
      {items.map((a) => (
        <li key={a.id} className="rounded border border-border bg-background/40 px-2 py-1">
          <div className="flex justify-between">
            <span className="font-semibold">{a.action}</span>
            <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
          </div>
          <div className="text-muted-foreground">
            actor {a.actor_id.slice(0, 8)}
            {a.target_user_id && ` → user ${a.target_user_id.slice(0, 8)}`}
            {a.target_message_id && ` (msg ${a.target_message_id.slice(0, 8)})`}
          </div>
        </li>
      ))}
    </ul>
  );
}

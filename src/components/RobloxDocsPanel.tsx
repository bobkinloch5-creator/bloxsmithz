import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, BookOpen } from "lucide-react";
import { syncRobloxDocsFn, getRobloxDocsStatusFn, searchRobloxDocsFn } from "@/lib/roblox-docs.functions";

type SyncStatus = {
  id?: string;
  status?: string;
  total_docs?: number;
  embedded_docs?: number;
  last_synced_at?: string | null;
  error?: string | null;
} | null;

export function RobloxDocsPanel() {
  const sync = useServerFn(syncRobloxDocsFn);
  const status = useServerFn(getRobloxDocsStatusFn);
  const search = useServerFn(searchRobloxDocsFn);

  const [info, setInfo] = useState<SyncStatus>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ title: string; section?: string; source_url: string; similarity: number }>>([]);
  const [searching, setSearching] = useState(false);

  const refresh = async () => {
    try {
      const s = await status();
      setInfo(s as SyncStatus);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => { refresh(); }, []);

  const runSync = async () => {
    setBusy(true);
    try {
      const res: any = await sync({ data: { batchSize: 20 } });
      toast.success(`Sync ${res?.status ?? "ok"}: ${res?.embedded_docs ?? 0}/${res?.total_docs ?? 0} chunks`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const runSearch = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res: any = await search({ data: { query: q.trim(), limit: 6 } });
      setResults(res?.results ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const pct = info?.total_docs ? Math.round(((info.embedded_docs ?? 0) / info.total_docs) * 100) : 0;

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Roblox Docs Knowledge
        </h2>
        <button
          onClick={runSync}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {busy ? "Syncing…" : "Sync Docs Now"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-border p-3">
          <div className="text-xs uppercase text-muted-foreground">Status</div>
          <div className="mt-1 text-sm font-medium flex items-center gap-2">
            {info?.status === "completed" || info?.status === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : info?.status === "failed" ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Loader2 className="w-4 h-4" />
            )}
            {info?.status ?? "never run"}
          </div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-xs uppercase text-muted-foreground">Chunks embedded</div>
          <div className="mt-1 text-sm font-medium">
            {info?.embedded_docs ?? 0} / {info?.total_docs ?? 0} ({pct}%)
          </div>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="text-xs uppercase text-muted-foreground">Last synced</div>
          <div className="mt-1 text-sm font-medium">
            {info?.last_synced_at ? new Date(info.last_synced_at).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      {info?.error ? (
        <p className="text-xs text-red-400 mb-3">Last error: {info.error}</p>
      ) : null}

      <div className="rounded-xl border border-border p-3">
        <div className="text-xs uppercase text-muted-foreground mb-2">Test search</div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            placeholder="e.g. RemoteEvent best practices"
            className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm"
          />
          <button
            onClick={runSearch}
            disabled={searching || !q.trim()}
            className="rounded-lg bg-secondary px-3 py-2 text-sm disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </button>
        </div>
        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((r, i) => (
              <li key={i} className="text-sm">
                <a href={r.source_url} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                  {r.title}{r.section ? ` — ${r.section}` : ""}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  similarity {(r.similarity * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

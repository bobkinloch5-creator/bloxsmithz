import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchToolboxFn } from "@/lib/toolbox.functions";
import { Loader2, Search, Copy, ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/toolbox")({
  component: ToolboxPage,
  head: () => ({
    meta: [
      { title: "Toolbox — Free Roblox Assets | BloxSmith" },
      {
        name: "description",
        content:
          "Search free Roblox models, decals, audio, plugins, and meshes. Copy asset IDs straight into Roblox Studio.",
      },
    ],
  }),
});

const CATEGORIES = ["Models", "Decals", "Audio", "Plugins", "Meshes"] as const;
type Cat = (typeof CATEGORIES)[number];

type Asset = {
  id: number;
  name: string;
  creator: string;
  assetType: string;
  thumbnail: string | null;
  url: string;
};

function ToolboxPage() {
  const search = useServerFn(searchToolboxFn);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("Models");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Asset[]>([]);
  const [done, setDone] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setDone(false);
    try {
      const res: any = await search({ data: { keyword: q.trim(), category: cat, limit: 24 } });
      setResults(res?.results ?? []);
      setDone(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Search failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (id: number) => {
    try {
      await navigator.clipboard.writeText(`rbxassetid://${id}`);
      toast.success(`Copied rbxassetid://${id}`);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            Toolbox — Free Roblox Assets
          </h1>
          <p className="text-sm text-muted-foreground">
            Search the public Roblox catalog. Copy <code className="bg-surface px-1 rounded">rbxassetid://</code> IDs or open
            the asset page to insert into Studio.
          </p>
        </header>

        <section className="glass rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                  cat === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-surface-elevated"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") run(); }}
              placeholder={`Search free ${cat.toLowerCase()}…`}
              className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm"
            />
            <button
              onClick={run}
              disabled={busy || !q.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
        </section>

        {done && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No free assets matched. Try another keyword or category.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {results.map((a) => (
            <div key={a.id} className="glass rounded-xl overflow-hidden flex flex-col">
              <div className="aspect-square bg-surface-elevated flex items-center justify-center">
                {a.thumbnail ? (
                  <img src={a.thumbnail} alt={a.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-1">
                <div className="text-sm font-medium line-clamp-2" title={a.name}>{a.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">by {a.creator}</div>
                <div className="text-[10px] text-muted-foreground/80">ID {a.id}</div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => copy(a.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-secondary px-2 py-1.5 text-xs hover:bg-secondary/80"
                  >
                    <Copy className="w-3 h-3" /> Copy ID
                  </button>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1.5 text-xs hover:bg-surface-elevated"
                    title="Open on Roblox"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

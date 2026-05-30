import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { generate3DModelFn, type Generate3DResult } from "@/lib/tripo.functions";
import { Box, Download, Loader2, Sparkles, Clock, Info } from "lucide-react";

export const Route = createFileRoute("/generate-3d")({
  component: Generate3DPage,
  head: () => ({
    meta: [
      { title: "AI 3D Model Generator for Roblox | BloxSmith" },
      {
        name: "description",
        content:
          "Generate 3D models from text and import them straight into Roblox Studio. Powered by Tripo3D. One free generation per week.",
      },
      { property: "og:title", content: "AI 3D Model Generator for Roblox | BloxSmith" },
      { property: "og:url", content: "https://bloxsmith.pro/generate-3d" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/generate-3d" }],
  }),
});

function Generate3DPage() {
  const { user } = useAuth();
  const run = useServerFn(generate3DModelFn);

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Extract<Generate3DResult, { ok: true }> | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);

  const examples = [
    "a low-poly treasure chest with gold trim",
    "a cartoon wooden barrel",
    "a stylized magic potion bottle",
    "a sci-fi laser sword",
    "a cute round slime monster",
    "a medieval stone fountain",
  ];

  const generate = async () => {
    if (!user) {
      toast.error("Please log in to generate 3D models.");
      return;
    }
    const p = prompt.trim();
    if (p.length < 3) {
      toast.error("Describe the model you want (at least a few words).");
      return;
    }
    setBusy(true);
    setResult(null);
    setLimitMsg(null);
    try {
      const out = (await run({ data: { prompt: p } })) as Generate3DResult;
      if (out.ok) {
        setResult(out);
        setNextAvailable(out.nextAvailable);
        toast.success(`3D model ready! ${out.creditsSpent} credits used.`);
      } else {
        setLimitMsg(out.error);
        setNextAvailable(out.nextAvailable ?? null);
        toast.error(out.error);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
            <Box className="h-3.5 w-3.5" /> 3D Model Generator
          </div>
          <h1 className="text-3xl font-bold">Text → 3D model for Roblox</h1>
          <p className="mt-2 text-muted-foreground">
            Describe an object and get a ready-to-import 3D model. 1 generation per week.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface/60 p-5 shadow-lg">
          <label className="block text-sm font-semibold mb-2">Describe your model</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. a low-poly treasure chest with gold trim"
            rows={3}
            maxLength={1024}
            disabled={busy}
            className="w-full resize-none rounded-xl border border-border bg-background/60 px-3.5 py-3 text-sm outline-none focus:border-primary/50 disabled:opacity-60"
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={busy}
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-border bg-surface/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={busy || !prompt.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating… this can take up to a minute
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate 3D model
              </>
            )}
          </button>

          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Uses a large chunk of credits · 1 per week per account
          </p>
        </div>

        {limitMsg && (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-amber-400">
              <Clock className="h-4 w-4" /> Not available right now
            </div>
            <p className="mt-1 text-foreground/80">{limitMsg}</p>
            {nextAvailable && (
              <p className="mt-1 text-xs text-muted-foreground">
                Next generation available: {fmtDate(nextAvailable)}
              </p>
            )}
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-2xl border border-border bg-surface/60 p-5">
            <div className="flex flex-col sm:flex-row gap-5">
              {result.renderedImageUrl && (
                <img
                  src={result.renderedImageUrl}
                  alt="Generated 3D model preview"
                  className="h-44 w-44 shrink-0 rounded-xl border border-border object-cover bg-background"
                  loading="lazy"
                />
              )}
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Your model is ready</h2>
                <a
                  href={result.fileUrl}
                  download
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
                >
                  <Download className="h-4 w-4" /> Download model file
                </a>

                <div className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <Info className="h-4 w-4 text-primary" /> Import into Roblox Studio
                  </div>
                  <ol className="list-decimal pl-5 space-y-1 text-foreground/80">
                    <li>Download the file above.</li>
                    <li>
                      In Studio, open the <b>Avatar</b> tab → <b>Import 3D</b> (the 3D Importer).
                    </li>
                    <li>Select the downloaded file. The mesh drops into your Workspace.</li>
                    <li>Position it, anchor it, and you're done.</li>
                  </ol>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Roblox can't load external meshes at runtime, so this one-time import is how the
                    model becomes a real Workspace object.
                  </p>
                </div>
                {nextAvailable && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Your next generation unlocks {fmtDate(nextAvailable)}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

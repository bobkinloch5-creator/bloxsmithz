import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF, Html } from "@react-three/drei";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import {
  generate3DModelFn,
  get3DStatusFn,
  type Generate3DResult,
} from "@/lib/tripo.functions";
import {
  Box,
  Download,
  Loader2,
  Sparkles,
  Clock,
  Info,
  Settings2,
  Gauge,
  Layers,
  Palette,
} from "lucide-react";

export const Route = createFileRoute("/generate-3d")({
  component: Generate3DPage,
  head: () => ({
    meta: [
      { title: "AI 3D Model Generator for Roblox | BloxSmith" },
      {
        name: "description",
        content:
          "Generate textured 3D models from text and import them into Roblox Studio. Live WebGL preview, quality settings, multiple formats. One per week.",
      },
      { property: "og:title", content: "AI 3D Model Generator for Roblox | BloxSmith" },
      { property: "og:url", content: "https://bloxsmith.pro/generate-3d" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/generate-3d" }],
  }),
});

function PreviewModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function ModelViewer({ url }: { url: string }) {
  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]} shadows>
      <color attach="background" args={["#0a0e0c"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
      <directionalLight position={[-5, 2, -5]} intensity={0.4} />
      <Suspense
        fallback={
          <Html center>
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading mesh…
            </div>
          </Html>
        }
      >
        <Stage intensity={0.5} adjustCamera={1.1} shadows="contact">
          <PreviewModel url={url} />
        </Stage>
      </Suspense>
      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.2}
        minDistance={1.5}
        maxDistance={10}
      />
    </Canvas>
  );
}

const STAGES = [
  { label: "Sending prompt to Tripo…", pct: 12 },
  { label: "Generating base mesh…", pct: 45 },
  { label: "Applying textures…", pct: 70 },
  { label: "Converting for Roblox…", pct: 88 },
  { label: "Finishing up…", pct: 96 },
];

function Generate3DPage() {
  const { user } = useAuth();
  const run = useServerFn(generate3DModelFn);
  const getStatus = useServerFn(get3DStatusFn);

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Extract<Generate3DResult, { ok: true }> | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);

  const [quality, setQuality] = useState<"turbo" | "standard" | "detailed">("turbo");
  const [format, setFormat] = useState<"GLB" | "OBJ" | "FBX">("GLB");
  const [faceLimit, setFaceLimit] = useState(10000);
  const [texture, setTexture] = useState(true);
  const [style, setStyle] = useState<string>("");

  const [status, setStatus] = useState<{
    canGenerate: boolean;
    isOwner: boolean;
    credits: number;
    cost: number;
    nextAvailable: string | null;
  } | null>(null);

  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    getStatus({ data: undefined as any })
      .then((s: any) => {
        setStatus(s);
        if (!s.canGenerate) setNextAvailable(s.nextAvailable);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const startProgress = () => {
    setProgress(2);
    setStageLabel(STAGES[0].label);
    let i = 0;
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        const cap = STAGES[Math.min(i, STAGES.length - 1)].pct;
        if (p >= cap - 1 && i < STAGES.length - 1) {
          i += 1;
          setStageLabel(STAGES[i].label);
        }
        const target = STAGES[Math.min(i, STAGES.length - 1)].pct;
        return Math.min(p + Math.max(0.4, (target - p) * 0.08), target);
      });
    }, 250);
  };

  const stopProgress = (toComplete: boolean) => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = null;
    setProgress(toComplete ? 100 : 0);
    if (toComplete) setStageLabel("Done!");
  };

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
    if (status && !status.canGenerate && !status.isOwner) {
      toast.error("You've used your weekly generation.");
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
    startProgress();
    try {
      const out = (await run({
        data: {
          prompt: p,
          quality,
          format,
          faceLimit,
          texture,
          ...(style ? { style } : {}),
        },
      })) as Generate3DResult;
      if (out.ok) {
        stopProgress(true);
        setResult(out);
        setNextAvailable(out.nextAvailable);
        setStatus((s) => (s ? { ...s, canGenerate: false, nextAvailable: out.nextAvailable } : s));
        toast.success(`3D model ready! ${out.creditsSpent} credits used.`);
      } else {
        stopProgress(false);
        setLimitMsg(out.error);
        setNextAvailable(out.nextAvailable ?? null);
        toast.error(out.error);
      }
    } catch (e: any) {
      stopProgress(false);
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

  const etaCountdown = (iso: string | null) => {
    if (!iso) return "";
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "now";
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((ms % 3_600_000) / 60_000);
    return `${hours}h ${mins}m`;
  };

  const cost = status?.cost ?? 25;
  const locked = !!status && !status.canGenerate && !status.isOwner;

  const Segmented = ({
    value,
    onChange,
    options,
    disabled,
  }: {
    value: string;
    onChange: (v: any) => void;
    options: { value: string; label: string; hint?: string }[];
    disabled?: boolean;
  }) => (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
            value === o.value
              ? "border-primary/60 bg-primary/15 text-foreground"
              : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
          {o.hint && <span className="block text-[10px] text-muted-foreground">{o.hint}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
            <Box className="h-3.5 w-3.5" /> 3D Model Generator
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Text → 3D model for Roblox</h1>
          <p className="mt-2 text-muted-foreground">
            Describe an object, tune the settings, preview it in 3D, and import into Studio.
          </p>
          <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-3 text-xs">
            <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
              💎 {cost} credits / generation
            </span>
            <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
              ⏳ 1 per week per account
            </span>
            {status && (
              <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
                Your credits: {status.isOwner ? "∞" : status.credits}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
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

            <div className="mt-5 space-y-4 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" /> Settings
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                  <Gauge className="h-3.5 w-3.5 text-primary" /> Quality
                </div>
                <Segmented
                  value={quality}
                  onChange={setQuality}
                  disabled={busy}
                  options={[
                    { value: "turbo", label: "Turbo", hint: "fast · cheap" },
                    { value: "standard", label: "Standard", hint: "balanced" },
                    { value: "detailed", label: "Detailed", hint: "best" },
                  ]}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Download format
                </div>
                <Segmented
                  value={format}
                  onChange={setFormat}
                  disabled={busy}
                  options={[
                    { value: "GLB", label: "GLB", hint: "Studio import" },
                    { value: "OBJ", label: "OBJ", hint: "+ textures" },
                    { value: "FBX", label: "FBX", hint: "rigged" },
                  ]}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
                  <span>Polygon budget</span>
                  <span className="text-muted-foreground">{faceLimit.toLocaleString()} tris</span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={50000}
                  step={1000}
                  value={faceLimit}
                  disabled={busy}
                  onChange={(e) => setFaceLimit(Number(e.target.value))}
                  className="w-full accent-emerald-500 disabled:opacity-50"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Lower = lighter &amp; better performance in Roblox. ~10k is a good default.
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                  <Palette className="h-3.5 w-3.5 text-primary" /> Style (optional)
                </div>
                <Segmented
                  value={style}
                  onChange={setStyle}
                  disabled={busy}
                  options={[
                    { value: "", label: "Default" },
                    { value: "person:person2cartoon", label: "Cartoon" },
                    { value: "object:clay", label: "Clay" },
                    { value: "object:steampunk", label: "Steampunk" },
                  ]}
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={texture}
                  disabled={busy}
                  onChange={(e) => setTexture(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Generate textures (recommended)
              </label>
            </div>

            <button
              onClick={generate}
              disabled={busy || !prompt.trim() || locked}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                </>
              ) : locked ? (
                <>
                  <Clock className="h-4 w-4" /> Available in {etaCountdown(nextAvailable)}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate 3D model · {cost} credits
                </>
              )}
            </button>

            {busy && (
              <div className="mt-4">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-background/70 border border-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{stageLabel}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface/60 p-5 shadow-lg flex flex-col">
            <div className="mb-3 text-sm font-semibold">3D Preview</div>
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-[#0a0e0c]">
              {result?.previewGlbUrl ? (
                <ModelViewer url={result.previewGlbUrl} />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-center px-6">
                  {busy ? (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      <span className="text-xs">{stageLabel || "Working…"}</span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Box className="mx-auto h-10 w-10 opacity-40" />
                      <p className="mt-2 text-xs">
                        Your model will appear here — rotate, zoom, and inspect it in 3D.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {result && (
              <div className="mt-4 space-y-3">
                <a
                  href={result.fileUrl}
                  download
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
                >
                  <Download className="h-4 w-4" /> Download {result.format}
                </a>
                <div className="rounded-xl border border-border bg-background/50 p-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <Info className="h-4 w-4 text-primary" /> Import into Roblox Studio
                  </div>
                  <ol className="list-decimal pl-5 space-y-1 text-foreground/80 text-xs">
                    <li>Download the file above.</li>
                    <li>
                      In Studio: <b>Avatar</b> tab → <b>Import 3D</b>.
                    </li>
                    <li>Select the file — the mesh drops into your Workspace.</li>
                    <li>Anchor &amp; position it. Done.</li>
                  </ol>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Roblox can't load external meshes at runtime, so this one-time import is how the
                    model becomes a real Workspace object.
                  </p>
                </div>
                {nextAvailable && (
                  <p className="text-xs text-muted-foreground">
                    Next generation unlocks {fmtDate(nextAvailable)} (~{etaCountdown(nextAvailable)}).
                  </p>
                )}
              </div>
            )}

            {limitMsg && !result && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold text-amber-400">
                  <Clock className="h-4 w-4" /> Not available right now
                </div>
                <p className="mt-1 text-foreground/80">{limitMsg}</p>
                {nextAvailable && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Available {fmtDate(nextAvailable)} (~{etaCountdown(nextAvailable)}).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

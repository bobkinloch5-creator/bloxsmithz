import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Stage, Text, useGLTF } from "@react-three/drei";
import { toast } from "sonner";
import {
  BadgeCheck,
  Box,
  Clock,
  Download,
  Film,
  Gauge,
  ImagePlus,
  Info,
  Loader2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Type,
  Upload,
  WandSparkles,
} from "lucide-react";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { generate3DModelFn, get3DStatusFn, type Generate3DResult } from "@/lib/tripo.functions";

export const Route = createFileRoute("/generate-3d")({
  component: Generate3DPage,
  head: () => ({
    meta: [
      { title: "AI 3D Model Generator for Roblox | BloxSmith" },
      {
        name: "description",
        content:
          "Generate Roblox-ready 3D models, 3D text, and custom animation blueprints with progress, ETA, previews, and Studio plugin support.",
      },
    ],
  }),
});

type Kind = "model" | "text" | "animation";
type Project = { id: string; name: string };

const modelTypes = [
  "pet",
  "character",
  "weapon",
  "prop",
  "building",
  "vehicle",
  "simulator item",
  "map piece",
  "accessory",
  "tool",
];
const styles = ["chunky", "low-poly", "cartoon", "anime", "simulator", "obby", "tycoon", "realistic-lite"];
const themes = ["neon", "fantasy", "sci-fi", "city", "horror", "cute", "medieval", "pirate", "space", "premium"];
const materials = ["plastic", "metal", "wood", "stone", "glass", "crystal", "fabric", "neon"];
const textureLooks = ["clean", "painted", "toy-like", "glossy", "matte", "pixel", "cel-shaded", "worn"];
const animationTypes = ["idle", "walk", "run", "attack", "emote", "dance", "pet", "npc", "tool", "jump"];
const animationStyles = ["snappy", "smooth", "cartoony", "heroic", "scary", "cute", "robotic", "floaty"];
const animationEasings = ["sine", "quad", "back", "elastic", "linear"];
const bodyFocuses = ["full body", "upper body", "arms", "legs", "head", "tool hand", "tail/pet"];
const animationPrompts = [
  "A confident sword slash with wind-up, fast swing, and recovery",
  "A cute pet idle with a bounce, head tilt, and tiny hop",
  "A spooky NPC walk with heavy shoulders and slow steps",
  "A victory dance with two arm pumps and a playful spin",
];

const copy = {
  model: {
    title: "3D Model",
    kicker: "Tripo 3D generation",
    prompt: "Describe your Roblox-ready model",
    placeholder: "A chunky neon hover pet with crystal ears, glowing eyes, and a toy-like silhouette",
    empty: "Generated models appear here with a live 3D preview.",
  },
  text: {
    title: "3D Text",
    kicker: "Roblox text package",
    prompt: "Extra styling notes",
    placeholder: "Make it look like a premium simulator title sign with glowing edges",
    empty: "Preview your text while you tune colors, material, and motion.",
  },
  animation: {
    title: "Animation",
    kicker: "Custom Roblox animation blueprint",
    prompt: "Describe the motion",
    placeholder: "A fast dash attack: lean forward, right arm swings, feet slide, then snap back ready",
    empty: "Custom animation blueprints appear here with keyframe settings and controller code.",
  },
} satisfies Record<Kind, { title: string; kicker: string; prompt: string; placeholder: string; empty: string }>;

function PreviewModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function ModelViewer({ url }: { url: string }) {
  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]} shadows>
      <color attach="background" args={["#07100d"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 8, 5]} intensity={1.25} />
      <Suspense fallback={<Html center><Loader2 className="h-5 w-5 animate-spin text-primary" /></Html>}>
        <Stage intensity={0.55} adjustCamera={1.1} shadows="contact">
          <PreviewModel url={url} />
        </Stage>
      </Suspense>
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.2} />
    </Canvas>
  );
}

function TextPreview({
  words,
  color,
  secondary,
  effect,
}: {
  words: string;
  color: string;
  secondary: string;
  effect: string;
}) {
  return (
    <Canvas camera={{ position: [0, 1.2, 8], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#070b12"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <Text
        fontSize={1.15}
        maxWidth={6.8}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color={color}
        outlineWidth={effect === "outline" ? 0.08 : 0.045}
        outlineColor={secondary}
        position={[0, 0.3, 0]}
      >
        {words || "BloxSmith"}
      </Text>
      <mesh position={[0, -1.05, -0.22]}>
        <boxGeometry args={[7, 0.22, 0.55]} />
        <meshStandardMaterial color={secondary} emissive={effect === "neon" ? color : "#000000"} emissiveIntensity={effect === "neon" ? 0.35 : 0} />
      </mesh>
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.8} minDistance={4} maxDistance={12} />
    </Canvas>
  );
}

function AnimationPreview({
  type,
  style,
  intensity,
  looped,
  duration,
}: {
  type: string;
  style: string;
  intensity: number;
  looped: boolean;
  duration: number;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(20,241,149,0.18),transparent_32%),linear-gradient(180deg,#071017,#05070a)]">
      <div className="absolute inset-x-10 bottom-16 h-px bg-primary/30" />
      <div className="absolute left-1/2 top-1/2 h-28 w-20 -translate-x-1/2 -translate-y-1/2">
        <div
          className="absolute left-1/2 top-0 h-10 w-10 -translate-x-1/2 rounded-full border border-primary/45 bg-primary/15 shadow-[0_0_28px_rgba(20,241,149,0.25)]"
          style={{ animation: `bloxHead ${Math.max(0.8, duration)}s ease-in-out infinite` }}
        />
        <div
          className="absolute left-1/2 top-10 h-16 w-8 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-cyan-300/15"
          style={{ animation: `bloxBody ${Math.max(0.8, duration)}s ease-in-out infinite` }}
        />
        <div
          className="absolute left-3 top-12 h-14 w-3 origin-top rounded-full bg-primary/70"
          style={{ animation: `bloxArmLeft ${Math.max(0.8, duration)}s ease-in-out infinite` }}
        />
        <div
          className="absolute right-3 top-12 h-14 w-3 origin-top rounded-full bg-sky-300/80"
          style={{ animation: `bloxArmRight ${Math.max(0.8, duration)}s ease-in-out infinite` }}
        />
      </div>
      <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-border/70 bg-background/70 p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold capitalize">{type} / {style}</span>
          <span className="text-muted-foreground">{looped ? "Looped" : "One-shot"} / {intensity}%</span>
        </div>
      </div>
      <style>{`
        @keyframes bloxHead { 0%,100%{ transform:translate(-50%,0) rotate(-3deg) } 50%{ transform:translate(-50%,-8px) rotate(5deg) } }
        @keyframes bloxBody { 0%,100%{ transform:translate(-50%,0) scaleY(1) } 50%{ transform:translate(-50%,6px) scaleY(.94) } }
        @keyframes bloxArmLeft { 0%,100%{ transform:rotate(-${12 + intensity * 0.18}deg) } 50%{ transform:rotate(${18 + intensity * 0.22}deg) } }
        @keyframes bloxArmRight { 0%,100%{ transform:rotate(${14 + intensity * 0.18}deg) } 50%{ transform:rotate(-${22 + intensity * 0.22}deg) } }
      `}</style>
    </div>
  );
}

function Generate3DPage() {
  const { user } = useAuth();
  const run = useServerFn(generate3DModelFn);
  const getStatus = useServerFn(get3DStatusFn);
  const [kind, setKind] = useState<Kind>("model");
  const [inputMode, setInputMode] = useState<"text" | "image">("text");
  const [prompt, setPrompt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<Generate3DResult, { ok: true }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ canGenerate: boolean; isOwner: boolean; credits: number; cost: number; nextAvailable: string | null } | null>(null);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Ready");
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [modelType, setModelType] = useState("pet");
  const [robloxStyle, setRobloxStyle] = useState("chunky");
  const [theme, setTheme] = useState("neon");
  const [material, setMaterial] = useState("plastic");
  const [textureLook, setTextureLook] = useState("clean");
  const [primaryColor, setPrimaryColor] = useState("#14f195");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [quality, setQuality] = useState<"turbo" | "standard" | "detailed">("turbo");
  const [format, setFormat] = useState<"GLB" | "OBJ" | "FBX">("GLB");
  const [faceLimit, setFaceLimit] = useState(10000);
  const [texture, setTexture] = useState(true);
  const [rigged, setRigged] = useState(false);
  const [animateInPlace, setAnimateInPlace] = useState(false);
  const [textWords, setTextWords] = useState("BloxSmith");
  const [textFont, setTextFont] = useState("GothamBlack");
  const [textEffect, setTextEffect] = useState("neon");
  const [textAnimation, setTextAnimation] = useState("float");
  const [textSize, setTextSize] = useState(8);
  const [animationType, setAnimationType] = useState("idle");
  const [animationTarget, setAnimationTarget] = useState("character");
  const [animationStyle, setAnimationStyle] = useState("snappy");
  const [animationEasing, setAnimationEasing] = useState("sine");
  const [animationBodyFocus, setAnimationBodyFocus] = useState("full body");
  const [animationIntensity, setAnimationIntensity] = useState(55);
  const [animationDuration, setAnimationDuration] = useState(2);
  const [animationLooped, setAnimationLooped] = useState(true);

  const stageList =
    kind === "model"
      ? [
          "Checking prompt safety",
          inputMode === "image" ? "Uploading reference image" : "Preparing Tripo request",
          "Generating 3D mesh",
          "Converting Roblox export",
          "Saving permanent download",
        ]
      : kind === "text"
        ? ["Checking text safety", "Building 3D text package", "Adding motion script", "Saving Studio package"]
        : ["Checking motion prompt", "Writing keyframe plan", "Tuning timing and easing", "Saving animation blueprint"];

  const estimatedSeconds =
    kind === "model"
      ? inputMode === "image"
        ? quality === "detailed"
          ? 210
          : 165
        : quality === "detailed"
          ? 180
          : quality === "standard"
            ? 135
            : 95
      : kind === "text"
        ? 18
        : 22;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    getStatus({ data: { generationKind: kind } })
      .then((s: any) => {
        setStatus(s);
        setNextAvailable(s.nextAvailable);
      })
      .catch(() => {});
  }, [user, kind, getStatus]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("id,name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setProjects((data ?? []) as Project[]));
  }, [user]);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (nextAvailable && status && !status.canGenerate && new Date(nextAvailable).getTime() <= now) {
      setStatus({ ...status, canGenerate: true, nextAvailable: null });
      setNextAvailable(null);
      setLimitMsg(null);
    }
  }, [nextAvailable, now, status]);

  const locked =
    !!status &&
    !status.canGenerate &&
    !status.isOwner &&
    !!nextAvailable &&
    new Date(nextAvailable).getTime() > now;
  const cost = status?.cost ?? (kind === "model" ? 25 : kind === "text" ? 10 : 12);
  const progressEta = Math.max(0, estimatedSeconds - elapsed);

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
  const fmtDuration = (seconds: number) => {
    if (seconds <= 0) return "now";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
  };
  const cooldownEta = (iso: string | null) => {
    if (!iso) return "";
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return "now";
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
  };

  const startProgress = () => {
    if (timer.current) clearInterval(timer.current);
    startedAt.current = Date.now();
    setElapsed(0);
    setProgress(3);
    setStage(stageList[0]);
    timer.current = setInterval(() => {
      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000));
      const ratio = Math.min(0.94, elapsedSeconds / estimatedSeconds);
      const stageIndex = Math.min(stageList.length - 1, Math.floor(ratio * stageList.length));
      setElapsed(elapsedSeconds);
      setProgress(Math.max(5, Math.round(ratio * 100)));
      setStage(stageList[stageIndex]);
    }, 1000);
  };

  const stopProgress = (ok: boolean) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(ok ? 100 : 0);
    setStage(ok ? "Ready to download" : "Generation stopped");
  };

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast.error("Upload a PNG, JPG, or WEBP image.");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image uploads must be 8 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result));
      setImageName(file.name);
      setInputMode("image");
    };
    reader.onerror = () => toast.error("Could not read that image.");
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!user) return toast.error("Please log in to generate.");
    if (locked) return toast.error("Your weekly generation cooldown is still active.");
    if (kind === "model" && inputMode === "text" && prompt.trim().length < 3) return toast.error("Describe the model you want.");
    if (kind === "model" && inputMode === "image" && !imageDataUrl) return toast.error("Upload a reference image first.");
    if (kind === "text" && !textWords.trim()) return toast.error("Enter 3D text words.");
    if (kind === "animation" && prompt.trim().length < 3) return toast.error("Describe the animation you want.");

    setBusy(true);
    setResult(null);
    setLimitMsg(null);
    startProgress();
    try {
      const out = (await run({
        data: {
          generationKind: kind,
          prompt: prompt.trim(),
          ...(projectId ? { projectId } : {}),
          inputMode,
          ...(imageDataUrl ? { imageDataUrl } : {}),
          modelType,
          robloxStyle,
          theme,
          material,
          textureLook,
          primaryColor,
          secondaryColor,
          textWords,
          textFont,
          textEffect,
          textAnimation,
          textSize,
          animationType,
          animationTarget,
          animationStyle,
          animationEasing,
          animationBodyFocus,
          animationIntensity,
          animationDuration,
          animationLooped,
          quality,
          format: rigged && format === "OBJ" ? "FBX" : format,
          faceLimit,
          texture,
          rigged,
          animateInPlace,
        },
      })) as Generate3DResult;
      if (out.ok) {
        stopProgress(true);
        setResult(out);
        setNextAvailable(out.nextAvailable);
        setStatus((s) => (s ? { ...s, canGenerate: false, nextAvailable: out.nextAvailable } : s));
        toast.success(`Generation ready! ${out.creditsSpent} credits used.`);
      } else {
        stopProgress(false);
        setLimitMsg(out.error);
        setNextAvailable(out.nextAvailable ?? null);
        toast.error(out.error);
      }
    } catch (err: any) {
      stopProgress(false);
      toast.error(err?.message ?? "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const disabled =
    busy ||
    locked ||
    (kind === "model"
      ? inputMode === "text"
        ? !prompt.trim()
        : !imageDataUrl
      : kind === "text"
        ? !textWords.trim()
        : !prompt.trim());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <section className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Box className="h-3.5 w-3.5" /> Roblox Asset Studio
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              3D, Text, and Animation Generator
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Build model files with Tripo, Studio text packages, and custom animation blueprints from your own prompts.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface/55 p-2">
            <Stat label="Credits" value={status?.isOwner ? "Owner" : String(status?.credits ?? "...")} />
            <Stat label="Cost" value={`${cost} cr`} />
            <Stat label="Cooldown" value={locked ? cooldownEta(nextAvailable) : "Ready"} />
          </div>
        </section>

        {locked && nextAvailable && (
          <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold text-amber-200">
                  <Clock className="h-4 w-4" /> Weekly generation cooldown active
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Unlocks {fmtDate(nextAvailable)}. The button updates automatically.
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/30 bg-background/50 px-4 py-2 text-center">
                <div className="text-2xl font-black text-amber-200">{cooldownEta(nextAvailable)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">remaining</div>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-3">
          <ModeCard
            active={kind === "model"}
            icon={<Box className="h-4 w-4" />}
            title="3D Models"
            text="Tripo-generated meshes with Roblox export settings."
            onClick={() => setKind("model")}
          />
          <ModeCard
            active={kind === "text"}
            icon={<Type className="h-4 w-4" />}
            title="3D Text"
            text="Studio-ready signs with glow, motion, and colors."
            onClick={() => setKind("text")}
          />
          <ModeCard
            active={kind === "animation"}
            icon={<Film className="h-4 w-4" />}
            title="Animations"
            text="Custom prompt-to-keyframe blueprints and controller snippets."
            onClick={() => setKind("animation")}
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
          <section className="rounded-2xl border border-border bg-surface/60 p-4 shadow-lg sm:p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{copy[kind].kicker}</div>
                <h2 className="mt-1 text-xl font-bold">{copy[kind].title} Builder</h2>
              </div>
              <div className="rounded-xl border border-border bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                ETA {fmtDuration(estimatedSeconds)}
              </div>
            </div>

            {kind === "model" && (
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/50 p-1">
                <Tab active={inputMode === "text"} onClick={() => setInputMode("text")} icon={<WandSparkles className="h-3.5 w-3.5" />} label="Text to 3D" />
                <Tab active={inputMode === "image"} onClick={() => setInputMode("image")} icon={<ImagePlus className="h-3.5 w-3.5" />} label="Image to 3D" />
              </div>
            )}

            {kind === "model" && inputMode === "image" && (
              <div className="mb-4 rounded-xl border border-dashed border-primary/35 bg-primary/5 p-3">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg bg-background/40 px-4 py-5 text-center">
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-semibold">{imageName || "Upload a safe reference image"}</span>
                  <span className="text-[11px] text-muted-foreground">PNG, JPG, or WEBP. Max 8 MB.</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
                {imageDataUrl && (
                  <img src={imageDataUrl} alt="Reference preview" className="mt-3 max-h-56 w-full rounded-lg border border-border object-contain" />
                )}
              </div>
            )}

            {kind === "text" && (
              <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_120px]">
                <TextInput label="3D text words" value={textWords} onChange={setTextWords} />
                <NumberInput label="Size" value={textSize} min={1} max={30} onChange={setTextSize} />
              </div>
            )}

            <label className="block text-sm font-semibold">{copy[kind].prompt}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={copy[kind].placeholder}
              rows={kind === "animation" ? 5 : 4}
              maxLength={1024}
              disabled={busy}
              className="mt-2 w-full resize-none rounded-xl border border-border bg-background/60 px-3.5 py-3 text-sm outline-none transition focus:border-primary/50 disabled:opacity-60"
            />
            {kind === "animation" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {animationPrompts.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPrompt(item)}
                    className="rounded-full border border-border bg-background/45 px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 space-y-4 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" /> Controls
              </div>

              {projects.length > 0 && (
                <label className="block text-xs font-medium">
                  Insert package into project
                  <select
                    value={projectId}
                    disabled={busy}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"
                  >
                    <option value="">Download only</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {kind === "model" && (
                <>
                  <Group label="Model type"><Chips value={modelType} set={setModelType} items={modelTypes} /></Group>
                  <Group label="Roblox style"><Chips value={robloxStyle} set={setRobloxStyle} items={styles} /></Group>
                </>
              )}

              {kind === "animation" && (
                <>
                  <Group label="Animation type"><Chips value={animationType} set={setAnimationType} items={animationTypes} /></Group>
                  <Group label="Motion style"><Chips value={animationStyle} set={setAnimationStyle} items={animationStyles} /></Group>
                  <Group label="Body focus"><Chips value={animationBodyFocus} set={setAnimationBodyFocus} items={bodyFocuses} /></Group>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <TextInput label="Target" value={animationTarget} onChange={setAnimationTarget} />
                    <NumberInput label="Duration" value={animationDuration} min={0.25} max={30} step={0.25} onChange={setAnimationDuration} />
                    <label className="text-xs font-medium">
                      Easing
                      <select
                        value={animationEasing}
                        onChange={(e) => setAnimationEasing(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"
                      >
                        {animationEasings.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block text-xs font-medium">
                    Intensity: {animationIntensity}%
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={animationIntensity}
                      onChange={(e) => setAnimationIntensity(Number(e.target.value))}
                      className="mt-1 w-full accent-emerald-500"
                    />
                  </label>
                  <Toggle checked={animationLooped} onChange={setAnimationLooped} label="Looped animation" />
                </>
              )}

              <Group label="Theme"><Chips value={theme} set={setTheme} items={themes} /></Group>
              <Group label="Material"><Chips value={material} set={setMaterial} items={materials} /></Group>
              <div className="grid grid-cols-2 gap-2">
                <ColorInput label="Primary color" value={primaryColor} onChange={setPrimaryColor} />
                <ColorInput label="Secondary color" value={secondaryColor} onChange={setSecondaryColor} />
              </div>

              {kind === "text" && (
                <>
                  <Group label="Font"><Chips value={textFont} set={setTextFont} items={["GothamBlack", "FredokaOne", "Bangers", "Cartoon", "Arcade", "SciFi"]} /></Group>
                  <Group label="Effect"><Chips value={textEffect} set={setTextEffect} items={["neon", "outline", "gold", "ice", "shadow"]} /></Group>
                  <Group label="Animation"><Chips value={textAnimation} set={setTextAnimation} items={["float", "pulse", "spin", "bounce", "none"]} /></Group>
                </>
              )}

              {kind === "model" && (
                <>
                  <Group label="Quality"><Chips value={quality} set={setQuality} items={["turbo", "standard", "detailed"]} /></Group>
                  <Group label="Format"><Chips value={format} set={setFormat} items={["GLB", "OBJ", "FBX"]} /></Group>
                  <label className="block text-xs font-medium">
                    Polygon budget: {faceLimit.toLocaleString()}
                    <input
                      type="range"
                      min={1000}
                      max={50000}
                      step={1000}
                      value={faceLimit}
                      onChange={(e) => setFaceLimit(Number(e.target.value))}
                      className="mt-1 w-full accent-emerald-500"
                    />
                  </label>
                  <Group label="Texture look"><Chips value={textureLook} set={setTextureLook} items={textureLooks} /></Group>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Toggle checked={texture} onChange={setTexture} label="Generate textures" />
                    <Toggle
                      checked={rigged}
                      onChange={(v) => {
                        setRigged(v);
                        if (v && format === "OBJ") setFormat("FBX");
                      }}
                      label="Rigged FBX export"
                    />
                    <Toggle checked={animateInPlace} onChange={setAnimateInPlace} label="Animation-ready in place" />
                  </div>
                </>
              )}

              <div className="flex gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                Safety checks run before paid generation. Credits are charged only after a file is created.
              </div>
            </div>

            <button
              onClick={generate}
              disabled={disabled}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating - ETA {fmtDuration(progressEta)}
                </>
              ) : locked ? (
                <>
                  <Clock className="h-4 w-4" /> Available in {cooldownEta(nextAvailable)}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate {copy[kind].title} - {cost} credits
                </>
              )}
            </button>
          </section>

          <section className="flex flex-col rounded-2xl border border-border bg-surface/60 p-4 shadow-lg sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</div>
                <h2 className="text-lg font-bold">Output and Progress</h2>
              </div>
              {result && <BadgeCheck className="h-5 w-5 text-primary" />}
            </div>

            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-[#07100d]">
              {kind === "text" ? (
                <TextPreview words={textWords} color={primaryColor} secondary={secondaryColor} effect={textEffect} />
              ) : result?.previewGlbUrl ? (
                <ModelViewer url={result.previewGlbUrl} />
              ) : kind === "animation" ? (
                <AnimationPreview
                  type={animationType}
                  style={animationStyle}
                  intensity={animationIntensity}
                  looped={animationLooped}
                  duration={animationDuration}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <div className="text-muted-foreground">
                    {busy ? (
                      <>
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-3 text-xs">{stage}</p>
                      </>
                    ) : (
                      <>
                        <Box className="mx-auto h-10 w-10 opacity-40" />
                        <p className="mt-2 text-xs">{copy[kind].empty}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/45 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Gauge className="h-3.5 w-3.5 text-primary" /> {stage}
                </span>
                <span className="text-muted-foreground">
                  {busy ? `${fmtDuration(elapsed)} elapsed / ${fmtDuration(progressEta)} left` : `${Math.round(progress)}%`}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-border bg-background/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-300 to-emerald-300 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                {stageList.map((item, index) => (
                  <span key={item} className={index <= Math.floor((progress / 100) * stageList.length) ? "text-foreground" : ""}>
                    {index + 1}. {item}
                  </span>
                ))}
              </div>
            </div>

            {result && (
              <div className="mt-4 space-y-3">
                <a
                  href={result.fileUrl}
                  download
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  <Download className="h-4 w-4" /> Download {result.format === "LUA" ? "Studio package" : result.format}
                </a>
                {result.studioFilePath && (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                    Project file: <span className="font-mono">{result.studioFilePath}</span>
                  </div>
                )}
                <div className="rounded-xl border border-border bg-background/50 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <Info className="h-4 w-4 text-primary" /> Roblox Studio insert
                  </div>
                  <p className="text-xs text-muted-foreground">{result.importTip}</p>
                </div>
                {result.studioScript && (
                  <details className="rounded-xl border border-border bg-background/50 p-3 text-xs">
                    <summary className="cursor-pointer font-semibold">Preview generated Roblox code</summary>
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{result.studioScript}</pre>
                  </details>
                )}
                {nextAvailable && (
                  <p className="text-xs text-muted-foreground">
                    Next generation unlocks {fmtDate(nextAvailable)} ({cooldownEta(nextAvailable)}).
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
                    Available {fmtDate(nextAvailable)} ({cooldownEta(nextAvailable)}).
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/45 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

function ModeCard({
  active,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-surface/50 text-muted-foreground hover:border-primary/35 hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-2 font-bold">{icon}{title}</div>
      <p className="mt-1 text-xs leading-relaxed">{text}</p>
    </button>
  );
}

function Tab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}{label}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium">{label}</div>
      {children}
    </div>
  );
}

function Chips({ value, set, items }: { value: string; set: (v: any) => void; items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => set(item)}
          className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
            value === item ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/35 px-3 py-2 text-xs font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
      {label}
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs font-medium">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs" />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-xs font-medium">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"
      />
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs font-medium">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background/60 p-1" />
    </label>
  );
}

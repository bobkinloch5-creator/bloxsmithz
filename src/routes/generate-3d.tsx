import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Stage, Text, useGLTF } from "@react-three/drei";
import { toast } from "sonner";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { generate3DModelFn, get3DStatusFn, type Generate3DResult } from "@/lib/tripo.functions";
import { Box, Clock, Download, Film, Info, Loader2, Settings2, ShieldCheck, Sparkles, Type, Upload, WandSparkles } from "lucide-react";

export const Route = createFileRoute("/generate-3d")({
  component: Generate3DPage,
  head: () => ({
    meta: [
      { title: "AI 3D Model Generator for Roblox | BloxSmith" },
      { name: "description", content: "Generate Roblox-ready 3D models, 3D text, and animation blueprints with custom styles, cooldowns, credits, preview, and Studio plugin support." },
    ],
  }),
});

type Kind = "model" | "text" | "animation";
type Project = { id: string; name: string };

const STAGES = ["Preparing safe Roblox settings...", "Sending generation request...", "Building asset structure...", "Saving Studio package...", "Finalizing download and cooldown..."];
const modelTypes = ["pet", "character", "weapon", "prop", "building", "vehicle", "simulator item", "map piece", "accessory", "tool"];
const styles = ["chunky", "low-poly", "cartoon", "anime", "simulator", "obby", "tycoon", "realistic-lite"];
const themes = ["neon", "fantasy", "sci-fi", "city", "horror", "cute", "medieval", "pirate", "space", "premium"];
const materials = ["plastic", "metal", "wood", "stone", "glass", "crystal", "fabric", "neon"];
const textureLooks = ["clean", "painted", "toy-like", "glossy", "matte", "pixel", "cel-shaded", "worn"];
const animationTypes = ["idle", "walk", "run", "attack", "emote", "dance", "pet", "npc", "tool", "jump"];

function PreviewModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function ModelViewer({ url }: { url: string }) {
  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]} shadows>
      <color attach="background" args={["#0a0e0c"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <Suspense fallback={<Html center><Loader2 className="h-5 w-5 animate-spin text-primary" /></Html>}>
        <Stage intensity={0.55} adjustCamera={1.1} shadows="contact"><PreviewModel url={url} /></Stage>
      </Suspense>
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.2} />
    </Canvas>
  );
}

function TextPreview({ words, color, secondary }: { words: string; color: string; secondary: string }) {
  return (
    <Canvas camera={{ position: [0, 1.2, 8], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#070b12"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <Text fontSize={1.15} maxWidth={6.8} textAlign="center" anchorX="center" anchorY="middle" color={color} outlineWidth={0.045} outlineColor={secondary} position={[0, 0.3, 0]}>
        {words || "BloxSmith"}
      </Text>
      <mesh position={[0, -1.05, -0.22]}><boxGeometry args={[7, 0.22, 0.55]} /><meshStandardMaterial color={secondary} /></mesh>
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.8} minDistance={4} maxDistance={12} />
    </Canvas>
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
  const [stage, setStage] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [textWords, setTextWords] = useState("BloxSmith");
  const [textFont, setTextFont] = useState("GothamBlack");
  const [textEffect, setTextEffect] = useState("neon");
  const [textAnimation, setTextAnimation] = useState("float");
  const [textSize, setTextSize] = useState(8);
  const [animationType, setAnimationType] = useState("idle");
  const [animationTarget, setAnimationTarget] = useState("character");
  const [animationDuration, setAnimationDuration] = useState(2);
  const [animationLooped, setAnimationLooped] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    getStatus({ data: { generationKind: kind } }).then((s: any) => {
      setStatus(s);
      setNextAvailable(s.nextAvailable);
    }).catch(() => {});
  }, [user, kind]);

  useEffect(() => {
    if (!user) return;
    supabase.from("projects").select("id,name").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50)
      .then(({ data }) => setProjects((data ?? []) as Project[]));
  }, [user]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  useEffect(() => {
    if (nextAvailable && status && !status.canGenerate && new Date(nextAvailable).getTime() <= now) {
      setStatus({ ...status, canGenerate: true, nextAvailable: null });
      setNextAvailable(null);
      setLimitMsg(null);
    }
  }, [nextAvailable, now, status]);

  const locked = !!status && !status.canGenerate && !status.isOwner && !!nextAvailable && new Date(nextAvailable).getTime() > now;
  const cost = status?.cost ?? (kind === "model" ? 25 : kind === "text" ? 10 : 12);
  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const eta = (iso: string | null) => {
    if (!iso) return "";
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return "now";
    const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
    return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
  };

  const startProgress = () => {
    setProgress(2); setStage(STAGES[0]);
    let i = 0;
    timer.current = setInterval(() => {
      i = Math.min(i + 1, STAGES.length - 1);
      setStage(STAGES[i]);
      setProgress((p) => Math.min(96, p + 18));
    }, 900);
  };
  const stopProgress = (ok: boolean) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(ok ? 100 : 0);
    if (ok) setStage("Done!");
  };

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast.error("Upload a PNG, JPG, or WEBP image.");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image uploads must be 8 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => { setImageDataUrl(String(reader.result)); setImageName(file.name); setInputMode("image"); };
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
    setBusy(true); setResult(null); setLimitMsg(null); startProgress();
    try {
      const out = await run({ data: { generationKind: kind, prompt: prompt.trim(), ...(projectId ? { projectId } : {}), inputMode, ...(imageDataUrl ? { imageDataUrl } : {}), modelType, robloxStyle, theme, material, textureLook, primaryColor, secondaryColor, textWords, textFont, textEffect, textAnimation, textSize, animationType, animationTarget, animationDuration, animationLooped, quality, format: rigged && format === "OBJ" ? "FBX" : format, faceLimit, texture, rigged } }) as Generate3DResult;
      if (out.ok) {
        stopProgress(true); setResult(out); setNextAvailable(out.nextAvailable); setStatus((s) => s ? { ...s, canGenerate: false, nextAvailable: out.nextAvailable } : s);
        toast.success(`Generation ready! ${out.creditsSpent} credits used.`);
      } else {
        stopProgress(false); setLimitMsg(out.error); setNextAvailable(out.nextAvailable ?? null); toast.error(out.error);
      }
    } catch (err: any) {
      stopProgress(false); toast.error(err?.message ?? "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || locked || (kind === "model" ? (inputMode === "text" ? !prompt.trim() : !imageDataUrl) : kind === "text" ? !textWords.trim() : !prompt.trim());

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-10">
        <section className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3"><Box className="h-3.5 w-3.5" /> 3D Model Generator</div>
          <h1 className="text-3xl sm:text-4xl font-bold">Roblox 3D Generator Studio</h1>
          <p className="mt-2 text-muted-foreground">Generate customizable 3D models, 3D text, and animation blueprints with Studio-ready output.</p>
          <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-3 text-xs">
            <span className="rounded-full border border-border bg-surface/60 px-3 py-1">Credits: {status?.isOwner ? "unlimited" : status?.credits ?? "..."}</span>
            <span className="rounded-full border border-border bg-surface/60 px-3 py-1">{cost} credits / generation</span>
            <span className="rounded-full border border-border bg-surface/60 px-3 py-1">1 weekly cooldown per account</span>
          </div>
          {locked && nextAvailable && <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4 text-left"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold text-amber-200"><Clock className="h-4 w-4" /> Generation cooldown active</div><p className="mt-1 text-xs text-muted-foreground">Unlocks {fmtDate(nextAvailable)}. The generate button unlocks automatically.</p></div><div className="rounded-xl border border-amber-300/30 bg-background/50 px-4 py-2 text-center"><div className="text-2xl font-black text-amber-200">{eta(nextAvailable)}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">remaining</div></div></div></div>}
        </section>

        <section className="mb-5 grid gap-3 md:grid-cols-3">
          <ModeCard active={kind === "model"} icon={<Box className="h-4 w-4 text-primary" />} title="3D Models" text="Pets, weapons, props, maps, vehicles, tools, accessories." onClick={() => setKind("model")} />
          <ModeCard active={kind === "text"} icon={<Type className="h-4 w-4 text-primary" />} title="3D Text" text="Words, fonts, colors, materials, effects, and motion." onClick={() => setKind("text")} />
          <ModeCard active={kind === "animation"} icon={<Film className="h-4 w-4 text-primary" />} title="Animations" text="Idle, walk, run, attack, emote, dance, pet, NPC, and tool blueprints." onClick={() => setKind("animation")} />
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface/60 p-5 shadow-lg">
            {kind === "model" && <div className="mb-4 flex rounded-xl border border-border bg-background/50 p-1"><Tab active={inputMode === "text"} onClick={() => setInputMode("text")} icon={<WandSparkles className="h-3.5 w-3.5" />} label="Text to 3D" /><Tab active={inputMode === "image"} onClick={() => setInputMode("image")} icon={<Upload className="h-3.5 w-3.5" />} label="Image to 3D" /></div>}
            {kind === "model" && inputMode === "image" && <div className="mb-4 rounded-xl border border-dashed border-primary/35 bg-primary/5 p-3"><label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg bg-background/40 px-4 py-5 text-center"><Upload className="h-6 w-6 text-primary" /><span className="text-sm font-semibold">{imageName || "Upload a safe reference image"}</span><span className="text-[11px] text-muted-foreground">PNG, JPG, or WEBP. Unsafe content is blocked.</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => pickImage(e.target.files?.[0] ?? null)} className="sr-only" /></label>{imageDataUrl && <img src={imageDataUrl} alt="Reference preview" className="mt-3 max-h-56 w-full rounded-lg border border-border object-contain" />}</div>}
            {kind === "text" && <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_120px]"><TextInput label="3D text words" value={textWords} onChange={setTextWords} /><NumberInput label="Size" value={textSize} min={1} max={30} onChange={setTextSize} /></div>}
            <label className="block text-sm font-semibold mb-2">{kind === "animation" ? "Describe the animation" : kind === "text" ? "Extra styling notes" : "Describe your model"}</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={kind === "animation" ? "e.g. a confident sword slash that starts calm, swings right, then recovers" : "e.g. a low-poly treasure chest with gold trim"} rows={3} maxLength={1024} disabled={busy} className="w-full resize-none rounded-xl border border-border bg-background/60 px-3.5 py-3 text-sm outline-none focus:border-primary/50 disabled:opacity-60" />

            <div className="mt-5 space-y-4 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Settings2 className="h-3.5 w-3.5" /> Customization</div>
              {projects.length > 0 && <label className="block text-xs font-medium">Insert package into project<select value={projectId} disabled={busy} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"><option value="">Download only</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
              {kind === "model" && <><Group label="Model type"><Chips value={modelType} set={setModelType} items={modelTypes} /></Group><Group label="Roblox style"><Chips value={robloxStyle} set={setRobloxStyle} items={styles} /></Group></>}
              {kind === "animation" && <><Group label="Animation type"><Chips value={animationType} set={setAnimationType} items={animationTypes} /></Group><div className="grid grid-cols-2 gap-2"><TextInput label="Target" value={animationTarget} onChange={setAnimationTarget} /><NumberInput label="Duration" value={animationDuration} min={0.25} max={30} step={0.25} onChange={setAnimationDuration} /></div><Toggle checked={animationLooped} onChange={setAnimationLooped} label="Looped animation" /></>}
              <Group label="Theme"><Chips value={theme} set={setTheme} items={themes} /></Group>
              <Group label="Material"><Chips value={material} set={setMaterial} items={materials} /></Group>
              <div className="grid grid-cols-2 gap-2"><ColorInput label="Primary color" value={primaryColor} onChange={setPrimaryColor} /><ColorInput label="Secondary color" value={secondaryColor} onChange={setSecondaryColor} /></div>
              {kind === "text" && <><Group label="Font"><Chips value={textFont} set={setTextFont} items={["GothamBlack", "FredokaOne", "Bangers", "Cartoon", "Arcade", "SciFi"]} /></Group><Group label="Effect"><Chips value={textEffect} set={setTextEffect} items={["neon", "outline", "gold", "ice", "shadow"]} /></Group><Group label="Animation"><Chips value={textAnimation} set={setTextAnimation} items={["float", "pulse", "spin", "bounce", "none"]} /></Group></>}
              {kind === "model" && <><Group label="Quality"><Chips value={quality} set={setQuality} items={["turbo", "standard", "detailed"]} /></Group><Group label="Format"><Chips value={format} set={setFormat} items={["GLB", "OBJ", "FBX"]} /></Group><label className="block text-xs font-medium">Polygon budget: {faceLimit.toLocaleString()}<input type="range" min={1000} max={50000} step={1000} value={faceLimit} onChange={(e) => setFaceLimit(Number(e.target.value))} className="mt-1 w-full accent-emerald-500" /></label><Group label="Texture look"><Chips value={textureLook} set={setTextureLook} items={textureLooks} /></Group><Toggle checked={texture} onChange={setTexture} label="Generate textures" /><Toggle checked={rigged} onChange={(v) => { setRigged(v); if (v && format === "OBJ") setFormat("FBX"); }} label="Rigged / animation-ready export" /></>}
              <div className="flex gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-100"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />Server safety checks block unsafe text and images before any paid generation starts.</div>
            </div>
            <button onClick={generate} disabled={disabled} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-40">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : locked ? <><Clock className="h-4 w-4" /> Available in {eta(nextAvailable)}</> : <><Sparkles className="h-4 w-4" /> Generate {kind === "text" ? "3D text" : kind === "animation" ? "animation" : inputMode === "image" ? "image-to-3D" : "3D model"} - {cost} credits</>}</button>
            {busy && <div className="mt-4"><div className="h-2.5 w-full overflow-hidden rounded-full bg-background/70 border border-border"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-300" style={{ width: `${progress}%` }} /></div><div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground"><span>{stage}</span><span>{Math.round(progress)}%</span></div></div>}
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5 shadow-lg flex flex-col">
            <div className="mb-3 text-sm font-semibold">Preview & Studio Output</div>
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-[#0a0e0c]">{kind === "text" ? <TextPreview words={textWords} color={primaryColor} secondary={secondaryColor} /> : result?.previewGlbUrl ? <ModelViewer url={result.previewGlbUrl} /> : result?.generationKind === "animation" ? <div className="absolute inset-0 grid place-items-center px-6 text-center"><div><Film className="mx-auto h-10 w-10 text-primary" /><h3 className="mt-3 font-bold">Animation blueprint ready</h3><p className="mt-2 text-xs text-muted-foreground">Download the ModuleScript or open the selected project with the Studio plugin.</p></div></div> : <div className="absolute inset-0 grid place-items-center text-center px-6">{busy ? <div className="flex flex-col items-center gap-3 text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="text-xs">{stage || "Working..."}</span></div> : <div className="text-muted-foreground"><Box className="mx-auto h-10 w-10 opacity-40" /><p className="mt-2 text-xs">Your generated asset preview and Studio package appears here.</p></div>}</div>}</div>
            {result && <div className="mt-4 space-y-3"><a href={result.fileUrl} download className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"><Download className="h-4 w-4" /> Download {result.format === "LUA" ? "Studio package" : result.format}</a>{result.studioFilePath && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">Queued in project file: <span className="font-mono">{result.studioFilePath}</span></div>}<div className="rounded-xl border border-border bg-background/50 p-3 text-sm"><div className="flex items-center gap-2 font-semibold mb-1"><Info className="h-4 w-4 text-primary" /> Roblox Studio insert</div><p className="text-xs text-muted-foreground">{result.importTip}</p></div>{result.studioScript && <details className="rounded-xl border border-border bg-background/50 p-3 text-xs"><summary className="cursor-pointer font-semibold">Preview generated Roblox code</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{result.studioScript}</pre></details>}{nextAvailable && <p className="text-xs text-muted-foreground">Next generation unlocks {fmtDate(nextAvailable)} ({eta(nextAvailable)}).</p>}</div>}
            {limitMsg && !result && <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><div className="flex items-center gap-2 font-semibold text-amber-400"><Clock className="h-4 w-4" /> Not available right now</div><p className="mt-1 text-foreground/80">{limitMsg}</p>{nextAvailable && <p className="mt-1 text-xs text-muted-foreground">Available {fmtDate(nextAvailable)} ({eta(nextAvailable)}).</p>}</div>}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ModeCard({ active, icon, title, text, onClick }: { active: boolean; icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary/60 bg-primary/15" : "border-border bg-surface/50 hover:border-primary/35"}`}><div className="flex items-center gap-2 font-bold">{icon}{title}</div><p className="mt-1 text-xs text-muted-foreground">{text}</p></button>;
}
function Tab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{icon}{label}</button>;
}
function Group({ label, children }: { label: string; children: ReactNode }) {
  return <div><div className="mb-1.5 text-xs font-medium">{label}</div>{children}</div>;
}
function Chips({ value, set, items }: { value: string; set: (v: any) => void; items: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{items.map((item) => <button key={item} type="button" onClick={() => set(item)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${value === item ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:text-foreground"}`}>{item}</button>)}</div>;
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="flex items-center gap-2 text-xs font-medium cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-500" />{label}</label>;
}
function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs font-medium">{label}<input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs" /></label>;
}
function NumberInput({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <label className="text-xs font-medium">{label}<input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs" /></label>;
}
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs font-medium">{label}<input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background/60 p-1" /></label>;
}

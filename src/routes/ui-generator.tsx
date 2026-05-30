import { createFileRoute } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import { useEffect, useRef, useState } from "react";
import { streamImage } from "@/lib/streamImage";
import { useServerFn } from "@tanstack/react-start";
import {
  generateRobloxUIFn,
  listUIGenerationsFn,
  getUIGenerationFn,
  deleteUIGenerationFn,
  insertUIIntoStudioFn,
  UI_GEN_CREDIT_COST,
} from "@/lib/ui-generator.functions";
import { UI_STYLES, type UIStyle, type UICategory } from "@/lib/ui-generator.shared";
import { TemplateGrid } from "@/components/ui-generator/TemplateGrid";
import { UIPreview } from "@/components/ui-generator/UIPreview";
import { DevicePreviewFrame, type DeviceMode } from "@/components/ui-generator/DevicePreviewFrame";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Braces,
  Code2,
  Eye,
  Image as ImageIcon,
  Layers3,
  Library,
  Loader2,
  Monitor,
  Palette,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

export const Route = createFileRoute("/ui-generator")({
  component: UIGeneratorPage,
  head: () => ({
    meta: [
      { title: "UI Generator — Roblox GUI Builder | BloxSmith" },
      {
        name: "description",
        content:
          "Generate beautiful Roblox UIs: shops, menus, HUDs, inventories. Preview on desktop & mobile, then insert into Studio with one click.",
      },
    ],
  }),
});

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "").match(/.{1,2}/g) ?? ["ff", "ff", "ff"];
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

type LibraryItem = {
  id: string;
  title: string;
  category: string;
  style: string | null;
  created_at: string;
};

const VIEW_TABS = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "luau", label: "Luau", icon: Code2 },
  { id: "spec", label: "Spec", icon: Braces },
] as const;

function UIGeneratorPage() {
  const { user } = useAuth();
  const generateFn = useServerFn(generateRobloxUIFn);
  const listFn = useServerFn(listUIGenerationsFn);
  const getFn = useServerFn(getUIGenerationFn);
  const deleteFn = useServerFn(deleteUIGenerationFn);
  const insertFn = useServerFn(insertUIIntoStudioFn);

  const [category, setCategory] = useState<UICategory>("Gamepass Shop");
  const [style, setStyle] = useState<UIStyle>("Modern");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [primary, setPrimary] = useState("#f59e0b");
  const [accent, setAccent] = useState("#8b5cf6");
  const [bg, setBg] = useState("#0f172a");

  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"preview" | "image" | "luau" | "spec">("preview");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [result, setResult] = useState<{
    id: string | null;
    spec: any;
    actions: any[];
    files: any[];
  } | null>(null);

  // Image preview state
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgFinal, setImgFinal] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const imgAbortRef = useRef<AbortController | null>(null);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [inserting, setInserting] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [showLib, setShowLib] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,name")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      const items = data ?? [];
      setProjects(items);
      if (items[0]) setProjectId(items[0].id);
    })();
    refreshLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refreshLibrary = async () => {
    if (!user) return;
    try {
      const res: any = await listFn({ data: { limit: 30 } });
      setLibrary(res?.items ?? []);
    } catch {
      /* ignore */
    }
  };

  const run = async () => {
    if (!user) {
      toast.error("Sign in to generate UIs.");
      return;
    }
    const effectivePrompt =
      prompt.trim() ||
      `A polished ${style.toLowerCase()} ${category} for a Roblox game. Include all expected sections, buttons, and labels.`;
    setBusy(true);
    try {
      const res: any = await generateFn({
        data: {
          category,
          style,
          prompt: effectivePrompt,
          title: title.trim() || undefined,
          primaryColor: hexToRgb(primary),
          accentColor: hexToRgb(accent),
          bgColor: hexToRgb(bg),
          projectId: projectId || undefined,
        },
      });
      if (!res?.spec?.root || !Array.isArray(res?.actions) || res.actions.length === 0) {
        throw new Error("The generator returned an empty UI. Please try again.");
      }
      setResult({ id: res.id, spec: res.spec, actions: res.actions, files: res.files });
      setImgSrc(null);
      setImgFinal(false);
      setImgError(null);
      setTab("preview");
      toast.success(`UI generated — charged ${res.creditsCharged} credits.`);
      refreshLibrary();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const openSaved = async (id: string) => {
    try {
      const row: any = await getFn({ data: { id } });
      setResult({ id: row.id, spec: row.spec, actions: row.actions ?? [], files: row.files ?? [] });
      setCategory(row.category);
      if (row.style) setStyle(row.style as UIStyle);
      setImgSrc(null);
      setImgFinal(false);
      setImgError(null);
      setTab("preview");
      setShowLib(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open.");
    }
  };

  const generateImage = async () => {
    if (!result) return;
    imgAbortRef.current?.abort();
    const ctrl = new AbortController();
    imgAbortRef.current = ctrl;
    setImgBusy(true);
    setImgError(null);
    setImgFinal(false);
    setImgSrc(null);

    const sections: string[] = Array.isArray(result.spec?.sections)
      ? result.spec.sections
          .slice(0, 8)
          .map((s: any) => (typeof s === "string" ? s : s?.title || s?.name || ""))
          .filter(Boolean)
      : [];
    const titleText = result.spec?.title || title || category;
    const prompt = [
      `A high-fidelity screenshot of a ${style} Roblox in-game ${category} GUI titled "${titleText}".`,
      `Color palette — primary ${primary}, accent ${accent}, background ${bg}.`,
      sections.length ? `Visible sections: ${sections.join(", ")}.` : "",
      `Clean modern game UI: rounded corners, soft shadows, crisp typography, glossy buttons, icons, subtle gradients.`,
      `Composed on a transparent-feeling Roblox game viewport, sharp UI, 1:1 framing, no watermark, no text artifacts.`,
    ]
      .filter(Boolean)
      .join(" ");

    try {
      await streamImage(
        "/api/generate-image",
        { prompt, size: "1024x1024" },
        (dataUrl, isFinal) => {
          setImgSrc(dataUrl);
          if (isFinal) setImgFinal(true);
        },
        ctrl.signal,
      );
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setImgError(e?.message || "Image generation failed.");
        toast.error(e?.message || "Image generation failed.");
      }
    } finally {
      setImgBusy(false);
    }
  };

  useEffect(() => () => imgAbortRef.current?.abort(), []);

  const removeSaved = async (id: string) => {
    if (!confirm("Delete this saved UI?")) return;
    try {
      await deleteFn({ data: { id } });
      setLibrary((l) => l.filter((i) => i.id !== id));
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed.");
    }
  };

  const insert = async () => {
    if (!result) return;
    if (!projectId) {
      toast.error("Pick a project first.");
      return;
    }
    setInserting(true);
    try {
      const res: any = await insertFn({
        data: { projectId, actions: result.actions, generationId: result.id ?? undefined },
      });
      toast.success(
        `Queued ${res.queued} actions for "${res.projectName}". Open Studio and Sync to apply.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Insertion failed.");
    } finally {
      setInserting(false);
    }
  };

  const luauPreview = result
    ? [
        `-- ${result.spec.title}`,
        `-- ScreenGui: ${result.spec.screenGuiName}`,
        result.spec.remoteEvents?.length
          ? `\n-- RemoteEvents:\n${result.spec.remoteEvents.map((r: string) => `--   ${r}`).join("\n")}`
          : "",
        result.spec.localScript ? `\n-- LocalScript:\n${result.spec.localScript}` : "",
        result.spec.serverScript ? `\n-- ServerScript:\n${result.spec.serverScript}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const activeTitle = (result?.spec?.title ?? title.trim()) || category;
  const activeScreenGui = result?.spec?.screenGuiName ?? "Ready to generate";
  const generationStats = result
    ? [
        { label: "Actions", value: String(result.actions.length) },
        { label: "Scripts", value: String(result.files.length) },
        { label: "Remotes", value: String(result.spec.remoteEvents?.length ?? 0) },
      ]
    : [
        { label: "Template", value: category },
        { label: "Style", value: style },
        { label: "Cost", value: `${UI_GEN_CREDIT_COST}` },
      ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-[1680px] px-3 sm:px-5 py-4 space-y-4">
        <header className="glass rounded-lg p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/12">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold leading-tight sm:text-2xl">UI Generator</h1>
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Builder
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{activeTitle}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/45 sm:inline-block" />
                  <span className="font-mono">{activeScreenGui}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {generationStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-border/80 bg-background/35 px-2.5 py-1.5"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="max-w-[9rem] truncate text-sm font-semibold">{item.value}</div>
                </div>
              ))}
              <button
                onClick={() => setShowLib((s) => !s)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-elevated"
              >
                <Library className="w-4 h-4" /> Library ({library.length})
              </button>
            </div>
          </div>
        </header>

        {showLib && (
          <section className="glass rounded-lg p-4 space-y-2">
            <h2 className="text-sm font-semibold mb-2">Saved UIs</h2>
            {library.length === 0 ? (
              <p className="text-xs text-muted-foreground">Your saved generations will appear here.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {library.map((it) => (
                  <div key={it.id} className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-1">
                    <div className="text-sm font-medium line-clamp-1">{it.title}</div>
                    <div className="text-[11px] text-muted-foreground">{it.category} · {it.style ?? "—"}</div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => openSaved(it.id)} className="flex-1 text-xs rounded-md bg-secondary px-2 py-1 hover:bg-secondary/80">Open</button>
                      <button onClick={() => removeSaved(it.id)} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-surface-elevated" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[390px_1fr] gap-4 items-start">
          {/* Customizer */}
          <aside className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
            <section className="glass rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <SectionTitle icon={Layers3} label="Template" />
                <span className="rounded-md border border-border bg-background/30 px-2 py-1 text-[10px] text-muted-foreground truncate max-w-[55%]" title={category}>{category}</span>
              </div>
              <TemplateGrid active={category} onPick={setCategory} />
            </section>

            <section className="glass rounded-lg p-3 space-y-3">
              <SectionTitle icon={Palette} label="Style & Prompt" />
              <div className="grid grid-cols-3 gap-1.5">
                {UI_STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`rounded-md border px-2.5 py-2 text-xs font-medium transition ${
                      style === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-background/35 hover:bg-surface hover:border-primary/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <ColorField label="Primary" value={primary} onChange={setPrimary} />
                <ColorField label="Accent" value={accent} onChange={setAccent} />
                <ColorField label="Background" value={bg} onChange={setBg} />
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title text (optional)"
                className="w-full rounded-lg bg-background/35 border border-border px-3 py-2 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder={`Describe extras for this ${category}… (optional)`}
                className="w-full rounded-lg bg-background/35 border border-border px-3 py-2 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <button
                onClick={run}
                disabled={busy}
                className="btn-shine w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_-18px_var(--primary)] hover:brightness-110 disabled:opacity-60 transition"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {busy ? "Generating…" : `Generate — ${UI_GEN_CREDIT_COST} credits`}
              </button>
            </section>

            {result && (
              <section className="glass rounded-lg p-3 space-y-3">
                <SectionTitle icon={Send} label="Insert into Studio" />
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-lg bg-background/35 border border-border px-2 py-2 text-sm"
                >
                  {projects.length === 0 && <option value="">No projects — create one first</option>}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={insert}
                  disabled={inserting || !projectId}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium hover:bg-secondary/80 disabled:opacity-60"
                >
                  {inserting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {inserting ? "Queueing…" : "Insert into Roblox Studio"}
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Queues {result.actions.length} Studio actions. Open Studio with the plugin connected and run Sync.
                </p>
              </section>
            )}
          </aside>

          {/* Preview */}
          <section className="glass rounded-lg p-3 flex flex-col lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] min-h-[640px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/12 text-primary">
                    <Monitor className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{activeTitle}</h2>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {activeScreenGui}
                    </p>
                  </div>
                </div>
              </div>
              <div className="inline-flex rounded-lg bg-background/35 border border-border p-0.5">
                {VIEW_TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                      tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              {tab === "preview" && (
                <div className="inline-flex rounded-lg bg-background/35 border border-border p-0.5">
                  <button
                    onClick={() => setDevice("desktop")}
                    className={`px-2.5 py-1 text-xs rounded-md inline-flex items-center gap-1 transition ${
                      device === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop
                  </button>
                  <button
                    onClick={() => setDevice("mobile")}
                    className={`px-2.5 py-1 text-xs rounded-md inline-flex items-center gap-1 transition ${
                      device === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile
                  </button>
                </div>
              )}
              {tab === "image" && result && (
                <button
                  onClick={generateImage}
                  disabled={imgBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated disabled:opacity-60"
                >
                  {imgBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : imgSrc ? (
                    <RefreshCw className="h-3.5 w-3.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {imgBusy ? "Rendering…" : imgSrc ? "Regenerate" : "Render image"}
                </button>
              )}
              <div className="ml-auto flex flex-wrap gap-1.5">
                {generationStats.map((item) => (
                  <span
                    key={item.label}
                    className="rounded-md border border-border/70 bg-background/30 px-2 py-1 text-[10px] text-muted-foreground"
                  >
                    {item.label}: <strong className="text-foreground">{item.value}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {busy ? (
                <UILoadingScreen styleName={style} categoryName={category} />
              ) : !result ? (
                <div className="h-full min-h-[480px] flex flex-col items-center justify-center text-center px-8 rounded-lg border border-dashed border-border/70 bg-background/25">
                  <div className="mb-5 w-full max-w-md rounded-lg border border-border bg-surface/60 p-4 text-left shadow-[0_20px_60px_-36px_rgba(0,0,0,0.8)]">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="h-3 w-28 rounded bg-primary/60" />
                      <div className="h-8 w-8 rounded-md bg-surface-elevated" />
                    </div>
                    <div className="grid grid-cols-[1fr_120px] gap-3">
                      <div className="space-y-2">
                        <div className="h-24 rounded-lg border border-primary/40 bg-primary/10" />
                        <div className="h-10 rounded-lg bg-surface-elevated" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-8 rounded-md bg-surface-elevated" />
                        <div className="h-8 rounded-md bg-surface-elevated" />
                        <div className="h-8 rounded-md bg-surface-elevated" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold mb-1">Your UI will appear here</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Pick a template and style on the left, tweak your colors, then hit Generate to see a live Roblox-style preview.
                  </p>
                </div>
              ) : tab === "preview" ? (
                <div className="h-full min-h-[480px]">
                  <DevicePreviewFrame mode={device}>
                    <UIPreview spec={result.spec} bg={bg} />
                  </DevicePreviewFrame>
                </div>
              ) : tab === "image" ? (
                <div className="h-full min-h-[480px] flex items-center justify-center rounded-lg border border-border bg-background/40 p-3">
                  {imgSrc ? (
                    <div className="relative flex h-full w-full items-center justify-center">
                      <img
                        src={imgSrc}
                        alt="AI-rendered UI preview"
                        className={`max-h-full max-w-full rounded-lg shadow-2xl transition-[filter] duration-300 ${
                          imgFinal ? "blur-0" : "blur-2xl"
                        }`}
                      />
                      {!imgFinal && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Rendering preview…
                        </div>
                      )}
                    </div>
                  ) : imgBusy ? (
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      Rendering image preview…
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center px-6">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
                        <div className="relative grid h-14 w-14 place-items-center rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30">
                          <ImageIcon className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold mb-1">Render a real image preview</h3>
                      <p className="text-xs text-muted-foreground max-w-xs mb-3">
                        Use AI to generate a high-fidelity screenshot of this {category} based on your style and colors.
                      </p>
                      <button
                        onClick={generateImage}
                        disabled={imgBusy}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary/85 px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Render image
                      </button>
                      {imgError && (
                        <p className="mt-3 text-[11px] text-destructive max-w-xs">{imgError}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : tab === "luau" ? (
                <pre className="text-[11px] leading-relaxed bg-surface rounded-lg p-3 overflow-auto h-full whitespace-pre-wrap">
                  {luauPreview || "(no scripts in this UI)"}
                </pre>
              ) : (
                <pre className="text-[11px] leading-relaxed bg-surface rounded-lg p-3 overflow-auto h-full">
                  {JSON.stringify(result.spec, null, 2)}
                </pre>
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {label}
    </h2>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 rounded-lg bg-background/35 border border-border px-1.5 py-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 rounded-md cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-xs outline-none"
        />
      </div>
    </label>
  );
}

interface UILoadingScreenProps {
  styleName: string;
  categoryName: string;
}

function UILoadingScreen({ styleName, categoryName }: UILoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  const statuses = [
    "Contacting AI model proxy...",
    `Initializing Roblox GUI structure for '${categoryName}'...`,
    `Applying '${styleName}' theme variables and color palettes...`,
    "Constructing element positioning tree (UDim2 frames)...",
    "Composing Roblox stroke borders, gradients, and rounded corners...",
    "Generating Luau LocalScript controller for button events...",
    "Synthesizing ServerScript and registering RemoteEvents...",
    "Validating complete ScreenGui schema output...",
    "Polishing layout constraints...",
  ];

  const totalDuration = 8000;
  const updateInterval = 100;

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const computedProgress = Math.min(96, Math.floor((elapsed / totalDuration) * 100));
      setProgress(computedProgress);

      const newIdx = Math.min(
        statuses.length - 1,
        Math.floor((computedProgress / 100) * statuses.length)
      );
      setStatusIdx(newIdx);
    }, updateInterval);

    return () => clearInterval(timer);
  }, [categoryName, styleName]);

  const secondsLeft = Math.max(1, Math.ceil(((100 - progress) * totalDuration) / 100000));

  return (
    <div className="h-full min-h-[480px] flex flex-col items-center justify-center p-8 rounded-lg border border-border/80 bg-background/40 backdrop-blur relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--border)_35%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_oklab,var(--border)_30%,transparent)_1px,transparent_1px)] bg-[length:34px_34px] opacity-40" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full space-y-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-dashed border-primary/30 animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-2 rounded-full border-4 border-t-primary border-r-transparent border-b-accent border-l-transparent animate-spin" />
          <div className="absolute inset-5 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_45%,transparent)]">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Generating Roblox UI</h3>
          <p className="text-xs text-muted-foreground bg-surface-elevated/40 border border-border/40 px-3 py-1.5 rounded-full inline-block font-mono animate-pulse">
            {statuses[statusIdx]}
          </p>
        </div>

        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>Progress: {progress}%</span>
            <span>ETA: ~{secondsLeft}s</span>
          </div>
          <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-border/40">
            <div
              className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/80 max-w-xs">
          BloxSmith is building and styling a <strong>{styleName}</strong> themed <strong>{categoryName}</strong>. Once complete, it will render in the preview frame below.
        </p>
      </div>
    </div>
  );
}

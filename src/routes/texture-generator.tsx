import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  Download,
  Grid3X3,
  Image as ImageIcon,
  Loader2,
  Palette,
  RefreshCw,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import { generateImageStudio, type GenerateImageResult } from "@/lib/image-studio.functions";

export const Route = createFileRoute("/texture-generator")({
  component: TextureGeneratorPage,
  head: () => ({
    meta: [
      { title: "AI Roblox Texture Generator | BloxSmith" },
      {
        name: "description",
        content:
          "Generate seamless Roblox textures, decals, terrain materials, UI patterns, and PBR-style material maps with BloxSmith Nano.",
      },
      {
        name: "keywords",
        content:
          "Roblox texture generator, AI texture maker, seamless Roblox material, Nano Banana texture generator, BloxSmith textures",
      },
      { property: "og:title", content: "AI Roblox Texture Generator | BloxSmith" },
      {
        property: "og:description",
        content:
          "Generate seamless Roblox textures, decals, terrain materials, UI patterns, and PBR-style material maps with BloxSmith Nano.",
      },
      { property: "og:url", content: "https://bloxsmith.pro/texture-generator" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/texture-generator" }],
  }),
});

type Model =
  | "google/gemini-2.5-flash-image"
  | "google/gemini-3-pro-image-preview"
  | "google/gemini-3.1-flash-image-preview";

const MODELS: { value: Model; label: string; tag: string }[] = [
  {
    value: "google/gemini-2.5-flash-image",
    label: "Nano Banana",
    tag: "Fast texture default",
  },
  {
    value: "google/gemini-3.1-flash-image-preview",
    label: "Gemini Flash",
    tag: "Sharp fallback",
  },
  { value: "google/gemini-3-pro-image-preview", label: "Gemini Pro", tag: "Best detail" },
];

const TEXTURE_TYPES = [
  "Seamless material",
  "Terrain tile",
  "Wall decal",
  "Floor tile",
  "UI pattern",
  "Particle sprite",
  "Skybox panel",
  "Normal-map style",
] as const;

const MATERIALS = [
  "mossy stone blocks",
  "clean sci-fi metal panels",
  "cartoon grass with tiny flowers",
  "lava cracked obsidian",
  "wood planks with toy-like grain",
  "snowy cobblestone",
  "neon circuit floor",
  "soft fabric weave",
];

const SURFACES = ["terrain", "wall", "floor", "prop", "UI", "decal", "particle"] as const;
const FINISHES = [
  "Roblox stylized",
  "low-poly",
  "pixel",
  "painted",
  "realistic",
  "toon PBR",
] as const;
const PALETTES = [
  "auto",
  "bright",
  "muted",
  "neon",
  "earthy",
  "icy",
  "volcanic",
  "pastel",
] as const;
const TILE_SIZES = ["256x256", "512x512", "1024x1024"] as const;

function TextureGeneratorPage() {
  const { user, profile, isOwner } = useAuth();
  const generate = useServerFn(generateImageStudio);
  const fileInput = useRef<HTMLInputElement>(null);

  const [textureType, setTextureType] =
    useState<(typeof TEXTURE_TYPES)[number]>("Seamless material");
  const [material, setMaterial] = useState("mossy stone blocks");
  const [surface, setSurface] = useState<(typeof SURFACES)[number]>("terrain");
  const [finish, setFinish] = useState<(typeof FINISHES)[number]>("Roblox stylized");
  const [palette, setPalette] = useState<(typeof PALETTES)[number]>("auto");
  const [tileSize, setTileSize] = useState<(typeof TILE_SIZES)[number]>("512x512");
  const [seamless, setSeamless] = useState(true);
  const [avoidPerspective, setAvoidPerspective] = useState(true);
  const [model, setModel] = useState<Model>("google/gemini-2.5-flash-image");
  const [variations, setVariations] = useState(1);
  const [customNotes, setCustomNotes] = useState(
    "make it game-ready, clean edges, no text, no watermark",
  );
  const [refImage, setRefImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateImageResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const prompt = useMemo(() => {
    return [
      `${textureType} for Roblox ${surface}: ${material}.`,
      `${finish} texture, ${tileSize} target, square 1:1 output.`,
      palette !== "auto" ? `${palette} color palette.` : "Use a balanced game-art color palette.",
      seamless
        ? "Must be seamless and tileable on all edges, repeatable pattern, no obvious seams."
        : "Does not need to tile, but should still be clean and reusable.",
      avoidPerspective
        ? "Flat orthographic top-down or front-facing texture, even lighting, no camera perspective."
        : "Mild depth is allowed while keeping the texture reusable.",
      customNotes.trim(),
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    avoidPerspective,
    customNotes,
    finish,
    material,
    palette,
    seamless,
    surface,
    textureType,
    tileSize,
  ]);

  const selectedImage = result?.ok ? result.images[selectedIndex]?.url : null;
  const creditsNeeded = variations * 2;
  const credits = profile?.credits ?? 0;
  const canAfford = !user || isOwner || credits >= creditsNeeded;

  function pickReference(file: File) {
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Reference image must be under 6 MB.");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      toast.error("Use a PNG, JPG, or WEBP reference image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setRefImage(String(reader.result));
    reader.onerror = () => toast.error("Could not read that image.");
    reader.readAsDataURL(file);
  }

  async function onGenerate() {
    if (!user) {
      toast.error("Please sign in to generate textures.");
      return;
    }
    if (material.trim().length < 3) {
      toast.error("Describe the material you want.");
      return;
    }
    setLoading(true);
    setResult(null);
    setSelectedIndex(0);
    try {
      const res = await generate({
        data: {
          prompt,
          negativePrompt:
            "visible seams, perspective camera angle, characters, logos, readable text, watermark, blurry, low quality, photo border",
          model,
          aspectRatio: "1:1",
          quality: "high",
          variations,
          stylePreset:
            finish === "pixel" ? "pixel" : finish === "realistic" ? "photoreal" : "3d-render",
          referenceImageDataUrl: refImage ?? undefined,
        },
      });
      setResult(res);
      if (!res.ok) toast.error(res.error);
      else
        toast.success(`Generated ${res.images.length} texture${res.images.length > 1 ? "s" : ""}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Texture generation failed.";
      toast.error(message);
      setResult({ ok: false, error: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              BloxSmith Nano texture studio
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-5xl">AI Texture Generator</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Make seamless Roblox-ready materials, decals, terrain tiles, UI patterns, and sprites.
            </p>
          </div>
          <Link
            to="/image-generator"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold transition hover:border-primary/40 sm:w-auto"
          >
            <ImageIcon className="h-4 w-4" /> Image studio
          </Link>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-6">
          <section className="glass min-w-0 rounded-2xl p-4 sm:p-5">
            <Field label="Texture type">
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TEXTURE_TYPES.map((item) => (
                  <Chip
                    key={item}
                    active={textureType === item}
                    onClick={() => setTextureType(item)}
                  >
                    {item}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Material" className="mt-5">
              <input
                value={material}
                onChange={(event) => setMaterial(event.target.value)}
                maxLength={180}
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary/50"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MATERIALS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMaterial(item)}
                    className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </Field>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Surface"
                value={surface}
                setValue={setSurface}
                options={SURFACES}
              />
              <SelectField label="Finish" value={finish} setValue={setFinish} options={FINISHES} />
              <SelectField
                label="Palette"
                value={palette}
                setValue={setPalette}
                options={PALETTES}
              />
              <SelectField
                label="Size hint"
                value={tileSize}
                setValue={setTileSize}
                options={TILE_SIZES}
              />
            </div>

            <div className="mt-5 grid gap-2">
              <Toggle checked={seamless} onChange={setSeamless} label="Seamless tile edges" />
              <Toggle
                checked={avoidPerspective}
                onChange={setAvoidPerspective}
                label="Flat reusable texture"
              />
            </div>

            <Field label="Extra notes" className="mt-5">
              <textarea
                value={customNotes}
                onChange={(event) => setCustomNotes(event.target.value)}
                rows={3}
                maxLength={500}
                className="mt-2 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary/50"
              />
            </Field>

            <Field label="Nano model" className="mt-5">
              <div className="mt-2 grid gap-2">
                {MODELS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setModel(item.value)}
                    className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
                      model === item.value
                        ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                        : "border-border bg-surface hover:border-primary/40"
                    }`}
                  >
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {item.tag}
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Variations"
                value={String(variations)}
                setValue={(value) => setVariations(Number(value))}
                options={["1", "2", "3", "4"]}
              />
              <Field label="Reference">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) pickReference(file);
                    event.target.value = "";
                  }}
                />
                {refImage ? (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={refImage}
                      alt="Reference"
                      className="h-10 w-10 rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setRefImage(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface hover:bg-background"
                      aria-label="Remove reference"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    <Upload className="h-4 w-4" /> Upload
                  </button>
                )}
              </Field>
            </div>

            {user && !canAfford && (
              <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
                You have {credits} credits. This needs {creditsNeeded}.
              </div>
            )}

            <button
              type="button"
              onClick={onGenerate}
              disabled={loading || !user || !canAfford}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading
                ? "Generating texture..."
                : isOwner
                  ? "Generate texture"
                  : `Generate texture · ${creditsNeeded} credits`}
            </button>
            {!user && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Sign in to generate textures with your BloxSmith credits.
              </p>
            )}
          </section>

          <section className="grid min-w-0 gap-5 lg:grid-rows-[auto_1fr]">
            <div className="glass min-w-0 rounded-2xl p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Palette className="h-4 w-4 text-primary" /> Prompt preview
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(prompt);
                    toast.success("Prompt copied.");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                >
                  <Check className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background/55 p-3 text-xs leading-relaxed text-muted-foreground">
                {prompt}
              </pre>
            </div>

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="glass min-w-0 rounded-2xl p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Grid3X3 className="h-4 w-4 text-primary" /> Tiled preview
                  </div>
                  {selectedImage && (
                    <a
                      href={selectedImage}
                      download
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                    >
                      <Download className="h-3.5 w-3.5" /> PNG
                    </a>
                  )}
                </div>
                <div className="min-h-72 overflow-hidden rounded-xl border border-border bg-surface/40 sm:min-h-[28rem]">
                  {loading ? (
                    <div className="grid h-72 place-items-center px-4 text-center sm:h-[28rem]">
                      <div>
                        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-semibold">Nano is painting your texture...</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Seamless textures usually take a few seconds longer.
                        </p>
                      </div>
                    </div>
                  ) : selectedImage ? (
                    <div
                      className="h-72 w-full sm:h-[28rem]"
                      style={{
                        backgroundImage: `url(${selectedImage})`,
                        backgroundRepeat: "repeat",
                        backgroundSize: "9rem 9rem",
                      }}
                    />
                  ) : result && !result.ok ? (
                    <div className="grid h-72 place-items-center p-6 text-center sm:h-[28rem]">
                      <div>
                        <p className="text-sm font-semibold text-destructive">Generation failed</p>
                        <p className="mt-2 max-w-md text-xs text-muted-foreground">
                          {result.error}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid h-72 place-items-center p-6 text-center text-muted-foreground sm:h-[28rem]">
                      <div>
                        <Grid3X3 className="mx-auto mb-3 h-10 w-10 opacity-45" />
                        <p className="text-sm">Generated seamless textures will tile here.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-5">
                <div className="glass rounded-2xl p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <RefreshCw className="h-4 w-4 text-primary" /> Variations
                  </div>
                  {result?.ok ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                      {result.images.map((image, index) => (
                        <button
                          key={`${image.url}:${index}`}
                          type="button"
                          onClick={() => setSelectedIndex(index)}
                          className={`overflow-hidden rounded-lg border transition ${
                            selectedIndex === index
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <img
                            src={image.url}
                            alt={`Texture variation ${index + 1}`}
                            className="aspect-square w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Generate up to four options, then pick the one that tiles the cleanest.
                    </p>
                  )}
                </div>

                <div className="glass rounded-2xl p-4 sm:p-5">
                  <div className="mb-3 text-sm font-bold">Roblox use</div>
                  <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                    <li>1. Download the PNG.</li>
                    <li>2. Upload it to Creator Dashboard as an image asset.</li>
                    <li>
                      3. Use it as a Decal, Texture, SurfaceAppearance, UI image, or terrain
                      reference.
                    </li>
                  </ol>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-xs font-semibold ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: T;
  setValue: (value: T) => void;
  options: readonly T[];
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value as T)}
        className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary/50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition ${
        active
          ? "border-primary/70 bg-primary/15 text-foreground"
          : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-emerald-500"
      />
    </label>
  );
}

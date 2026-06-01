import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCode2,
  Film,
  Image as ImageIcon,
  Loader2,
  Mic2,
  Music2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import {
  generateMusicStudio,
  generateVideoStudio,
  getVideoStudioStatus,
  pollVideoStudio,
  transcribeStudioMedia,
  type GenerateMusicStudioResult,
  type GenerateVideoStudioResult,
  type PollVideoStudioResult,
  type TranscribeStudioResult,
} from "@/lib/video-studio.functions";
import type { VideoStudioSegment } from "@/lib/video-gen.server";

export const Route = createFileRoute("/video-generator")({
  component: VideoGeneratorPage,
  head: () => ({
    meta: [
      { title: "AI Roblox Video Generator | BloxSmith" },
      {
        name: "description",
        content:
          "Generate Roblox-safe AI videos with Seedance, create promo music, and transcribe creator clips for captions and scripts.",
      },
    ],
  }),
});

type Mode = "video" | "music" | "speech";
type VideoPreset =
  | "ad-promo"
  | "game-trailer"
  | "update-teaser"
  | "ugc-showcase"
  | "obby-run"
  | "tycoon-progress"
  | "simulator-hatch"
  | "horror-teaser"
  | "before-after-build"
  | "vertical-short";

const videoPresets: Array<{ id: VideoPreset; label: string; text: string }> = [
  { id: "ad-promo", label: "Ad promo", text: "Hook, gameplay reveal, CTA." },
  { id: "game-trailer", label: "Game trailer", text: "Scene reveal, action, logo beat." },
  { id: "update-teaser", label: "Update teaser", text: "New map, item, or feature." },
  { id: "ugc-showcase", label: "UGC showcase", text: "Clean item turntable." },
  { id: "obby-run", label: "Obby run", text: "Parkour, checkpoints, finish." },
  { id: "tycoon-progress", label: "Tycoon build", text: "Base to upgraded tycoon." },
  { id: "simulator-hatch", label: "Pet hatch", text: "Egg, rarity glow, lineup." },
  { id: "horror-teaser", label: "Spooky teaser", text: "PG suspense, no gore." },
  { id: "before-after-build", label: "Before/after", text: "Blockout to polished map." },
  { id: "vertical-short", label: "Vertical short", text: "TikTok/Reels framing." },
];

const durations = [5, 10, 15, 30, 60] as const;
const aspectRatios = ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"] as const;
const videoStyles = [
  "bright Roblox 3D",
  "cinematic trailer",
  "simulator colorful",
  "low-poly obby",
  "premium neon",
  "clean UGC",
];
const cameraMoves = [
  "smooth cinematic push",
  "fast dolly through map",
  "orbit reveal",
  "top-down transition",
  "handheld gameplay feel",
];
const pacingOptions = [
  "fast hook then clean reveal",
  "steady cinematic build",
  "quick social cuts",
  "calm product showcase",
];
const animationDirections = [
  "smooth Roblox avatar motion",
  "snappy simulator reward animation",
  "clean obby jump and landing motion",
  "slow product turntable animation",
  "cinematic camera-only movement",
  "gameplay-style running and collecting",
];
const musicStyles = [
  "upbeat electronic game trailer, clean loop",
  "bright simulator pop, no vocals",
  "cinematic promo drums, safe and energetic",
  "cute pet simulator chiptune",
  "spooky ambience, PG suspense",
  "victory stinger for Roblox UI",
];

function readFileAsDataUrl(file: File, maxBytes: number, allowed: RegExp) {
  return new Promise<string>((resolve, reject) => {
    if (!allowed.test(file.type)) {
      reject(new Error("Unsupported file type."));
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error(`File must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function eta(iso: string | null, now: number) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "now";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
}

function ratioBoxStyle(ratio: string) {
  const [w, h] = ratio.split(":").map(Number);
  return { aspectRatio: `${w || 16} / ${h || 9}` };
}

function robloxMusicScript(assetId: string, title: string) {
  const cleanId = assetId.replace(/\D/g, "") || "PASTE_AUDIO_ASSET_ID";
  const soundName = title.replace(/[^A-Za-z0-9_ ]/g, "").trim() || "BloxSmithMusic";
  return `-- BloxSmith Roblox music import
-- 1. Download the generated audio.
-- 2. Upload it to Roblox Creator Dashboard > Creations > Development Items > Audio.
-- 3. Replace the asset id below with your uploaded Roblox audio asset id.

local SoundService = game:GetService("SoundService")

local sound = SoundService:FindFirstChild(${JSON.stringify(soundName)}) or Instance.new("Sound")
sound.Name = ${JSON.stringify(soundName)}
sound.SoundId = "rbxassetid://${cleanId}"
sound.Volume = 0.55
sound.Looped = true
sound.RollOffMode = Enum.RollOffMode.InverseTapered
sound.Parent = SoundService

if not sound.IsLoaded then
  pcall(function()
    sound.Loaded:Wait()
  end)
end

sound:Play()
`;
}

function luaDataUrl(source: string) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(source)}`;
}

function VideoGeneratorPage() {
  const { user, profile, isOwner } = useAuth();
  const runVideo = useServerFn(generateVideoStudio);
  const getVideoStatus = useServerFn(getVideoStudioStatus);
  const pollVideo = useServerFn(pollVideoStudio);
  const runMusic = useServerFn(generateMusicStudio);
  const runTranscript = useServerFn(transcribeStudioMedia);

  const [mode, setMode] = useState<Mode>("video");
  const [prompt, setPrompt] = useState(
    "A Roblox simulator promo showing a new world, rewards, pets, and a final play-now end card.",
  );
  const [gameName, setGameName] = useState("BloxSmith Adventure");
  const [callToAction, setCallToAction] = useState("Play now and unlock the new area.");
  const [durationSeconds, setDurationSeconds] = useState<(typeof durations)[number]>(15);
  const [aspectRatio, setAspectRatio] = useState<(typeof aspectRatios)[number]>("9:16");
  const [preset, setPreset] = useState<VideoPreset>("ad-promo");
  const [style, setStyle] = useState(videoStyles[0]);
  const [camera, setCamera] = useState(cameraMoves[0]);
  const [pacing, setPacing] = useState(pacingOptions[0]);
  const [animationDirection, setAnimationDirection] = useState(animationDirections[0]);
  const [audience, setAudience] = useState("Roblox players");
  const [includeMusicCues, setIncludeMusicCues] = useState(true);
  const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState("");
  const [segments, setSegments] = useState<VideoStudioSegment[]>([]);
  const [storyboard, setStoryboard] = useState<string[]>([]);
  const [videoBusy, setVideoBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [videoStatus, setVideoStatus] = useState<{
    canGenerate: boolean;
    isOwner: boolean;
    credits: number;
    cost: number;
    nextAvailable: string | null;
  } | null>(null);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const [musicPrompt, setMusicPrompt] = useState(
    "A catchy clean Roblox promo loop for a bright simulator trailer with coins, pets, and victory energy.",
  );
  const [musicTitle, setMusicTitle] = useState("Roblox Promo Loop");
  const [musicStyle, setMusicStyle] = useState(musicStyles[0]);
  const [instrumental, setInstrumental] = useState(true);
  const [musicDuration, setMusicDuration] = useState<15 | 30 | 60 | 120>(30);
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicResult, setMusicResult] = useState<Extract<
    GenerateMusicStudioResult,
    { ok: true }
  > | null>(null);
  const [robloxAudioAssetId, setRobloxAudioAssetId] = useState("");

  const [mediaDataUrl, setMediaDataUrl] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [transcriptMode, setTranscriptMode] = useState<"transcript" | "captions" | "script-notes">(
    "captions",
  );
  const [transcriptBusy, setTranscriptBusy] = useState(false);
  const [transcript, setTranscript] = useState<Extract<
    TranscribeStudioResult,
    { ok: true }
  > | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const videoCredits = 8 + Math.ceil(durationSeconds / 15) * 8;
  const canAffordVideo = isOwner || (profile?.credits ?? 0) >= videoCredits;
  const weeklyLocked =
    !!videoStatus &&
    !videoStatus.canGenerate &&
    !videoStatus.isOwner &&
    !!nextAvailable &&
    new Date(nextAvailable).getTime() > now;
  const completedCount = segments.filter((segment) => segment.status === "completed").length;
  const readySegments = segments.filter((segment) => segment.videoUrl);
  const activeTaskIds = useMemo(
    () =>
      segments
        .map((segment) => segment.taskId)
        .filter((taskId): taskId is string => Boolean(taskId)),
    [segments],
  );
  const activeTaskKey = activeTaskIds.join("|");
  const segmentStatusKey = segments.map((segment) => segment.status).join("|");
  const hasPendingSegments = segments.some(
    (segment) => !["completed", "failed", "error"].includes(segment.status),
  );
  const clipPlan = useMemo(() => {
    const parts: number[] = [];
    let remaining = durationSeconds;
    while (remaining > 0) {
      const next = Math.min(15, remaining);
      parts.push(next);
      remaining -= next;
    }
    return parts;
  }, [durationSeconds]);
  const previewPreset = videoPresets.find((item) => item.id === preset);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    getVideoStatus({ data: undefined })
      .then((status) => {
        setVideoStatus(status);
        setNextAvailable(status.nextAvailable);
      })
      .catch(() => {});
  }, [getVideoStatus, user]);

  useEffect(() => {
    if (
      nextAvailable &&
      videoStatus &&
      !videoStatus.canGenerate &&
      new Date(nextAvailable).getTime() <= now
    ) {
      setVideoStatus({ ...videoStatus, canGenerate: true, nextAvailable: null });
      setNextAvailable(null);
    }
  }, [nextAvailable, now, videoStatus]);

  const pickReferenceImage = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(
        file,
        8 * 1024 * 1024,
        /^image\/(png|jpeg|jpg|webp)$/,
      );
      setReferenceImageDataUrl(dataUrl);
      setReferenceName(file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload image.");
    }
  };

  const pickMedia = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file, 20 * 1024 * 1024, /^(audio|video)\//);
      setMediaDataUrl(dataUrl);
      setMediaName(file.name);
      setTranscript(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload media.");
    }
  };

  const generateVideo = async () => {
    if (!user) return toast.error("Please log in to generate videos.");
    if (weeklyLocked) return toast.error("Your weekly AI video generation is still locked.");
    if (!canAffordVideo) return toast.error(`Video generation needs ${videoCredits} credits.`);
    setVideoBusy(true);
    setSegments([]);
    setStoryboard([]);
    try {
      const result = (await runVideo({
        data: {
          prompt,
          gameName,
          callToAction,
          durationSeconds,
          aspectRatio,
          preset,
          style,
          camera,
          pacing,
          animationDirection,
          audience,
          includeMusicCues,
          ...(referenceImageDataUrl ? { referenceImageDataUrl } : {}),
        },
      })) as GenerateVideoStudioResult;
      if (!result.ok) {
        toast.error(result.error);
        if (result.nextAvailable) {
          const lockedUntil = result.nextAvailable;
          setNextAvailable(result.nextAvailable);
          setVideoStatus((current) =>
            current ? { ...current, canGenerate: false, nextAvailable: lockedUntil } : current,
          );
        }
        return;
      }
      setSegments(result.segments);
      setStoryboard(result.storyboard);
      setNextAvailable(result.nextAvailable);
      setVideoStatus((current) =>
        current && result.nextAvailable
          ? { ...current, canGenerate: false, nextAvailable: result.nextAvailable }
          : current,
      );
      toast.success(`Video tasks started with Seedance. ${result.creditsSpent} credits used.`);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Video generation failed."));
    } finally {
      setVideoBusy(false);
    }
  };

  const refreshVideoStatus = useCallback(
    async (showToast = true) => {
      if (activeTaskIds.length === 0 || polling) return;
      setPolling(true);
      try {
        const result = (await pollVideo({
          data: { taskIds: activeTaskIds },
        })) as PollVideoStudioResult;
        if (!result.ok) {
          if (showToast) toast.error(result.error);
          return;
        }
        setSegments((current) =>
          current.map((segment) => {
            const update = result.segments.find((item) => item.taskId === segment.taskId);
            return update
              ? {
                  ...segment,
                  status: update.status,
                  progress: update.progress,
                  videoUrl: update.videoUrl || segment.videoUrl,
                  sourceVideoUrl: update.sourceVideoUrl || segment.sourceVideoUrl,
                  error: update.error,
                }
              : segment;
          }),
        );
        if (showToast) toast.success("Video status refreshed.");
      } catch (error: unknown) {
        if (showToast) toast.error(errorMessage(error, "Could not refresh video status."));
      } finally {
        setPolling(false);
      }
    },
    [activeTaskIds, pollVideo, polling],
  );

  useEffect(() => {
    if (activeTaskIds.length === 0 || !hasPendingSegments) return;
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      void refreshVideoStatus(false);
    }, 12_000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [
    activeTaskIds.length,
    activeTaskKey,
    hasPendingSegments,
    refreshVideoStatus,
    segmentStatusKey,
  ]);

  const generateMusic = async () => {
    if (!user) return toast.error("Please log in to generate music.");
    setMusicBusy(true);
    setMusicResult(null);
    try {
      const result = (await runMusic({
        data: {
          prompt: musicPrompt,
          title: musicTitle,
          style: musicStyle,
          instrumental,
          durationSeconds: musicDuration,
        },
      })) as GenerateMusicStudioResult;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMusicResult(result);
      toast.success(result.audioUrl ? "Music generated." : "Music task created.");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Music generation failed."));
    } finally {
      setMusicBusy(false);
    }
  };

  const transcribeMedia = async () => {
    if (!user) return toast.error("Please log in to transcribe media.");
    if (!mediaDataUrl) return toast.error("Upload an audio or video file first.");
    setTranscriptBusy(true);
    setTranscript(null);
    try {
      const result = (await runTranscript({
        data: { mediaDataUrl, filename: mediaName, mode: transcriptMode },
      })) as TranscribeStudioResult;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTranscript(result);
      toast.success("Speech-to-text complete.");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Speech-to-text failed."));
    } finally {
      setTranscriptBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <section className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Film className="h-3.5 w-3.5" /> Seedance Roblox Video Studio
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Roblox videos, music, and captions in one creator workspace
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Build clean Roblox promo videos with Doubao Seedance 2.0, generate matching music, and
              turn uploaded audio or video into captions with Gemini 3.1 Flash Lite Preview.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-bold text-emerald-200">
              <ShieldCheck className="h-4 w-4" /> Roblox-safe defaults
            </div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-100/85">
              Prompts are wrapped with PG Roblox safety rules. Unsafe content is blocked before a
              provider request starts.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface/50 p-2">
          <ModeButton
            active={mode === "video"}
            icon={<Film className="h-4 w-4" />}
            label="Video"
            onClick={() => setMode("video")}
          />
          <ModeButton
            active={mode === "music"}
            icon={<Music2 className="h-4 w-4" />}
            label="Music"
            onClick={() => setMode("music")}
          />
          <ModeButton
            active={mode === "speech"}
            icon={<Mic2 className="h-4 w-4" />}
            label="Speech to text"
            onClick={() => setMode("speech")}
          />
        </div>

        {mode === "video" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_28rem]">
            <section className="rounded-2xl border border-border bg-surface/60 p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Game name">
                  <input
                    value={gameName}
                    onChange={(event) => setGameName(event.target.value)}
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
                <Field label="Call to action">
                  <input
                    value={callToAction}
                    onChange={(event) => setCallToAction(event.target.value)}
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
              </div>
              <Field label="Video idea" className="mt-4">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={4}
                  maxLength={2200}
                  className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                />
              </Field>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <ControlGroup label="Duration">
                  <div className="grid grid-cols-5 gap-1.5">
                    {durations.map((seconds) => (
                      <Chip
                        key={seconds}
                        active={durationSeconds === seconds}
                        onClick={() => setDurationSeconds(seconds)}
                      >
                        {seconds === 60 ? "1m" : `${seconds}s`}
                      </Chip>
                    ))}
                  </div>
                </ControlGroup>
                <ControlGroup label="Aspect ratio">
                  <div className="grid grid-cols-3 gap-1.5">
                    {aspectRatios.map((ratio) => (
                      <Chip
                        key={ratio}
                        active={aspectRatio === ratio}
                        onClick={() => setAspectRatio(ratio)}
                      >
                        {ratio}
                      </Chip>
                    ))}
                  </div>
                </ControlGroup>
                <ControlGroup label="Clip plan">
                  <div className="rounded-xl border border-border bg-background/50 px-3 py-2 text-xs">
                    {clipPlan.map((part) => `${part}s`).join(" + ")}
                  </div>
                </ControlGroup>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Roblox presets
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {videoPresets.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPreset(item.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        preset === item.id
                          ? "border-primary/60 bg-primary/15"
                          : "border-border bg-background/45 hover:border-primary/35"
                      }`}
                    >
                      <div className="text-sm font-bold">{item.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.text}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <SelectField
                  label="Style"
                  value={style}
                  setValue={setStyle}
                  options={videoStyles}
                />
                <SelectField
                  label="Camera"
                  value={camera}
                  setValue={setCamera}
                  options={cameraMoves}
                />
                <SelectField
                  label="Pacing"
                  value={pacing}
                  setValue={setPacing}
                  options={pacingOptions}
                />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <SelectField
                  label="Animation direction"
                  value={animationDirection}
                  setValue={setAnimationDirection}
                  options={animationDirections}
                />
                <Field label="Audience">
                  <input
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-xs font-semibold lg:col-span-2">
                  <input
                    type="checkbox"
                    checked={includeMusicCues}
                    onChange={(event) => setIncludeMusicCues(event.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Include music cues
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-background/40 px-4 py-6 text-center">
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-semibold">
                    {referenceName || "Upload an image for image-to-video"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PNG, JPG, or WEBP up to 8 MB. Used on the first segment.
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void pickReferenceImage(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
                {referenceImageDataUrl && (
                  <img
                    src={referenceImageDataUrl}
                    alt="Reference preview"
                    className="mt-3 max-h-64 w-full rounded-xl border border-border object-contain"
                  />
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Model: <span className="font-semibold text-foreground">doubao-seedance-2-0</span>{" "}
                  · Cost:{" "}
                  <span className="font-semibold text-foreground">
                    {isOwner ? "owner free" : `${videoCredits} credits`}
                  </span>
                </div>
                <button
                  onClick={generateVideo}
                  disabled={videoBusy || weeklyLocked || !prompt.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-45"
                >
                  {videoBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : weeklyLocked ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <WandSparkles className="h-4 w-4" />
                  )}
                  {weeklyLocked ? `Available in ${eta(nextAvailable, now)}` : "Generate video"}
                </button>
              </div>
              {weeklyLocked && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Clock className="h-4 w-4" /> Weekly video generation used
                  </div>
                  <p className="mt-1 text-amber-100/80">
                    Your next AI video unlocks {new Date(nextAvailable!).toLocaleString()}.
                  </p>
                </div>
              )}
              {!canAffordVideo && user && (
                <p className="mt-2 text-xs text-destructive">
                  You need {videoCredits} credits for this duration.{" "}
                  <Link to="/pricing" className="underline">
                    Get more credits
                  </Link>
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface/60 p-5">
              <div className="mb-4 rounded-2xl border border-primary/20 bg-background/45 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Sparkles className="h-4 w-4 text-primary" /> Live preview
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {previewPreset?.label} · {aspectRatio} ·{" "}
                      {clipPlan.map((part) => `${part}s`).join(" + ")}
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
                    Mobile-ready
                  </span>
                </div>
                <div
                  style={ratioBoxStyle(aspectRatio)}
                  className="relative mx-auto max-h-[24rem] w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-[#1b2a4a] via-[#25634f] to-[#111827]"
                >
                  {referenceImageDataUrl ? (
                    <img
                      src={referenceImageDataUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-70"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute left-3 top-3 rounded-lg bg-black/45 px-2 py-1 text-[11px] font-bold text-white">
                    {gameName || "Roblox Game"}
                  </div>
                  <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-black/55 p-3 text-white">
                    <div className="text-sm font-black">{callToAction || "Play now"}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-white/80">{prompt}</div>
                  </div>
                </div>
              </div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">Generation output</div>
                  <div className="text-xs text-muted-foreground">
                    {segments.length
                      ? `${completedCount}/${segments.length} clips ready`
                      : "No tasks started yet"}
                  </div>
                </div>
                <button
                  onClick={() => void refreshVideoStatus()}
                  disabled={polling || activeTaskIds.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:opacity-45"
                >
                  {polling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </button>
              </div>
              <div className="space-y-3">
                {segments.length === 0 ? (
                  <Empty
                    icon={<Film className="h-8 w-8" />}
                    text="Generated Seedance clips and download links appear here."
                  />
                ) : (
                  segments.map((segment, index) => (
                    <div
                      key={segment.taskId || index}
                      className="rounded-xl border border-border bg-background/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold">
                          Clip {index + 1} · {segment.seconds}s
                        </span>
                        <StatusPill status={segment.status} progress={segment.progress} />
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${segment.progress}%` }}
                        />
                      </div>
                      {segment.videoUrl && (
                        <div className="mt-3 space-y-2">
                          <video
                            src={segment.videoUrl}
                            controls
                            playsInline
                            style={ratioBoxStyle(aspectRatio)}
                            className="w-full rounded-lg border border-border bg-black object-contain"
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <a
                              href={segment.videoUrl}
                              download={`bloxsmith-video-clip-${index + 1}.mp4`}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold transition hover:bg-surface"
                            >
                              <Download className="h-4 w-4" /> Download clip
                            </a>
                            <a
                              href={segment.videoUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold transition hover:bg-surface"
                            >
                              <ExternalLink className="h-4 w-4" /> Open / save
                            </a>
                          </div>
                        </div>
                      )}
                      {segment.error && (
                        <p className="mt-2 text-xs text-amber-300">{segment.error}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
              {storyboard.length > 0 && (
                <details className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold">Storyboard prompts</summary>
                  <div className="mt-3 space-y-3 text-muted-foreground">
                    {storyboard.map((item, index) => (
                      <pre
                        key={index}
                        className="whitespace-pre-wrap rounded-lg bg-background/60 p-3"
                      >
                        {item}
                      </pre>
                    ))}
                  </div>
                </details>
              )}
              {readySegments.length > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" /> Ready downloads
                  </div>
                  <div className="grid gap-2">
                    {readySegments.map((segment, index) => (
                      <a
                        key={segment.taskId}
                        href={segment.videoUrl}
                        download={`bloxsmith-video-clip-${index + 1}.mp4`}
                        className="inline-flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-background/45 px-3 py-2 text-xs font-semibold hover:bg-background/70"
                      >
                        <span>Download clip {segment.index + 1}</span>
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {mode === "music" && (
          <section className="grid gap-5 lg:grid-cols-[1fr_26rem]">
            <div className="rounded-2xl border border-border bg-surface/60 p-5">
              <Field label="Track title">
                <input
                  value={musicTitle}
                  onChange={(event) => setMusicTitle(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                />
              </Field>
              <Field label="Music prompt" className="mt-4">
                <textarea
                  value={musicPrompt}
                  onChange={(event) => setMusicPrompt(event.target.value)}
                  rows={5}
                  maxLength={1200}
                  className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                />
              </Field>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <SelectField
                  label="Style preset"
                  value={musicStyle}
                  setValue={setMusicStyle}
                  options={musicStyles}
                />
                <ControlGroup label="Length">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[15, 30, 60, 120].map((seconds) => (
                      <Chip
                        key={seconds}
                        active={musicDuration === seconds}
                        onClick={() => setMusicDuration(seconds as 15 | 30 | 60 | 120)}
                      >
                        {seconds}s
                      </Chip>
                    ))}
                  </div>
                </ControlGroup>
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={instrumental}
                  onChange={(event) => setInstrumental(event.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Instrumental only
              </label>
              <button
                onClick={generateMusic}
                disabled={musicBusy || !musicPrompt.trim()}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-45"
              >
                {musicBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Music2 className="h-4 w-4" />
                )}
                Generate music · {isOwner ? "owner free" : "6 credits"}
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-surface/60 p-5">
              {musicResult?.audioUrl ? (
                <div className="space-y-3">
                  <div className="text-sm font-bold">Generated music</div>
                  <audio src={musicResult.audioUrl} controls className="w-full" />
                  <a
                    href={musicResult.audioUrl}
                    download
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold transition hover:bg-surface"
                  >
                    <Download className="h-4 w-4" /> Download audio
                  </a>
                  <div className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold">
                      <FileCode2 className="h-4 w-4 text-primary" /> Roblox import kit
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Upload the downloaded audio to Roblox Creator Dashboard, paste the audio asset
                      id here, then download the Studio script.
                    </p>
                    <input
                      value={robloxAudioAssetId}
                      onChange={(event) => setRobloxAudioAssetId(event.target.value)}
                      placeholder="Roblox audio asset id"
                      className="mt-2 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary/50"
                    />
                    <a
                      href={luaDataUrl(robloxMusicScript(robloxAudioAssetId, musicTitle))}
                      download="BloxSmithMusicImporter.lua"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      <Download className="h-4 w-4" /> Download Roblox music script
                    </a>
                  </div>
                </div>
              ) : musicResult?.taskId ? (
                <Empty
                  icon={<Music2 className="h-8 w-8" />}
                  text={`Music task created: ${musicResult.taskId}`}
                />
              ) : (
                <Empty
                  icon={<Music2 className="h-8 w-8" />}
                  text="Generated Roblox promo music appears here."
                />
              )}
            </div>
          </section>
        )}

        {mode === "speech" && (
          <section className="grid gap-5 lg:grid-cols-[1fr_30rem]">
            <div className="rounded-2xl border border-border bg-surface/60 p-5">
              <div className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-background/40 px-4 py-8 text-center">
                  <Mic2 className="h-7 w-7 text-primary" />
                  <span className="text-sm font-semibold">
                    {mediaName || "Upload audio or video for speech-to-text"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    MP3, WAV, M4A, MP4, or WEBM up to 20 MB.
                  </span>
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(event) => void pickMedia(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              </div>
              <ControlGroup label="Output mode" className="mt-4">
                <div className="grid gap-1.5 sm:grid-cols-3">
                  <Chip
                    active={transcriptMode === "captions"}
                    onClick={() => setTranscriptMode("captions")}
                  >
                    Captions
                  </Chip>
                  <Chip
                    active={transcriptMode === "transcript"}
                    onClick={() => setTranscriptMode("transcript")}
                  >
                    Transcript
                  </Chip>
                  <Chip
                    active={transcriptMode === "script-notes"}
                    onClick={() => setTranscriptMode("script-notes")}
                  >
                    Script notes
                  </Chip>
                </div>
              </ControlGroup>
              <button
                onClick={transcribeMedia}
                disabled={transcriptBusy || !mediaDataUrl}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-45"
              >
                {transcriptBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic2 className="h-4 w-4" />
                )}
                Transcribe with Gemini 3.1 Flash Lite · {isOwner ? "owner free" : "3 credits"}
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-surface/60 p-5">
              {transcript ? (
                <div>
                  <div className="mb-2 text-sm font-bold">Transcript</div>
                  <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background/60 p-4 text-xs leading-relaxed">
                    {transcript.text}
                  </pre>
                </div>
              ) : (
                <Empty
                  icon={<Mic2 className="h-8 w-8" />}
                  text="Caption text and script notes appear here."
                />
              )}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}
    >
      {icon}
      {label}
    </button>
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
      <span className="mb-1.5 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ControlGroup({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[];
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
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
      className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${active ? "border-primary/70 bg-primary/15 text-foreground" : "border-border bg-background/50 text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ status, progress }: { status: string; progress: number }) {
  const done = status === "completed";
  const failed = status === "failed" || status === "error";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${done ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300" : failed ? "border-destructive/35 bg-destructive/15 text-destructive" : "border-amber-500/35 bg-amber-500/15 text-amber-300"}`}
    >
      {done ? (
        <Play className="h-3 w-3" />
      ) : failed ? (
        <ImageIcon className="h-3 w-3" />
      ) : (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {done ? "Ready" : failed ? "Needs retry" : `${progress || 0}%`}
    </span>
  );
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-xl border border-border bg-background/50 p-6 text-center text-muted-foreground">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}

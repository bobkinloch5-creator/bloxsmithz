import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useCallback, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/lib/auth-context";
import {
  startVideoGeneration,
  checkVideoGeneration,
  type VideoJob,
} from "@/lib/video-studio.functions";
import { Film, Sparkles, Download, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/video-generator")({
  component: VideoGeneratorPage,
  head: () => ({
    meta: [
      { title: "AI Video Generator | BloxSmith" },
      {
        name: "description",
        content:
          "Generate cinematic video clips for your Roblox game trailers, cutscenes, and promos with AI.",
      },
      {
        name: "keywords",
        content:
          "AI Roblox video generator, Roblox trailer maker, Roblox cutscene AI, game promo video generator, BloxSmith video",
      },
    ],
  }),
});

const DURATIONS: Array<3 | 5 | 8 | 10> = [3, 5, 8, 10];
const RESOLUTIONS = ["720p", "1080p"] as const;
const VIDEO_COST = 10;

function VideoGeneratorPage() {
  const { user } = useAuth();
  const start = useServerFn(startVideoGeneration);
  const check = useServerFn(checkVideoGeneration);

  const [prompt, setPrompt] = useState("");
  const [durationS, setDurationS] = useState<3 | 5 | 8 | 10>(5);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [job, setJob] = useState<VideoJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const poll = useCallback(
    (taskId: string) => {
      pollRef.current = setTimeout(async () => {
        try {
          const next = (await check({ data: { taskId } })) as VideoJob;
          setJob(next);
          if (next.status === "completed" || next.status === "failed") {
            setBusy(false);
            if (next.status === "failed") {
              setError(next.error ?? "Generation failed.");
              toast.error(next.error ?? "Video generation failed.");
            }
          } else {
            poll(taskId);
          }
        } catch (err) {
          setBusy(false);
          setError(err instanceof Error ? err.message : "Failed to check status.");
        }
      }, 3000);
    },
    [check],
  );

  async function generate() {
    if (!user) {
      toast.error("Please sign in to generate videos.");
      return;
    }
    if (prompt.trim().length < 3) {
      toast.error("Describe your video first.");
      return;
    }
    setError(null);
    setJob(null);
    setBusy(true);
    try {
      const result = (await start({ data: { prompt, durationS, resolution } })) as VideoJob;
      setJob(result);
      if (result.status === "completed" || result.status === "failed") {
        setBusy(false);
        if (result.status === "failed") setError(result.error ?? "Generation failed.");
      } else {
        poll(result.taskId);
      }
    } catch (err: any) {
      setBusy(false);
      const msg = err?.message ?? "Failed to start generation.";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center">
            <Film className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">AI Video Generator</h1>
            <p className="text-sm text-muted-foreground">
              Cinematic clips for game trailers and cutscenes. {VIDEO_COST} credits per video.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface-elevated/40 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Describe your video</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1500}
              rows={4}
              placeholder="A sweeping aerial shot over a neon cyberpunk city at night, camera flying between glowing skyscrapers, cinematic lighting…"
              disabled={busy}
              className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none disabled:opacity-50"
            />
            <div className="text-[10px] text-muted-foreground text-right mt-1">{prompt.length}/1500</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Length</label>
              <div className="mt-1.5 flex gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={busy}
                    onClick={() => setDurationS(d)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-50 ${
                      durationS === d
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quality</label>
              <div className="mt-1.5 flex gap-1.5">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    onClick={() => setResolution(r)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-50 ${
                      resolution === r
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={busy || prompt.trim().length < 3}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate video ({VIDEO_COST} credits)
              </>
            )}
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Generation usually takes 1–3 minutes. You can stay on this page.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {job && (
          <div className="mt-4 rounded-2xl border border-border bg-surface-elevated/40 p-4">
            {job.status !== "completed" && job.status !== "failed" && (
              <div className="flex flex-col items-center py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <div className="text-sm font-medium capitalize">{job.status}…</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Rendering your clip — usually 1–3 minutes.
                </div>
                <div className="mt-4 h-1.5 w-full max-w-xs rounded-full bg-background/60 overflow-hidden">
                  <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" />
                </div>
              </div>
            )}
            {job.status === "completed" && job.videoUrl && (
              <div className="space-y-3">
                <video src={job.videoUrl} controls autoPlay loop className="w-full rounded-lg border border-border bg-black" />
                <a
                  href={job.videoUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm font-medium hover:border-primary/50 transition"
                >
                  <Download className="h-4 w-4" /> Download video
                </a>
              </div>
            )}
            {job.status === "completed" && !job.videoUrl && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Generation finished but no video URL was returned. Please try again.
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import {
  ensureCreditsAvailable,
  isGeneratorOwner,
  spendCreditsAfterSuccess,
} from "./generator-credits.server";
import {
  createSeedanceVideoTask,
  generateMusicWithComet,
  pollSeedanceVideoTask,
  splitVideoDuration,
  type VideoStudioSegment,
} from "./video-gen.server";

const DurationEnum = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(30),
  z.literal(60),
]);
const AspectEnum = z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]);
const VideoPresetEnum = z.enum([
  "ad-promo",
  "game-trailer",
  "update-teaser",
  "ugc-showcase",
  "obby-run",
  "tycoon-progress",
  "simulator-hatch",
  "horror-teaser",
  "before-after-build",
  "vertical-short",
]);

const VideoInputSchema = z.object({
  prompt: z.string().min(3).max(2200),
  gameName: z.string().max(80).optional(),
  callToAction: z.string().max(120).optional(),
  durationSeconds: DurationEnum.default(15),
  aspectRatio: AspectEnum.default("9:16"),
  preset: VideoPresetEnum.default("ad-promo"),
  style: z.string().max(80).default("bright Roblox 3D"),
  camera: z.string().max(80).default("smooth cinematic push"),
  pacing: z.string().max(80).default("fast hook then clean reveal"),
  animationDirection: z.string().max(120).default("smooth Roblox avatar motion"),
  audience: z.string().max(80).default("Roblox players"),
  includeMusicCues: z.boolean().default(true),
  referenceImageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/)
    .max(8_000_000)
    .optional(),
});

const PollInputSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1).max(8),
});

const MusicInputSchema = z.object({
  prompt: z.string().min(3).max(1200),
  title: z.string().min(1).max(80).default("Roblox Promo Track"),
  style: z.string().min(2).max(160).default("upbeat electronic game trailer, clean loop"),
  instrumental: z.boolean().default(true),
  durationSeconds: z
    .union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)])
    .default(30),
});

const TranscriptInputSchema = z.object({
  mediaDataUrl: z
    .string()
    .regex(/^data:(audio|video)\/[a-zA-Z0-9.+-]+;base64,/)
    .max(28_000_000),
  filename: z.string().max(120).optional(),
  mode: z.enum(["transcript", "captions", "script-notes"]).default("transcript"),
});

export type GenerateVideoStudioInput = z.infer<typeof VideoInputSchema>;
export type GenerateVideoStudioResult =
  | {
      ok: true;
      model: string;
      creditsSpent: number;
      totalSeconds: number;
      segments: VideoStudioSegment[];
      storyboard: string[];
      nextAvailable: string | null;
    }
  | { ok: false; error: string; nextAvailable?: string };

export type PollVideoStudioResult =
  | { ok: true; segments: VideoStudioSegment[] }
  | { ok: false; error: string };

export type GenerateMusicStudioResult =
  | { ok: true; model: string; creditsSpent: number; audioUrl?: string; taskId?: string }
  | { ok: false; error: string };

export type TranscribeStudioResult =
  | { ok: true; model: string; creditsSpent: number; text: string }
  | { ok: false; error: string };

const VIDEO_BASE_CREDIT_COST = 8;
const VIDEO_CREDITS_PER_15_SECONDS = 8;
const MUSIC_CREDIT_COST = 6;
const TRANSCRIPT_CREDIT_COST = 3;
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type GeneratorSupabase = Parameters<typeof isGeneratorOwner>[1];

type GeminiTextPart = { text?: string };

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: GeminiTextPart[];
    };
  }>;
};

const PRESET_HINTS: Record<z.infer<typeof VideoPresetEnum>, string> = {
  "ad-promo":
    "Roblox ad promo: hook, show the main feature, clear call-to-action, no misleading claims.",
  "game-trailer":
    "Roblox game trailer: opening environment reveal, gameplay loop, rewards, final logo beat.",
  "update-teaser": "Roblox update teaser: new area, new item, new challenge, coming-soon energy.",
  "ugc-showcase":
    "Roblox UGC showcase: clean product turntable, outfit pairing, marketplace-ready lighting.",
  "obby-run": "Roblox obby run: parkour jumps, checkpoints, coins, satisfying finish-line reveal.",
  "tycoon-progress":
    "Roblox tycoon progression: empty base to upgraded machines, cash bursts, final build reveal.",
  "simulator-hatch":
    "Roblox simulator pet hatch: egg opening, rarity glow, pet lineup, reward loop.",
  "horror-teaser":
    "Roblox spooky teaser: suspenseful but PG, shadowy hallway, no gore, no graphic scares.",
  "before-after-build":
    "Roblox before/after build: plain blockout transforms into polished map or UI.",
  "vertical-short":
    "Roblox vertical short: TikTok/Reels framing, immediate motion, readable focal subject.",
};

const UNSAFE_TERMS = [
  "nsfw",
  "nude",
  "nudity",
  "sexual",
  "gore",
  "blood",
  "suicide",
  "self harm",
  "drug",
  "drugs",
  "hate speech",
  "racist",
  "slur",
  "terrorist",
  "real person deepfake",
];

function assertRobloxSafe(text: string) {
  const lower = text.toLowerCase();
  const found = UNSAFE_TERMS.find((term) => lower.includes(term));
  if (found) {
    throw new Error(
      `That request includes unsafe content (${found}). Keep Roblox videos clean, non-graphic, and PG.`,
    );
  }
}

function videoCredits(seconds: number) {
  return VIDEO_BASE_CREDIT_COST + Math.ceil(seconds / 15) * VIDEO_CREDITS_PER_15_SECONDS;
}

function nextWeeklyUnlock(createdAt: string, cooldownUnlockAt?: string | null) {
  return cooldownUnlockAt
    ? new Date(cooldownUnlockAt)
    : new Date(new Date(createdAt).getTime() + WEEKLY_WINDOW_MS);
}

async function getRecentVideoGeneration(userId: string) {
  const since = new Date(Date.now() - WEEKLY_WINDOW_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("video_generations" as never)
    .select("created_at,cooldown_unlock_at")
    .eq("user_id", userId)
    .in("status", ["queued", "in_progress", "completed"] as never)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error && !/does not exist|relation|schema cache/i.test(error.message)) {
    throw new Error("Could not verify your weekly video limit. Try again shortly.");
  }
  return ((data ?? []) as Array<{ created_at: string; cooldown_unlock_at: string | null }>)[0];
}

function buildVideoPrompt(
  data: GenerateVideoStudioInput,
  segmentSeconds: number,
  index: number,
  total: number,
) {
  const game = data.gameName?.trim() ? `Game name: ${data.gameName.trim()}.` : "";
  const cta = data.callToAction?.trim()
    ? `End-card or overlay idea: ${data.callToAction.trim()}.`
    : "";
  const music = data.includeMusicCues
    ? "Include clean Roblox-safe music and sound-effect cues in the scene direction."
    : "Do not require music or voiceover in the generated clip.";
  return [
    `Create segment ${index + 1} of ${total} for a ${segmentSeconds}-second Roblox-safe video.`,
    PRESET_HINTS[data.preset],
    game,
    `Creator prompt: ${data.prompt.trim()}`,
    `Visual style: ${data.style}. Camera: ${data.camera}. Pacing: ${data.pacing}. Animation direction: ${data.animationDirection}. Audience: ${data.audience}.`,
    cta,
    music,
    "Keep it PG, non-graphic, non-political, non-sexual, and appropriate for Roblox players.",
    "Use Roblox-like 3D blocky characters and environments, clear readable motion, bright thumbnails, and no copyrighted logos.",
    "Keep avatar motion physically plausible for Roblox animation: readable poses, no broken limbs, no extreme deformations, no flickering characters, and clean object movement.",
    total > 1
      ? "Make this segment feel continuous with the same characters, lighting, colors, and product/game identity as the other segments."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseDataUrlParts(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, comma);
  return {
    mime: header.slice(5, header.indexOf(";")),
    base64: dataUrl.slice(comma + 1),
  };
}

async function transcribeWithGemini(data: z.infer<typeof TranscriptInputSchema>) {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error(
      "Gemini speech-to-text is not configured. Add GEMINI_API_KEY to enable transcription.",
    );
  }
  const model = process.env.GEMINI_STT_MODEL || "gemini-3.1-flash-lite-preview";
  const { mime, base64 } = parseDataUrlParts(data.mediaDataUrl);
  const prompt =
    data.mode === "captions"
      ? "Transcribe this Roblox creator audio/video into concise timestamp-style captions. Keep wording clean and preserve speaker intent."
      : data.mode === "script-notes"
        ? "Transcribe this Roblox creator audio/video, then add concise notes for a safe promo script and any unclear words."
        : "Transcribe this Roblox creator audio/video accurately. Keep the output clean and easy to paste into a video script.";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: base64 } }],
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gemini speech-to-text failed (HTTP ${response.status}): ${text.slice(0, 220)}`,
    );
  }
  const payload = (await response.json()) as GeminiPayload;
  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim() || "";
  if (!text) throw new Error("Gemini returned an empty transcription.");
  return { text, model };
}

export const generateVideoStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VideoInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<GenerateVideoStudioResult> => {
    const { supabase, userId } = context as { supabase: GeneratorSupabase; userId: string };
    try {
      assertRobloxSafe(
        `${data.prompt} ${data.gameName ?? ""} ${data.callToAction ?? ""} ${data.style} ${data.camera} ${data.pacing} ${data.animationDirection}`,
      );
      const isOwner = await isGeneratorOwner(userId, supabase);
      const creditsNeeded = videoCredits(data.durationSeconds);

      if (!isOwner) {
        const recent = await getRecentVideoGeneration(userId);
        if (recent) {
          const next = nextWeeklyUnlock(recent.created_at, recent.cooldown_unlock_at);
          return {
            ok: false,
            error:
              "You've used your AI video generation for this week. Each account gets 1 video per week.",
            nextAvailable: next.toISOString(),
          };
        }
      }

      await ensureCreditsAvailable({ userId, amount: creditsNeeded, isOwner });

      const parts = splitVideoDuration(data.durationSeconds);
      const storyboard = parts.map((seconds, index) =>
        buildVideoPrompt(data, seconds, index, parts.length),
      );
      const taskIds = await Promise.all(
        storyboard.map((prompt, index) =>
          createSeedanceVideoTask({
            prompt,
            seconds: parts[index],
            size: data.aspectRatio,
            model: "doubao-seedance-2-0",
            referenceImageDataUrl: index === 0 ? data.referenceImageDataUrl : undefined,
          }),
        ),
      );

      await spendCreditsAfterSuccess({
        supabase,
        userId,
        amount: creditsNeeded,
        isOwner,
        insufficientMessage: "Not enough credits to start video generation.",
        reason: "roblox video generation: doubao-seedance-2-0",
      });

      const nextAvailable = isOwner ? null : new Date(Date.now() + WEEKLY_WINDOW_MS).toISOString();
      try {
        await supabaseAdmin.from("video_generations" as never).insert({
          user_id: userId,
          prompt: data.prompt,
          model: "doubao-seedance-2-0",
          duration_seconds: data.durationSeconds,
          aspect_ratio: data.aspectRatio,
          preset: data.preset,
          status: "queued",
          task_ids: taskIds,
          credits_used: isOwner ? 0 : creditsNeeded,
          settings: data,
          cooldown_unlock_at: nextAvailable,
        } as never);
      } catch (error) {
        console.warn("[video-studio] could not record generation:", error);
      }

      return {
        ok: true,
        model: "doubao-seedance-2-0",
        creditsSpent: isOwner ? 0 : creditsNeeded,
        totalSeconds: data.durationSeconds,
        storyboard,
        nextAvailable,
        segments: taskIds.map((taskId, index) => ({
          index,
          seconds: parts[index],
          prompt: storyboard[index],
          taskId,
          status: "queued",
          progress: 0,
        })),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Video generation failed.",
      };
    }
  });

export const pollVideoStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<PollVideoStudioResult> => {
    const { userId } = context as { userId: string };
    try {
      const polled = await Promise.all(
        data.taskIds.map((taskId) => pollSeedanceVideoTask({ taskId, userId })),
      );
      return {
        ok: true,
        segments: polled.map((segment, index) => ({
          index,
          seconds: 0,
          prompt: "",
          taskId: segment.taskId,
          status: segment.status,
          progress: segment.progress,
          videoUrl: segment.videoUrl,
          sourceVideoUrl: segment.sourceVideoUrl,
          error: segment.error,
        })),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not poll video tasks.",
      };
    }
  });

export const getVideoStudioStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      canGenerate: boolean;
      isOwner: boolean;
      credits: number;
      cost: number;
      nextAvailable: string | null;
    }> => {
      const { supabase, userId } = context as { supabase: GeneratorSupabase; userId: string };
      const isOwner = await isGeneratorOwner(userId, supabase);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .maybeSingle();
      const credits = Number(profile?.credits ?? 0);
      if (isOwner) {
        return { canGenerate: true, isOwner, credits, cost: 0, nextAvailable: null };
      }
      const recent = await getRecentVideoGeneration(userId);
      if (recent) {
        return {
          canGenerate: false,
          isOwner,
          credits,
          cost: videoCredits(15),
          nextAvailable: nextWeeklyUnlock(
            recent.created_at,
            recent.cooldown_unlock_at,
          ).toISOString(),
        };
      }
      return { canGenerate: true, isOwner, credits, cost: videoCredits(15), nextAvailable: null };
    },
  );

export const generateMusicStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MusicInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<GenerateMusicStudioResult> => {
    const { supabase, userId } = context as { supabase: GeneratorSupabase; userId: string };
    try {
      assertRobloxSafe(`${data.prompt} ${data.title} ${data.style}`);
      const isOwner = await isGeneratorOwner(userId, supabase);
      await ensureCreditsAvailable({ userId, amount: MUSIC_CREDIT_COST, isOwner });
      const result = await generateMusicWithComet({ userId, ...data });
      await spendCreditsAfterSuccess({
        supabase,
        userId,
        amount: MUSIC_CREDIT_COST,
        isOwner,
        insufficientMessage: "Not enough credits to generate music.",
        reason: "roblox music generation",
      });
      return {
        ok: true,
        model: result.model,
        creditsSpent: isOwner ? 0 : MUSIC_CREDIT_COST,
        audioUrl: result.audioUrl,
        taskId: result.taskId,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Music generation failed.",
      };
    }
  });

export const transcribeStudioMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TranscriptInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<TranscribeStudioResult> => {
    const { supabase, userId } = context as { supabase: GeneratorSupabase; userId: string };
    try {
      const isOwner = await isGeneratorOwner(userId, supabase);
      await ensureCreditsAvailable({ userId, amount: TRANSCRIPT_CREDIT_COST, isOwner });
      const result = await transcribeWithGemini(data);
      await spendCreditsAfterSuccess({
        supabase,
        userId,
        amount: TRANSCRIPT_CREDIT_COST,
        isOwner,
        insufficientMessage: "Not enough credits to transcribe media.",
        reason: `speech to text: ${result.model}`,
      });
      return {
        ok: true,
        model: result.model,
        creditsSpent: isOwner ? 0 : TRANSCRIPT_CREDIT_COST,
        text: result.text,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Speech-to-text failed.",
      };
    }
  });

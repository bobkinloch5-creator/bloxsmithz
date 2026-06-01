import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getCometApiKey } from "./comet-config.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ensureCreditsAvailable,
  isGeneratorOwner,
  spendCreditsAfterSuccess,
} from "./generator-credits.server";

// ---------------------------------------------------------------------------
// CometAPI Seedance video generation. Async task model: POST to create a task,
// poll GET until the video URL is ready. Endpoint + model verified against
// CometAPI's published docs (volc/v3 contents/generations/tasks).
// The model slug + paths are isolated here in case CometAPI shifts them.
// ---------------------------------------------------------------------------
const COMET_BASE = "https://api.cometapi.com";
const CREATE_PATH = "/volc/v3/contents/generations/tasks";
const GET_PATH = "/volc/v3/contents/generations/tasks"; // + /{taskId}

// 1.0 Pro is the fully-live text-to-video model on CometAPI. 2.0 is staged
// beta; swap this constant once it's GA on your key.
const SEEDANCE_MODEL = "bytedance-seedance-1-0-pro";

// Video is gated TWO ways: a hard 1-per-week cap AND a heavy credit cost.
// Seedance bills ~$0.05–0.06/sec, and a long clip is expensive, so this is
// priced as a premium one-off rather than a casual generator.
const VIDEO_CREDIT_COST = 150;

// Weekly limit: at most this many videos per user per rolling window.
// Owners/admins/mods bypass. Enforced server-side from video_generations.
const RATE_LIMIT_DAYS = 7;
const RATE_LIMIT_COUNT = 1;

// Seedance supports 4–15 second clips.
const DurationEnum = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
  z.literal(15),
]);
const ResolutionEnum = z.enum(["720p", "1080p"]);

const StartSchema = z.object({
  prompt: z.string().min(3).max(1500),
  durationS: DurationEnum.default(6),
  resolution: ResolutionEnum.default("1080p"),
  // Optional image to animate (image-to-video). Data URL, capped in size.
  referenceImageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/)
    .max(8_000_000)
    .optional(),
});

const PollSchema = z.object({ taskId: z.string().min(1).max(200) });

export type VideoJobStatus = "queued" | "processing" | "completed" | "failed";
export type VideoJob = {
  taskId: string;
  status: VideoJobStatus;
  videoUrl?: string;
  error?: string;
};

export type VideoRateLimit = {
  allowed: boolean;
  nextAvailableAt: string | null;
  creditCost: number;
};

function authHeaders() {
  const key = getCometApiKey();
  if (!key) throw new Error("Video generation isn't configured (COMETAPI_KEY missing).");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function parseTaskId(json: any): string | null {
  return json?.id ?? json?.task_id ?? json?.data?.id ?? json?.data?.task_id ?? null;
}

function parseStatus(json: any, fallbackId: string): VideoJob {
  const raw = json?.status ?? json?.data?.status ?? json?.task?.status ?? "processing";
  const status = String(raw).toLowerCase();
  const videoUrl =
    json?.video?.url ??
    json?.video_url ??
    json?.data?.video_url ??
    json?.content?.video_url ??
    json?.data?.content?.video_url ??
    json?.result?.video_url ??
    undefined;
  const taskId = parseTaskId(json) ?? fallbackId;

  if (status === "completed" || status === "succeeded" || status === "success" || videoUrl) {
    return { taskId, status: "completed", videoUrl };
  }
  if (status === "failed" || status === "error") {
    return { taskId, status: "failed", error: json?.error?.message ?? json?.error ?? "Generation failed." };
  }
  if (status === "queued" || status === "pending") return { taskId, status: "queued" };
  return { taskId, status: "processing" };
}

async function fetchTask(taskId: string): Promise<VideoJob> {
  const res = await fetch(`${COMET_BASE}${GET_PATH}/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { taskId, status: "failed", error: json?.error?.message ?? `Status check failed (${res.status}).` };
  }
  return parseStatus(json, taskId);
}

// Checks the rolling weekly window. Owners/admins/mods bypass.
async function checkWeeklyLimit(userId: string, isOwner: boolean): Promise<VideoRateLimit> {
  if (isOwner) return { allowed: true, nextAvailableAt: null, creditCost: 0 };

  const since = new Date(Date.now() - RATE_LIMIT_DAYS * 86400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("video_generations")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  // If the table is missing, fail OPEN on the limit (don't block) — the
  // credit charge still applies, so generation isn't free.
  if (error) {
    return { allowed: true, nextAvailableAt: null, creditCost: VIDEO_CREDIT_COST };
  }

  const used = data?.length ?? 0;
  if (used < RATE_LIMIT_COUNT) {
    return { allowed: true, nextAvailableAt: null, creditCost: VIDEO_CREDIT_COST };
  }
  const earliest = data![data!.length - 1].created_at as string;
  const nextAvailableAt = new Date(
    new Date(earliest).getTime() + RATE_LIMIT_DAYS * 86400_000,
  ).toISOString();
  return { allowed: false, nextAvailableAt, creditCost: VIDEO_CREDIT_COST };
}

async function recordGeneration(userId: string, taskId: string, prompt: string, credits: number) {
  try {
    await supabaseAdmin.from("video_generations").insert({
      user_id: userId,
      task_id: taskId,
      prompt: prompt.slice(0, 1000),
      credits_spent: credits,
    });
  } catch {
    // Non-fatal: the limit just won't count this one if the table is absent.
  }
}

/**
 * Lets the UI show the user's weekly status + cost before they try.
 */
export const getVideoRateLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VideoRateLimit> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const isOwner = await isGeneratorOwner(userId, supabase);
    return checkWeeklyLimit(userId, isOwner);
  });

export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartSchema.parse(input))
  .handler(async ({ data, context }): Promise<VideoJob> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // Content safety on the prompt (reuse the shared checker).
    const { checkTextSafeFor3D, checkImageSafeFor3D } = await import("./content-safety.server");
    const safety = checkTextSafeFor3D(data.prompt);
    if (!safety.safe) throw new Error(safety.reason);
    if (data.referenceImageDataUrl) {
      const imgSafety = await checkImageSafeFor3D(data.referenceImageDataUrl);
      if (!imgSafety.safe) throw new Error(imgSafety.reason);
    }

    const isOwner = await isGeneratorOwner(userId, supabase);

    // Gate 1: hard weekly limit. Even paying users get only 1 per week.
    const limit = await checkWeeklyLimit(userId, isOwner);
    if (!limit.allowed) {
      const when = limit.nextAvailableAt
        ? new Date(limit.nextAvailableAt).toLocaleString()
        : "next week";
      const err = new Error(`You can generate 1 video per week. Your next video unlocks ${when}.`);
      (err as any).rateLimited = true;
      (err as any).nextAvailableAt = limit.nextAvailableAt;
      throw err;
    }

    // Gate 2: credits (heavy). Checked up front, charged after a successful submit.
    await ensureCreditsAvailable({ userId, amount: VIDEO_CREDIT_COST, isOwner });

    // Build the content array — text always, plus an image if provided.
    const content: any[] = [{ type: "text", text: data.prompt }];
    if (data.referenceImageDataUrl) {
      content.push({ type: "image", url: data.referenceImageDataUrl });
    }

    // Submit the task.
    const res = await fetch(`${COMET_BASE}${CREATE_PATH}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: SEEDANCE_MODEL,
        content,
        output: { resolution: data.resolution, duration_s: data.durationS },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message ?? json?.message ?? `Couldn't start video generation (${res.status}).`);
    }

    const taskId = parseTaskId(json);
    if (!taskId) {
      const immediate = parseStatus(json, "immediate");
      if (immediate.videoUrl) {
        await spendCreditsAfterSuccess({
          supabase, amount: VIDEO_CREDIT_COST, isOwner, userId,
          reason: "video generation",
          insufficientMessage: "Not enough credits for video generation.",
        });
        await recordGeneration(userId, immediate.taskId || "immediate", data.prompt, isOwner ? 0 : VIDEO_CREDIT_COST);
        return immediate;
      }
      throw new Error("Couldn't read a task id from the generation response.");
    }

    // Charge once the task is accepted, then record it for the weekly counter.
    await spendCreditsAfterSuccess({
      supabase, amount: VIDEO_CREDIT_COST, isOwner, userId,
      reason: "video generation",
      insufficientMessage: "Not enough credits for video generation.",
    });
    await recordGeneration(userId, taskId, data.prompt, isOwner ? 0 : VIDEO_CREDIT_COST);

    return { taskId, status: "queued" };
  });

export const checkVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollSchema.parse(input))
  .handler(async ({ data }): Promise<VideoJob> => {
    return fetchTask(data.taskId);
  });

export const VIDEO_CREDIT_COST_EXPORT = VIDEO_CREDIT_COST;
export const VIDEO_WEEKLY_LIMIT = RATE_LIMIT_COUNT;

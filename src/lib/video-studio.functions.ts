import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getCometApiKey } from "./comet-config.server";
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

// Credit cost per generated video. At ~$0.05–0.06/sec this is the priciest
// generator, so it costs more than an image.
const VIDEO_CREDIT_COST = 10;

const DurationEnum = z.union([
  z.literal(3),
  z.literal(5),
  z.literal(8),
  z.literal(10),
]);
const ResolutionEnum = z.enum(["720p", "1080p"]);

const StartSchema = z.object({
  prompt: z.string().min(3).max(1500),
  durationS: DurationEnum.default(5),
  resolution: ResolutionEnum.default("1080p"),
});

const PollSchema = z.object({ taskId: z.string().min(1).max(200) });

export type VideoJobStatus = "queued" | "processing" | "completed" | "failed";
export type VideoJob = {
  taskId: string;
  status: VideoJobStatus;
  videoUrl?: string;
  error?: string;
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

export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartSchema.parse(input))
  .handler(async ({ data, context }): Promise<VideoJob> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // Content safety on the prompt (reuse the shared checker).
    const { checkTextSafeFor3D } = await import("./content-safety.server");
    const safety = checkTextSafeFor3D(data.prompt);
    if (!safety.safe) throw new Error(safety.reason);

    const isOwner = await isGeneratorOwner(userId, supabase);
    await ensureCreditsAvailable({ userId, amount: VIDEO_CREDIT_COST, isOwner });

    // Submit the task.
    const res = await fetch(`${COMET_BASE}${CREATE_PATH}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: SEEDANCE_MODEL,
        content: [{ type: "text", text: data.prompt }],
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
        return immediate;
      }
      throw new Error("Couldn't read a task id from the generation response.");
    }

    // Charge once the task is accepted. (Polling is free.)
    await spendCreditsAfterSuccess({
      supabase, amount: VIDEO_CREDIT_COST, isOwner, userId,
      reason: "video generation",
      insufficientMessage: "Not enough credits for video generation.",
    });

    return { taskId, status: "queued" };
  });

export const checkVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollSchema.parse(input))
  .handler(async ({ data }): Promise<VideoJob> => {
    return fetchTask(data.taskId);
  });

export const VIDEO_CREDIT_COST_EXPORT = VIDEO_CREDIT_COST;

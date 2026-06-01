import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getCometApiKey, getCometBaseUrl } from "./comet-config.server";
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
const DEFAULT_COMET_VIDEO_TASKS_URL = "https://api.cometapi.com/volc/v3/contents/generations/tasks";

// Seedance model slugs differ between CometAPI's catalog page and their API
// docs, and not every slug is enabled on every account. We try a list in
// order and use the first one CometAPI accepts. COMET_VIDEO_MODEL (if set)
// is tried first. 1.0 Pro is the most widely-available on base plans, so it
// leads; the 2.0 variants follow for accounts that have them.
const DEFAULT_SEEDANCE_MODEL = "bytedance-seedance-1-0-pro";
const SEEDANCE_MODEL_FALLBACKS = [
  "bytedance-seedance-1-0-pro",
  "doubao-seedance-2-pro",
  "doubao-seedance-2-0",
  "bytedance-seedance-1-0-lite-t2v-250428",
];
const REFERENCE_IMAGE_BUCKET = "generated-images";

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

type JsonRecord = Record<string, unknown>;
type ProviderError = { message?: string };
type QueryResult<T> = { data: T | null; error: ProviderError | null };
type VideoGenerationRow = { created_at: string };
type VideoGenerationInsert = {
  user_id: string;
  task_id: string;
  prompt: string;
  credits_spent: number;
};
type VideoGenerationsQuery = {
  select(columns: string): VideoGenerationsQuery;
  eq(column: string, value: unknown): VideoGenerationsQuery;
  gte(column: string, value: unknown): VideoGenerationsQuery;
  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<QueryResult<VideoGenerationRow[]>>;
  insert(row: VideoGenerationInsert): Promise<QueryResult<unknown>>;
};
type AuthedContext = { supabase: unknown; userId: string };
type ContentPart = { type: "text"; text: string } | { type: "image"; url: string };

class VideoRateLimitError extends Error {
  rateLimited = true;
  nextAvailableAt: string | null;

  constructor(message: string, nextAvailableAt: string | null) {
    super(message);
    this.nextAvailableAt = nextAvailableAt;
  }
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function nestedValue(json: JsonRecord, path: string[]) {
  let current: unknown = json;
  for (const key of path) {
    const record = toRecord(current);
    if (!(key in record)) return undefined;
    current = record[key];
  }
  return current;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function nestedString(json: JsonRecord, path: string[]) {
  return firstString(nestedValue(json, path));
}

function videoGenerationsTable() {
  return (
    supabaseAdmin as unknown as { from(table: "video_generations"): VideoGenerationsQuery }
  ).from("video_generations");
}

function authHeaders() {
  const key = getCometApiKey();
  if (!key) throw new Error("Video generation isn't configured (COMETAPI_KEY missing).");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function absoluteCometUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_COMET_VIDEO_TASKS_URL;
  if (trimmed.startsWith("/")) {
    return `${new URL(DEFAULT_COMET_VIDEO_TASKS_URL).origin}${trimmed}`.replace(/\/+$/, "");
  }
  return (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).replace(/\/+$/, "");
}

function getCometVideoTasksUrl(taskId?: string) {
  const explicit = process.env.COMET_VIDEO_TASKS_URL || process.env.COMET_SEEDANCE_TASKS_URL;
  const base = explicit
    ? absoluteCometUrl(explicit)
    : `${new URL(absoluteCometUrl(getCometBaseUrl())).origin}/volc/v3/contents/generations/tasks`;
  return taskId ? `${base}/${encodeURIComponent(taskId)}` : base;
}

function getSeedanceModelCandidates(): string[] {
  const envModel = process.env.COMET_VIDEO_MODEL || process.env.COMET_SEEDANCE_MODEL;
  const ordered = [envModel, ...SEEDANCE_MODEL_FALLBACKS].filter(
    (m): m is string => typeof m === "string" && m.trim().length > 0,
  );
  // De-dupe while preserving order.
  return [...new Set(ordered)];
}

async function readJsonResponse(res: Response): Promise<JsonRecord> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return toRecord(JSON.parse(text));
  } catch {
    return { message: text };
  }
}

function parseReferenceImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) throw new Error("Reference image must be a PNG, JPEG, or WEBP image.");

  const mime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { mime, ext, bytes: Buffer.from(match[2], "base64") };
}

async function uploadReferenceImage(dataUrl: string, userId: string) {
  const { mime, ext, bytes } = parseReferenceImageDataUrl(dataUrl);
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const path = `${userId}/video-reference-${Date.now()}-${randomId}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(REFERENCE_IMAGE_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });

  if (error) throw new Error(`Reference image upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(REFERENCE_IMAGE_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Reference image upload did not return a public URL.");
  return data.publicUrl;
}

function parseTaskId(json: JsonRecord): string | null {
  return (
    firstString(
      json.id,
      json.task_id,
      nestedValue(json, ["data", "id"]),
      nestedValue(json, ["data", "task_id"]),
      nestedValue(json, ["task", "id"]),
      nestedValue(json, ["data", "task", "id"]),
    ) ?? null
  );
}

function parseStatus(json: JsonRecord, fallbackId: string): VideoJob {
  const raw =
    json.status ??
    nestedValue(json, ["data", "status"]) ??
    nestedValue(json, ["task", "status"]) ??
    "processing";
  const status = String(raw).toLowerCase();
  const videoUrl =
    firstString(
      nestedValue(json, ["video", "url"]),
      json.video_url,
      nestedValue(json, ["data", "video_url"]),
      nestedValue(json, ["content", "video_url"]),
      nestedValue(json, ["data", "content", "video_url"]),
      nestedValue(json, ["result", "video_url"]),
      nestedValue(json, ["result", "download_url"]),
      nestedValue(json, ["data", "result", "video_url"]),
      nestedValue(json, ["data", "result", "download_url"]),
      nestedValue(json, ["output", "video_url"]),
      nestedValue(json, ["output", "download_url"]),
    ) ?? undefined;
  const taskId = parseTaskId(json) ?? fallbackId;

  if (status === "completed" || status === "succeeded" || status === "success" || videoUrl) {
    return { taskId, status: "completed", videoUrl };
  }
  if (status === "failed" || status === "error") {
    return {
      taskId,
      status: "failed",
      error:
        nestedString(json, ["error", "message"]) ?? firstString(json.error) ?? "Generation failed.",
    };
  }
  if (status === "queued" || status === "pending") return { taskId, status: "queued" };
  return { taskId, status: "processing" };
}

async function fetchTask(taskId: string): Promise<VideoJob> {
  const url = getCometVideoTasksUrl(taskId);
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
  });
  const json = await readJsonResponse(res);
  if (!res.ok) {
    return {
      taskId,
      status: "failed",
      error: nestedString(json, ["error", "message"]) ?? `Status check failed (${res.status}).`,
    };
  }
  return parseStatus(json, taskId);
}

// Checks the rolling weekly window. Owners/admins/mods bypass.
async function checkWeeklyLimit(userId: string, isOwner: boolean): Promise<VideoRateLimit> {
  if (isOwner) return { allowed: true, nextAvailableAt: null, creditCost: 0 };

  const since = new Date(Date.now() - RATE_LIMIT_DAYS * 86400_000).toISOString();
  const { data, error } = await videoGenerationsTable()
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  // If the table is missing, fail OPEN on the limit (don't block) — the
  // credit charge still applies, so generation isn't free.
  if (error) {
    return { allowed: true, nextAvailableAt: null, creditCost: VIDEO_CREDIT_COST };
  }

  const rows = data ?? [];
  const used = rows.length;
  if (used < RATE_LIMIT_COUNT) {
    return { allowed: true, nextAvailableAt: null, creditCost: VIDEO_CREDIT_COST };
  }
  const earliest = rows[rows.length - 1].created_at;
  const nextAvailableAt = new Date(
    new Date(earliest).getTime() + RATE_LIMIT_DAYS * 86400_000,
  ).toISOString();
  return { allowed: false, nextAvailableAt, creditCost: VIDEO_CREDIT_COST };
}

async function recordGeneration(userId: string, taskId: string, prompt: string, credits: number) {
  try {
    await videoGenerationsTable().insert({
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
    const { supabase, userId } = context as AuthedContext;
    const isOwner = await isGeneratorOwner(userId, supabase);
    return checkWeeklyLimit(userId, isOwner);
  });

export const startVideoGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartSchema.parse(input))
  .handler(async ({ data, context }): Promise<VideoJob> => {
    const { supabase, userId } = context as AuthedContext;

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
      throw new VideoRateLimitError(
        `You can generate 1 video per week. Your next video unlocks ${when}.`,
        limit.nextAvailableAt,
      );
    }

    // Gate 2: credits (heavy). Checked up front, charged after a successful submit.
    await ensureCreditsAvailable({ userId, amount: VIDEO_CREDIT_COST, isOwner });

    // Build the content array — text always, plus an image if provided.
    const content: ContentPart[] = [{ type: "text", text: data.prompt }];
    if (data.referenceImageDataUrl) {
      const referenceImageUrl = await uploadReferenceImage(data.referenceImageDataUrl, userId);
      content.push({ type: "image", url: referenceImageUrl });
    }

    // Submit the task. CometAPI's Seedance slug varies by account/plan and
    // between their catalog vs API docs, so we try a list of candidates and
    // use the first one accepted. "Invalid URL" / "model not found" style
    // rejections move on to the next candidate.
    const url = getCometVideoTasksUrl();
    const candidates = getSeedanceModelCandidates();
    let json: JsonRecord = {};
    let res: Response | null = null;
    let lastProviderMessage = "";

    for (const model of candidates) {
      res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model,
          content,
          output: { resolution: data.resolution, duration_s: data.durationS },
        }),
      });
      json = await readJsonResponse(res);
      if (res.ok) break;

      lastProviderMessage =
        nestedString(json, ["error", "message"]) ??
        firstString(json.message) ??
        `Couldn't start video generation (${res.status}).`;

      // If the failure looks like a bad/unavailable model, try the next slug.
      // Any other error (auth, quota, bad request on content) — stop and report.
      const looksLikeModelIssue =
        /invalid url|model.*(not found|unavailable|no available channel)|no available channel|not found/i.test(
          lastProviderMessage,
        );
      if (!looksLikeModelIssue) break;
    }

    if (!res || !res.ok) {
      const allModelsFailed =
        /invalid url|model.*(not found|unavailable)|no available channel|not found/i.test(
          lastProviderMessage,
        );
      throw new Error(
        allModelsFailed
          ? `Video generation isn't available on this CometAPI account yet. None of the Seedance models could be reached (${candidates.join(", ")}). This is a CometAPI plan/balance issue — enable a Seedance video model on your CometAPI account, or set COMET_VIDEO_MODEL to one your plan includes. Last error: ${lastProviderMessage}`
          : lastProviderMessage,
      );
    }

    const taskId = parseTaskId(json);
    if (!taskId) {
      const immediate = parseStatus(json, "immediate");
      if (immediate.videoUrl) {
        await spendCreditsAfterSuccess({
          supabase,
          amount: VIDEO_CREDIT_COST,
          isOwner,
          userId,
          reason: "video generation",
          insufficientMessage: "Not enough credits for video generation.",
        });
        await recordGeneration(
          userId,
          immediate.taskId || "immediate",
          data.prompt,
          isOwner ? 0 : VIDEO_CREDIT_COST,
        );
        return immediate;
      }
      throw new Error("Couldn't read a task id from the generation response.");
    }

    // Charge once the task is accepted, then record it for the weekly counter.
    await spendCreditsAfterSuccess({
      supabase,
      amount: VIDEO_CREDIT_COST,
      isOwner,
      userId,
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

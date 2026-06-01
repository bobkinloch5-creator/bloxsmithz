import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type VideoStudioSegment = {
  index: number;
  seconds: number;
  prompt: string;
  taskId?: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "error";
  progress: number;
  videoUrl?: string;
  sourceVideoUrl?: string;
  error?: string;
};

export type VideoStudioPollResult = {
  taskId: string;
  status: VideoStudioSegment["status"];
  progress: number;
  videoUrl?: string;
  sourceVideoUrl?: string;
  error?: string;
};

const TERMINAL = new Set(["completed", "failed", "error"]);

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function cometBaseUrl() {
  const raw =
    process.env.COMET_API_BASE_URL || process.env.COMETAPI_BASE_URL || "https://api.cometapi.com";
  return raw.replace(/\/v1\/?$/, "").replace(/\/$/, "");
}

function cometKey() {
  return process.env.COMETAPI_KEY || process.env.COMET_API_KEY;
}

function envInt(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] || "");
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function maxSeedanceClipSeconds() {
  return envInt("SEEDANCE_MAX_SECONDS", 15, 4, 15);
}

export function splitVideoDuration(seconds: number) {
  const max = maxSeedanceClipSeconds();
  const parts: number[] = [];
  let remaining = Math.max(4, Math.min(60, Math.round(seconds)));
  while (remaining > 0) {
    const next = Math.min(max, remaining);
    if (next < 4 && parts.length > 0) {
      parts[parts.length - 1] += next;
      break;
    }
    parts.push(next);
    remaining -= next;
  }
  return parts;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid reference file data.");
  return {
    mime: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

function extensionForMime(mime: string, fallback: string) {
  if (/mp4/i.test(mime)) return "mp4";
  if (/webm/i.test(mime)) return "webm";
  if (/mpeg|mp3/i.test(mime)) return "mp3";
  if (/wav/i.test(mime)) return "wav";
  if (/jpeg|jpg/i.test(mime)) return "jpg";
  if (/webp/i.test(mime)) return "webp";
  if (/png/i.test(mime)) return "png";
  return fallback;
}

async function saveRemoteFile(opts: {
  bucket: string;
  userId: string;
  remoteUrl: string;
  fallbackMime: string;
  fallbackExt: string;
}) {
  const response = await fetch(opts.remoteUrl, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok)
    throw new Error(`Could not download generated media (HTTP ${response.status}).`);
  const contentType = response.headers.get("content-type") || opts.fallbackMime;
  const bytes = Buffer.from(await response.arrayBuffer());
  const ext = extensionForMime(contentType, opts.fallbackExt);
  const filename = `${opts.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(opts.bucket)
    .upload(filename, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Could not save generated media: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(opts.bucket).getPublicUrl(filename);
  return data.publicUrl;
}

function getTaskId(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  return String(root?.id || root?.task_id || data?.id || data?.task_id || "");
}

function normalizeTaskStatus(payload: unknown): VideoStudioPollResult {
  const root = asRecord(payload) ?? {};
  const task = asRecord(root.data) ?? root;
  const result = asRecord(task.result);
  const output = asRecord(task.output);
  const data = asRecord(task.data);
  const status = String(task.status || "queued").toLowerCase();
  const normalized = status === "success" ? "completed" : status;
  const progress = Number(task.progress ?? (normalized === "completed" ? 100 : 0));
  const sourceVideoUrl =
    asString(task.video_url) ||
    asString(result?.video_url) ||
    asString(output?.video_url) ||
    asString(task.url) ||
    asString(data?.video_url);
  return {
    taskId: getTaskId(task),
    status: TERMINAL.has(normalized)
      ? (normalized as VideoStudioPollResult["status"])
      : "in_progress",
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0,
    sourceVideoUrl,
    error: asString(task.error) || asString(task.message),
  };
}

export async function createSeedanceVideoTask(opts: {
  prompt: string;
  seconds: number;
  size: string;
  model?: string;
  referenceImageDataUrl?: string;
}) {
  const apiKey = cometKey();
  if (!apiKey)
    throw new Error(
      "CometAPI is not configured. Add COMETAPI_KEY to enable Seedance video generation.",
    );

  const body = new FormData();
  body.append("prompt", opts.prompt);
  body.append("model", opts.model || "doubao-seedance-2-0");
  body.append("seconds", String(Math.max(4, Math.min(maxSeedanceClipSeconds(), opts.seconds))));
  body.append("size", opts.size);

  if (opts.referenceImageDataUrl) {
    const { mime, bytes } = parseDataUrl(opts.referenceImageDataUrl);
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(mime)) {
      throw new Error("Reference image must be PNG, JPG, or WEBP.");
    }
    body.append(
      "input_reference",
      new Blob([bytes], { type: mime }),
      `reference.${extensionForMime(mime, "png")}`,
    );
  }

  const response = await fetch(`${cometBaseUrl()}/v1/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error("CometAPI rejected the API key. Check COMETAPI_KEY.");
    }
    if (response.status === 429) {
      throw new Error("Seedance is rate-limited right now. Try again in a few minutes.");
    }
    throw new Error(`Seedance request failed (HTTP ${response.status}): ${text.slice(0, 220)}`);
  }

  const payload = await response.json();
  const taskId = getTaskId(payload);
  if (!taskId) throw new Error("Seedance did not return a task id.");
  return taskId;
}

export async function pollSeedanceVideoTask(opts: {
  taskId: string;
  userId: string;
}): Promise<VideoStudioPollResult> {
  const apiKey = cometKey();
  if (!apiKey)
    throw new Error(
      "CometAPI is not configured. Add COMETAPI_KEY to poll Seedance video generation.",
    );

  const response = await fetch(`${cometBaseUrl()}/v1/videos/${encodeURIComponent(opts.taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      taskId: opts.taskId,
      status: response.status >= 500 ? "error" : "failed",
      progress: 0,
      error: `Seedance status check failed (HTTP ${response.status}): ${text.slice(0, 180)}`,
    };
  }

  const result = normalizeTaskStatus(await response.json());
  result.taskId = result.taskId || opts.taskId;
  if (result.status === "completed" && result.sourceVideoUrl) {
    try {
      result.videoUrl = await saveRemoteFile({
        bucket: "generated-videos",
        userId: opts.userId,
        remoteUrl: result.sourceVideoUrl,
        fallbackMime: "video/mp4",
        fallbackExt: "mp4",
      });
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Could not save generated video.";
      result.videoUrl = result.sourceVideoUrl;
    }
  }
  return result;
}

export async function generateMusicWithComet(opts: {
  userId: string;
  prompt: string;
  title: string;
  style: string;
  instrumental: boolean;
  durationSeconds: number;
}) {
  const apiKey = cometKey();
  if (!apiKey)
    throw new Error("CometAPI is not configured. Add COMETAPI_KEY to enable music generation.");

  const endpoint =
    process.env.COMET_MUSIC_API_URL ||
    process.env.COMETAPI_MUSIC_API_URL ||
    `${cometBaseUrl()}/v1/audio/music`;
  const model = process.env.COMET_MUSIC_MODEL || "chirp-v4-5";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: opts.prompt,
      title: opts.title,
      style: opts.style,
      tags: opts.style,
      make_instrumental: opts.instrumental,
      instrumental: opts.instrumental,
      duration: opts.durationSeconds,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 404) {
      throw new Error(
        "Music endpoint is not configured for this Comet account. Set COMET_MUSIC_API_URL to the enabled Suno/music endpoint.",
      );
    }
    throw new Error(`Music generation failed (HTTP ${response.status}): ${text.slice(0, 220)}`);
  }

  const payload = (await response.json()) as unknown;
  const root = asRecord(payload) ?? {};
  const dataRecord = asRecord(root.data);
  const dataList = Array.isArray(root.data) ? root.data : [];
  const first = asRecord(dataList[0]);
  const audioUrl =
    asString(root.audio_url) ||
    asString(root.url) ||
    asString(dataRecord?.audio_url) ||
    asString(dataRecord?.url) ||
    asString(first?.audio_url) ||
    asString(first?.url);
  const taskId = root.task_id || root.id || dataRecord?.task_id || dataRecord?.id;

  if (typeof audioUrl === "string") {
    const savedUrl = await saveRemoteFile({
      bucket: "generated-audio",
      userId: opts.userId,
      remoteUrl: audioUrl,
      fallbackMime: "audio/mpeg",
      fallbackExt: "mp3",
    });
    return {
      audioUrl: savedUrl,
      sourceAudioUrl: audioUrl,
      model,
      taskId: taskId ? String(taskId) : undefined,
    };
  }

  return { model, taskId: taskId ? String(taskId) : undefined };
}

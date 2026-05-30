// Tripo3D integration — text-to-3D model generation for BloxSmith.
//
// Flow (per Tripo OpenAPI docs, base https://api.tripo3d.ai/v2/openapi):
//   1. POST /task  { type: "text_to_model", model_version: "Turbo-v1.0-...", prompt }
//      → data.task_id
//   2. Poll GET /task/{task_id} until status === "success" (or a finalized
//      failure state). Output model URL expires in ~5 minutes.
//   3. POST /task  { type: "convert_model", format: "OBJ", original_model_task_id }
//      → a new task_id. Poll again. OBJ imports cleanly into Studio's 3D
//      Importer (Roblox cannot load an external mesh at runtime, so we hand the
//      user a downloadable file + import instructions).
//   4. Download the resulting file within the expiry window and store it in the
//      Supabase "generated-3d-models" bucket so the link never expires for the
//      user.
//
// The API key is read from process.env.TRIPO_API_KEY — never hardcoded.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";

// Turbo tier — fast + cheap, the chosen default. If Tripo renames the model
// version, update this single constant.
const TRIPO_MODEL_VERSION = "Turbo-v1.0-20250506";

export type Tripo3DResult =
  | {
      ok: true;
      fileUrl: string; // permanent public URL in our storage bucket
      filePath: string; // path inside the bucket
      format: "OBJ";
      tripoTaskId: string;
      renderedImageUrl?: string;
    }
  | { ok: false; error: string };

function authHeaders(): Record<string, string> {
  const key = process.env.TRIPO_API_KEY || process.env.TRIPO_KEY;
  if (!key) {
    throw new Error(
      "TRIPO_API_KEY is not set. Add it to your environment variables to enable 3D generation.",
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

async function createTask(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${TRIPO_BASE}/task`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Tripo task creation failed (${res.status}): ${json?.message || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const taskId = json?.data?.task_id;
  if (!taskId) throw new Error("Tripo did not return a task_id.");
  return taskId as string;
}

type PollResult = { status: string; output: any; progress: number };

async function pollTask(
  taskId: string,
  opts: { timeoutMs: number; intervalMs?: number } = { timeoutMs: 120_000 },
): Promise<PollResult> {
  const interval = opts.intervalMs ?? 3_000;
  const deadline = Date.now() + opts.timeoutMs;
  // Finalized failure states per the docs.
  const failed = new Set(["failed", "banned", "expired", "cancelled", "unknown"]);

  while (Date.now() < deadline) {
    const res = await fetch(`${TRIPO_BASE}/task/${taskId}`, {
      method: "GET",
      headers: authHeaders(),
    });
    const json: any = await res.json().catch(() => ({}));
    const data = json?.data ?? {};
    const status = String(data.status ?? "unknown");

    if (status === "success") {
      return { status, output: data.output ?? {}, progress: 100 };
    }
    if (failed.has(status)) {
      throw new Error(`Tripo task ${taskId} ${status}.`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Tripo task timed out. Try again in a moment.");
}

async function storeModelFile(
  userId: string,
  url: string,
  ext: string,
): Promise<{ filePath: string; fileUrl: string }> {
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`Could not download the generated model (${dl.status}).`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType =
    ext === "zip" ? "application/zip" : ext === "glb" ? "model/gltf-binary" : "application/octet-stream";
  const { error: upErr } = await supabaseAdmin.storage
    .from("generated-3d-models")
    .upload(filePath, buf, { contentType, upsert: false });
  if (upErr) throw new Error(`Could not save the model file: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from("generated-3d-models").getPublicUrl(filePath);
  return { filePath, fileUrl: pub.publicUrl };
}

/**
 * Generate a 3D model from a text prompt, convert to OBJ, store it, and return
 * a permanent URL. This is the heavy, slow path — callers must enforce the
 * weekly limit + credit charge around it.
 */
export async function generate3DModel(opts: {
  userId: string;
  prompt: string;
}): Promise<Tripo3DResult> {
  try {
    // 1. text_to_model (Turbo)
    const genTaskId = await createTask({
      type: "text_to_model",
      model_version: TRIPO_MODEL_VERSION,
      prompt: opts.prompt.slice(0, 1024),
    });
    const gen = await pollTask(genTaskId, { timeoutMs: 150_000 });
    const renderedImageUrl: string | undefined = gen.output?.rendered_image;

    // 2. convert_model → OBJ (best for Studio's importer). face_limit keeps it
    //    Roblox-friendly; flatten_bottom helps it sit on the ground.
    let fileUrl = "";
    let ext = "obj";
    try {
      const convTaskId = await createTask({
        type: "convert_model",
        format: "OBJ",
        original_model_task_id: genTaskId,
        face_limit: 10000,
        flatten_bottom: true,
        pivot_to_center_bottom: true,
      });
      const conv = await pollTask(convTaskId, { timeoutMs: 120_000 });
      // OBJ conversions are delivered as a packaged file (model + mtl + texture)
      // under output.model (a .zip in practice).
      fileUrl = conv.output?.model || conv.output?.pbr_model || conv.output?.base_model || "";
      ext = "zip";
    } catch (convErr) {
      // If conversion fails, fall back to the raw GLB so the user still gets a
      // usable file (Studio's importer also accepts GLB).
      console.warn("[tripo] OBJ conversion failed, falling back to GLB:", String(convErr).slice(0, 160));
      fileUrl = gen.output?.pbr_model || gen.output?.model || gen.output?.base_model || "";
      ext = "glb";
    }

    if (!fileUrl) return { ok: false, error: "Tripo finished but returned no downloadable model." };

    // 3. Download within the 5-min expiry window and store permanently.
    const stored = await storeModelFile(opts.userId, fileUrl, ext);

    return {
      ok: true,
      fileUrl: stored.fileUrl,
      filePath: stored.filePath,
      format: "OBJ",
      tripoTaskId: genTaskId,
      renderedImageUrl,
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

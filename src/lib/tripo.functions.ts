import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isGeneratorOwner, spendCreditsAfterSuccess } from "./generator-credits.server";

const InputSchema = z.object({
  projectId: z.string().uuid().optional(),
  inputMode: z.enum(["text", "image"]).default("text"),
  prompt: z.string().max(1024).default(""),
  imageDataUrl: z.string().max(11_500_000).optional(),
  quality: z.enum(["turbo", "standard", "detailed"]).default("turbo"),
  format: z.enum(["GLB", "OBJ", "FBX"]).default("GLB"),
  faceLimit: z.number().int().min(1000).max(50000).default(10000),
  texture: z.boolean().default(true),
  style: z.string().max(64).optional(),
  rigged: z.boolean().default(false),
  animateInPlace: z.boolean().default(false),
});

export type Generate3DResult =
  | {
      ok: true;
      fileUrl: string;
      previewGlbUrl?: string;
      format: "GLB" | "OBJ" | "FBX";
      renderedImageUrl?: string;
      creditsSpent: number;
      importTip: string;
      nextAvailable: string; // ISO date when they can generate again
    }
  | { ok: false; error: string; nextAvailable?: string };

// Heavy credit cost — 3D generation is expensive. Owners/admins pay 0.
const MODEL_3D_CREDIT_COST = Number(process.env.MODEL_3D_CREDIT_COST || "25");

// One generation per rolling 7 days per user (owners/admins exempt).
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const generate3DModelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<Generate3DResult> => {
    const { userId, supabase } = context as {
      userId: string;
      supabase: import("@supabase/supabase-js").SupabaseClient;
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generate3DModel } = await import("./tripo3d.server");
    const { checkTextSafeFor3D, checkImageSafeFor3D } = await import("./content-safety.server");

    const safePrompt = data.prompt.trim();
    if (data.inputMode === "text" && safePrompt.length < 3) {
      return { ok: false, error: "Describe the model you want in at least a few words." };
    }
    if (data.inputMode === "image" && !data.imageDataUrl) {
      return { ok: false, error: "Upload a reference image for image-to-3D." };
    }
    const textSafety = checkTextSafeFor3D(safePrompt);
    if (!textSafety.safe) return { ok: false, error: textSafety.reason };
    if (data.inputMode === "image" && data.imageDataUrl) {
      const imageSafety = await checkImageSafeFor3D(data.imageDataUrl);
      if (!imageSafety.safe) return { ok: false, error: imageSafety.reason };
    }

    const isOwner = await isGeneratorOwner(userId, supabase);

    // 1. Weekly limit — count successful generations in the last 7 days.
    if (!isOwner) {
      const since = new Date(Date.now() - WEEKLY_WINDOW_MS).toISOString();
      const { data: recent, error: cntErr } = await (supabaseAdmin as any)
        .from("model_generations_3d")
        .select("created_at")
        .eq("user_id", userId)
        .eq("status", "success")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      // Fail closed on the limit (don't let a query error grant a free pass),
      // but allow through if the table simply isn't there yet.
      if (cntErr && !/does not exist|relation|schema cache/i.test(cntErr.message)) {
        return { ok: false, error: "Could not verify your weekly limit. Try again shortly." };
      }
      if (recent && recent.length > 0) {
        const last = new Date(recent[0].created_at).getTime();
        const next = new Date(last + WEEKLY_WINDOW_MS);
        return {
          ok: false,
          error:
            "You've used your 3D model generation for this week. Each account gets 1 per week.",
          nextAvailable: next.toISOString(),
        };
      }
    }

    // 2. Pre-check credits so we don't run an expensive Tripo job the user
    //    can't pay for. (We still charge only AFTER success.)
    if (!isOwner) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .maybeSingle();
      const credits = Number(profile?.credits ?? 0);
      if (credits < MODEL_3D_CREDIT_COST) {
        return {
          ok: false,
          error: `3D generation costs ${MODEL_3D_CREDIT_COST} credits. You have ${credits}. Buy more on the Pricing page.`,
        };
      }
    }

    // 3. Generate (text → model → chosen format → stored file + preview GLB).
    const result = await generate3DModel({
      userId,
      prompt:
        safePrompt ||
        "Create a safe Roblox-ready 3D model from this reference image. Keep it clean, non-NSFW, game-friendly, and suitable for all ages.",
      inputMode: data.inputMode,
      imageDataUrl: data.imageDataUrl ?? null,
      quality: data.quality,
      format: data.rigged && data.format === "OBJ" ? "FBX" : data.format,
      faceLimit: data.faceLimit,
      texture: data.texture,
      style: data.style ?? null,
      rigged: data.rigged,
      animateInPlace: data.animateInPlace,
    });
    if (!result.ok) {
      return { ok: false, error: `${result.error} (No credits were charged.)` };
    }

    // 4. Charge credits only now that we have a real file.
    try {
      await spendCreditsAfterSuccess({
        supabase,
        userId,
        amount: MODEL_3D_CREDIT_COST,
        isOwner,
        insufficientMessage: "Not enough credits to complete 3D generation.",
        reason: `3D model generation: ${data.prompt.slice(0, 60)}`,
      });
    } catch (err) {
      // The file exists but charging failed — still record it so the weekly
      // limit is honored, and let the user have the file.
      console.warn("[generate3DModelFn] credit charge failed:", String(err).slice(0, 160));
    }

    // 5. Record the generation (drives the weekly limit + the user's history).
    await (supabaseAdmin as any).from("model_generations_3d").insert({
      user_id: userId,
      project_id: data.projectId ?? null,
      prompt: data.prompt,
      status: "success",
      tripo_task_id: result.tripoTaskId,
      file_path: result.filePath,
      file_url: result.fileUrl,
      format: result.format,
      credits_used: isOwner ? 0 : MODEL_3D_CREDIT_COST,
    });

    const nextAvailable = new Date(Date.now() + WEEKLY_WINDOW_MS).toISOString();

    return {
      ok: true,
      fileUrl: result.fileUrl,
      previewGlbUrl: result.previewGlbUrl,
      format: result.format,
      renderedImageUrl: result.renderedImageUrl,
      creditsSpent: isOwner ? 0 : MODEL_3D_CREDIT_COST,
      importTip:
        "Download the file, then in Roblox Studio open the 3D Importer (Avatar tab → Import 3D) and select it. The mesh drops into your Workspace ready to position. Roblox can't load external meshes at runtime, so this one-time import is required.",
      nextAvailable,
    };
  });

// Lightweight status check so the page can show the weekly lockout + ETA and
// the credit cost before the user attempts a generation.
export const get3DStatusFn = createServerFn({ method: "POST" })
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
      const { userId, supabase } = context as {
        userId: string;
        supabase: import("@supabase/supabase-js").SupabaseClient;
      };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

      const since = new Date(Date.now() - WEEKLY_WINDOW_MS).toISOString();
      const { data: recent } = await (supabaseAdmin as any)
        .from("model_generations_3d")
        .select("created_at")
        .eq("user_id", userId)
        .eq("status", "success")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recent && recent.length > 0) {
        const next = new Date(new Date(recent[0].created_at).getTime() + WEEKLY_WINDOW_MS);
        return {
          canGenerate: false,
          isOwner,
          credits,
          cost: MODEL_3D_CREDIT_COST,
          nextAvailable: next.toISOString(),
        };
      }
      return {
        canGenerate: true,
        isOwner,
        credits,
        cost: MODEL_3D_CREDIT_COST,
        nextAvailable: null,
      };
    },
  );

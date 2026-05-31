import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ONBOARDING_REWARD_CREDITS = 10;

const SaveSchema = z.object({
  step: z.number().int().min(0).max(20),
  completed: z.boolean().optional(),
});

export const saveOnboardingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.completed === true) {
      const { data: result, error } = await (supabase as any).rpc("complete_onboarding", {
        _step: data.step,
        _reward: ONBOARDING_REWARD_CREDITS,
      });
      if (error) throw new Error(error.message);
      return {
        ok: true,
        completed: true,
        creditsAwarded: Number(result?.credits_awarded ?? 0),
      };
    }

    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({ onboarding_step: data.step, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true, completed: false, creditsAwarded: 0 };
  });

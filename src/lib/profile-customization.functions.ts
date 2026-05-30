import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const HEX = /^#[0-9a-fA-F]{6}$/;

const Schema = z
  .object({
    display_name: z.string().min(1).max(64).optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    pronouns: z.string().max(32).optional().nullable(),
    location: z.string().max(64).optional().nullable(),
    status_message: z.string().max(100).optional().nullable(),
    banner_url: z.string().url().max(1024).optional().nullable(),
    avatar_url: z.string().url().max(1024).optional().nullable(),
    profile_accent: z.string().regex(HEX).optional().nullable(),
    profile_effect: z
      .enum(["none", "sparkle", "aurora", "neon", "holographic", "confetti", "stars"])
      .optional()
      .nullable(),
    profile_background: z
      .enum([
        "none",
        "custom",
        "studio",
        "neon-city",
        "obby",
        "forest",
        "space",
        "lava",
        "clouds",
        "void",
        "sunset",
        "ocean",
        "candy",
        "matrix",
      ])
      .optional()
      .nullable(),
    custom_background_url: z.string().url().max(1024).optional().nullable(),
    profile_layout: z.enum(["classic", "card", "cinematic", "compact"]).optional(),
    pfp_effect: z
      .enum(["none", "gold", "rainbow", "flame", "electric", "ice", "galaxy", "rose"])
      .optional(),
    private_profile: z.boolean().optional(),
    hide_email: z.boolean().optional(),
    presence_enabled: z.boolean().optional(),
    show_activity: z.boolean().optional(),
    presence_status: z.enum(["online", "idle", "dnd", "invisible"]).optional(),
  })
  .strict();

export const updateProfileCustomization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Strip undefined so we only update fields the caller actually sent.
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await (supabase as any).from("profiles").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

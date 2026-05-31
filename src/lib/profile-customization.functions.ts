import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  PROFILE_BADGE_IDS,
  roleProfileBadgeIds,
  selectableProfileBadgeIds,
} from "@/lib/profile-badges";

const HEX = /^#[0-9a-fA-F]{6}$/;
const PROFILE_EFFECT_IDS = ["none", "sparkle", "aurora", "neon", "holographic", "confetti", "stars", "comet", "runes", "spotlight"] as const;
const PROFILE_BACKGROUND_IDS = ["none", "custom", "studio", "neon-city", "obby", "forest", "space", "lava", "clouds", "void", "sunset", "ocean", "candy", "matrix"] as const;
const PFP_EFFECT_IDS = ["none", "gold", "rainbow", "flame", "electric", "ice", "galaxy", "rose"] as const;
const PROFILE_DECORATION_IDS = ["none", "top_hat", "halo", "crown", "devil_horns", "headphones", "flower_crown", "wings", "snowflake", "santa", "party", "ninja", "witch", "neon_ring", "pumpkin", "cyber_visor", "bunny_ears", "cosmic_crown", "plasma_halo", "royal_wings", "lightning_aura", "crystal_spikes", "orbit", "flame_aura", "star_shower", "glitch_frame", "heart_aura", "coin_crown", "builder_goggles"] as const;
const PROFILE_CARD_EFFECT_IDS = ["none", "soft_glow", "aurora_edge", "premium_shine", "scanline", "starfield", "pixel_rain"] as const;
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
    profile_card_color: z.string().regex(HEX).optional().nullable(),
    profile_card_effect: z
      .enum(PROFILE_CARD_EFFECT_IDS)
      .optional()
      .nullable(),
    profile_effect: z
      .enum(PROFILE_EFFECT_IDS)
      .optional()
      .nullable(),
    profile_background: z
      .enum(PROFILE_BACKGROUND_IDS)
      .optional()
      .nullable(),
    custom_background_url: z.string().url().max(1024).optional().nullable(),
    profile_layout: z.enum(["classic", "card", "cinematic", "compact"]).optional(),
    pfp_effect: z
      .enum(PFP_EFFECT_IDS)
      .optional(),
    private_profile: z.boolean().optional(),
    hide_email: z.boolean().optional(),
    presence_enabled: z.boolean().optional(),
    show_activity: z.boolean().optional(),
    presence_status: z.enum(["online", "idle", "dnd", "invisible"]).optional(),
    profile_badges: z
      .array(z.enum(PROFILE_BADGE_IDS))
      .max(12)
      .transform((ids) => Array.from(new Set(ids)))
      .optional(),
    profile_decoration: z.enum(PROFILE_DECORATION_IDS).optional(),
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

    if (patch.profile_badges !== undefined) {
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roleList = ((roles ?? []) as { role: string }[]).map((row) => row.role);
      patch.profile_badges = Array.from(
        new Set([
          ...selectableProfileBadgeIds(patch.profile_badges),
          ...roleProfileBadgeIds(roleList),
        ]),
      ).slice(0, 12);
    }

    const { data: row, error } = await (supabase as any)
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("profile_badges, profile_decoration")
      .single();

    if (error) {
      console.error("[updateProfileCustomization] update failed", {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
        sentBadges: patch.profile_badges,
        sentDecoration: patch.profile_decoration,
      });
      throw new Error(error.message);
    }

    // If badges/decoration didn't actually persist, retry them in isolation
    // so a single bad value on another field can't silently strip them.
    const mismatch =
      (patch.profile_badges !== undefined &&
        JSON.stringify(row?.profile_badges ?? []) !==
          JSON.stringify(patch.profile_badges)) ||
      (patch.profile_decoration !== undefined &&
        row?.profile_decoration !== patch.profile_decoration);

    if (mismatch) {
      console.warn("[updateProfileCustomization] persistence mismatch — retrying", {
        sentBadges: patch.profile_badges,
        gotBadges: row?.profile_badges,
        sentDecoration: patch.profile_decoration,
        gotDecoration: row?.profile_decoration,
      });
      const fb: Record<string, unknown> = {};
      if (patch.profile_badges !== undefined) fb.profile_badges = patch.profile_badges;
      if (patch.profile_decoration !== undefined) fb.profile_decoration = patch.profile_decoration;
      const { error: e2 } = await (supabase as any)
        .from("profiles")
        .update(fb)
        .eq("id", userId);
      if (e2) {
        console.error("[updateProfileCustomization] fallback failed", e2);
        throw new Error(e2.message);
      }
    }

    return { ok: true };
  });

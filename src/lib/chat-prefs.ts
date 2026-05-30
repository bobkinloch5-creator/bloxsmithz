import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type ChatPrefs = {
  font_size: "sm" | "md" | "lg";
  density: "compact" | "cozy" | "comfy";
  sound_enabled: boolean;
  notify_mode: "off" | "mentions" | "all";
  theme_accent: string | null;
};

export const DEFAULT_PREFS: ChatPrefs = {
  font_size: "md",
  density: "cozy",
  sound_enabled: true,
  notify_mode: "mentions",
  theme_accent: null,
};

const LS_KEY = "bloxsmith.chatprefs.v1";

export function useChatPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<ChatPrefs>(() => {
    if (typeof localStorage === "undefined") return DEFAULT_PREFS;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_PREFS;
  });

  // Hydrate from DB
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("global_chat_user_prefs")
        .select("font_size,density,sound_enabled,notify_mode,theme_accent")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancel || !data) return;
      const next: ChatPrefs = {
        font_size: (data.font_size as any) ?? "md",
        density: (data.density as any) ?? "cozy",
        sound_enabled: !!data.sound_enabled,
        notify_mode: (data.notify_mode as any) ?? "mentions",
        theme_accent: (data.theme_accent as any) ?? null,
      };
      setPrefs(next);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id]);

  async function update(patch: Partial<ChatPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
    if (!user) return;
    await (supabase as any)
      .from("global_chat_user_prefs")
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
  }

  return { prefs, update };
}

export function fontSizeClass(size: ChatPrefs["font_size"]) {
  if (size === "sm") return "text-xs";
  if (size === "lg") return "text-base";
  return "text-sm";
}
export function densityClass(d: ChatPrefs["density"]) {
  if (d === "compact") return "space-y-1.5 py-2";
  if (d === "comfy") return "space-y-4 py-4";
  return "space-y-3 py-3";
}

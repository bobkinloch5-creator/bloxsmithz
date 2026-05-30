// Full profile customization panel: identity, background, layout, ring effect,
// accent + animated effect, privacy & presence. Saves everything via a single
// authenticated server function so it persists to the database.
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { updateProfileCustomization } from "@/lib/profile-customization.functions";
import { setCustomBackground } from "@/lib/profile-media.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { PROFILE_BACKGROUNDS, ProfileBackground, type ProfileBackgroundId } from "./profile/ProfileBackground";
import { PFP_EFFECTS, PfpRing, type PfpEffectId } from "./profile/PfpRing";
import { ProfileEffect, PROFILE_EFFECTS, type ProfileEffectId } from "./chat/ProfileEffect";
import { Sparkles, Lock, Eye, Activity, Save, Loader2, Wand2, ImagePlus, LayoutPanelTop, CircleUserRound, Upload, Trash2, Film, Award } from "lucide-react";
import { PROFILE_BADGES, ProfileBadgeIcon, ProfileBadgeRow, type BadgeId } from "./profile/ProfileBadges";

const ACCENTS = ["#7c3cff", "#00d9ff", "#ff4da6", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#38bdf8"];
const LAYOUTS: Array<{ id: "classic" | "card" | "cinematic" | "compact"; label: string; hint: string }> = [
  { id: "classic", label: "Classic", hint: "Banner + avatar overlap" },
  { id: "card", label: "Card", hint: "Centered floating card" },
  { id: "cinematic", label: "Cinematic", hint: "Tall hero banner" },
  { id: "compact", label: "Compact", hint: "Minimal one-row" },
];
const STATUSES = [
  { id: "online", label: "Online", color: "bg-emerald-500" },
  { id: "idle", label: "Idle", color: "bg-amber-400" },
  { id: "dnd", label: "Do not disturb", color: "bg-rose-500" },
  { id: "invisible", label: "Invisible", color: "bg-zinc-500" },
] as const;

export function ProfileCustomizationCard() {
  const { user, profile, refresh } = useAuth();
  const p = (profile ?? {}) as any;
  const save = useServerFn(updateProfileCustomization);

  const [state, setState] = useState({
    display_name: p.display_name ?? "",
    bio: p.bio ?? "",
    pronouns: p.pronouns ?? "",
    location: p.location ?? "",
    status_message: p.status_message ?? "",
    profile_accent: (p.profile_accent ?? "#7c3cff") as string,
    profile_effect: (p.profile_effect ?? "none") as ProfileEffectId,
    profile_background: (p.profile_background ?? "none") as ProfileBackgroundId,
    custom_background_url: (p.custom_background_url ?? null) as string | null,
    profile_layout: (p.profile_layout ?? "classic") as "classic" | "card" | "cinematic" | "compact",
    pfp_effect: (p.pfp_effect ?? "none") as PfpEffectId,
    private_profile: !!p.private_profile,
    hide_email: p.hide_email !== false,
    presence_enabled: p.presence_enabled !== false,
    show_activity: p.show_activity !== false,
    presence_status: (p.presence_status ?? "online") as "online" | "idle" | "dnd" | "invisible",
  });
  const [saving, setSaving] = useState(false);

  // Re-sync when profile reloads (e.g., after another device pushes changes).
  useEffect(() => {
    if (!profile) return;
    const q = profile as any;
    setState((s) => ({
      ...s,
      display_name: q.display_name ?? s.display_name,
      bio: q.bio ?? s.bio,
      pronouns: q.pronouns ?? s.pronouns ?? "",
      location: q.location ?? s.location ?? "",
      status_message: q.status_message ?? s.status_message ?? "",
      profile_accent: q.profile_accent ?? s.profile_accent,
      profile_effect: q.profile_effect ?? s.profile_effect,
      profile_background: q.profile_background ?? s.profile_background,
      custom_background_url: q.custom_background_url ?? s.custom_background_url ?? null,
      profile_layout: q.profile_layout ?? s.profile_layout,
      pfp_effect: q.pfp_effect ?? s.pfp_effect,
      private_profile: !!q.private_profile,
      hide_email: q.hide_email !== false,
      presence_enabled: q.presence_enabled !== false,
      show_activity: q.show_activity !== false,
      presence_status: q.presence_status ?? s.presence_status,
    }));
  }, [profile]);

  const initial = useMemo(
    () => (state.display_name || "U").slice(0, 1).toUpperCase(),
    [state.display_name],
  );

  async function onSave() {
    if (!user) return;
    setSaving(true);
    try {
      await save({
        data: {
          display_name: state.display_name?.trim() || null,
          bio: state.bio?.trim() || null,
          pronouns: state.pronouns?.trim() || null,
          location: state.location?.trim() || null,
          status_message: state.status_message?.trim() || null,
          profile_accent: state.profile_accent,
          profile_effect: state.profile_effect,
          profile_background: state.profile_background,
          custom_background_url: state.custom_background_url,
          profile_layout: state.profile_layout,
          pfp_effect: state.pfp_effect,
          private_profile: state.private_profile,
          hide_email: state.hide_email,
          presence_enabled: state.presence_enabled,
          show_activity: state.show_activity,
          presence_status: state.presence_status,
        },
      });
      await refresh();
      toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save profile");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof typeof state>(k: K, v: (typeof state)[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  return (
    <section className="rounded-2xl border border-border/50 bg-surface/20 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Customize Profile
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Make your profile yours. Everything saves to your account and shows up on all devices.
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save profile
        </button>
      </div>

      {/* LIVE PREVIEW */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/40">
        <div className="relative h-40 w-full overflow-hidden">
          <ProfileBackground id={state.profile_background} customUrl={state.custom_background_url} />
          <ProfileEffect effect={state.profile_effect} accent={state.profile_accent} />
          {state.profile_background === "none" && (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${state.profile_accent}55, ${state.profile_accent}11 60%, transparent)`,
              }}
            />
          )}
        </div>
        <div className="flex items-end gap-3 px-4 -mt-8 pb-4">
          <PfpRing effect={state.pfp_effect} size={72}>
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">{initial}</span>
            )}
          </PfpRing>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3
                className="text-lg font-bold truncate"
                style={{ color: state.profile_accent, textShadow: `0 0 14px ${state.profile_accent}66` }}
              >
                {state.display_name || "Your name"}
              </h3>
              {state.pronouns && (
                <span className="text-xs text-muted-foreground">· {state.pronouns}</span>
              )}
              <span
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium`}
                title={STATUSES.find((s) => s.id === state.presence_status)?.label}
              >
                <span className={`h-2 w-2 rounded-full ${STATUSES.find((s) => s.id === state.presence_status)?.color}`} />
                {STATUSES.find((s) => s.id === state.presence_status)?.label}
              </span>
            </div>
            {state.status_message && (
              <p className="text-xs text-muted-foreground truncate">{state.status_message}</p>
            )}
            {state.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{state.bio}</p>}
          </div>
        </div>
      </div>

      {/* IDENTITY */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Display name">
          <input
            value={state.display_name}
            onChange={(e) => set("display_name", e.target.value.slice(0, 64))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="What others see"
          />
        </Field>
        <Field label="Pronouns">
          <input
            value={state.pronouns}
            onChange={(e) => set("pronouns", e.target.value.slice(0, 32))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="they/them, she/her, ..."
          />
        </Field>
        <Field label="Location">
          <input
            value={state.location}
            onChange={(e) => set("location", e.target.value.slice(0, 64))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Earth"
          />
        </Field>
        <Field label="Status">
          <input
            value={state.status_message}
            onChange={(e) => set("status_message", e.target.value.slice(0, 100))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Working on something cool..."
          />
        </Field>
        <Field label="Bio" className="sm:col-span-2">
          <textarea
            value={state.bio}
            onChange={(e) => set("bio", e.target.value.slice(0, 500))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[72px] resize-y"
            placeholder="Tell people about yourself"
          />
          <div className="text-[10px] text-muted-foreground text-right">
            {(state.bio?.length ?? 0)} / 500
          </div>
        </Field>
      </div>

      {/* BACKGROUNDS */}
      <Section icon={<ImagePlus className="h-4 w-4" />} title="Background theme">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {PROFILE_BACKGROUNDS.map((b) => {
            const active = state.profile_background === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => set("profile_background", b.id)}
                className={`group relative h-16 overflow-hidden rounded-lg border transition ${
                  active ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-border"
                }`}
                title={b.label}
              >
                <ProfileBackground id={b.id} />
                {b.id === "none" && (
                  <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">
                    None
                  </div>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-center text-[10px] font-medium text-white">
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* CUSTOM UPLOAD TILE inside background section */}
        <CustomBackgroundUploader
          userId={user?.id ?? null}
          url={state.custom_background_url}
          active={state.profile_background === "custom"}
          onPick={() => {
            if (state.custom_background_url) set("profile_background", "custom");
          }}
          onChange={(url) => {
            setState((s) => ({
              ...s,
              custom_background_url: url,
              profile_background: url ? "custom" : s.profile_background === "custom" ? "none" : s.profile_background,
            }));
            refresh();
          }}
        />
      </Section>

      {/* LAYOUT */}
      <Section icon={<LayoutPanelTop className="h-4 w-4" />} title="Layout">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LAYOUTS.map((l) => {
            const active = state.profile_layout === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => set("profile_layout", l.id)}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border/60 bg-background/40 hover:border-border"
                }`}
              >
                <div className="text-sm font-semibold">{l.label}</div>
                <div className="text-[10px] text-muted-foreground">{l.hint}</div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* PFP RING */}
      <Section icon={<CircleUserRound className="h-4 w-4" />} title="Avatar ring effect">
        <div className="flex flex-wrap items-center gap-3">
          {PFP_EFFECTS.map((e) => {
            const active = state.pfp_effect === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => set("pfp_effect", e.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 transition ${
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border/60 bg-background/40 hover:border-border"
                }`}
                title={e.label}
              >
                <PfpRing effect={e.id} size={40}>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">{initial}</span>
                  )}
                </PfpRing>
                <span className="text-[10px] text-muted-foreground">{e.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ACCENT + ANIMATED EFFECT */}
      <Section icon={<Wand2 className="h-4 w-4" />} title="Accent + animated effect">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground mr-1">Accent</span>
          {ACCENTS.map((c) => {
            const active = state.profile_accent?.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => set("profile_accent", c)}
                className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition ${
                  active ? "ring-2 ring-foreground" : "hover:scale-110"
                }`}
                style={{ background: c }}
                title={c}
              />
            );
          })}
          <input
            type="text"
            value={state.profile_accent}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set("profile_accent", v);
            }}
            onBlur={(e) => {
              if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) set("profile_accent", "#7c3cff");
            }}
            className="ml-1 w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs"
            placeholder="#7c3cff"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {PROFILE_EFFECTS.map((e) => {
            const active = state.profile_effect === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => set("profile_effect", e.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* PRIVACY + PRESENCE */}
      <Section icon={<Lock className="h-4 w-4" />} title="Privacy & Presence">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow
            checked={state.private_profile}
            onChange={(v) => set("private_profile", v)}
            title="Private profile"
            description="Only friends can see your full profile, achievements, and Roblox info."
          />
          <ToggleRow
            checked={state.hide_email}
            onChange={(v) => set("hide_email", v)}
            title="Hide email"
            description="Don't show your email address on your public profile."
          />
          <ToggleRow
            checked={state.presence_enabled}
            onChange={(v) => set("presence_enabled", v)}
            title="Show online status"
            description="Let others see when you're online or were last active."
          />
          <ToggleRow
            checked={state.show_activity}
            onChange={(v) => set("show_activity", v)}
            title="Show activity"
            description="Display what you're working on (project, chat...)."
          />
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Status indicator
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const active = state.presence_status === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!state.presence_enabled}
                  onClick={() => set("presence_status", s.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-background/40 hover:border-border"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>
    </section>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition hover:border-border">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 h-5 w-5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              checked
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-muted/40 text-muted-foreground border border-border/60"
            }`}
          >
            {checked ? <><Eye className="h-3 w-3" /> On</> : <>Off</>}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/apng,video/mp4,video/webm";

function CustomBackgroundUploader({
  userId,
  url,
  active,
  onPick,
  onChange,
}: {
  userId: string | null;
  url: string | null;
  active: boolean;
  onPick: () => void;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const saveUrl = useServerFn(setCustomBackground);

  const isVideo = !!url && /\.(mp4|webm)(\?|$)/i.test(url);
  const isGif = !!url && /\.gif(\?|$)/i.test(url);

  function pathFromPublicUrl(u: string | null): string | null {
    if (!u) return null;
    const m = u.match(/\/storage\/v1\/object\/public\/profile-media\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function handleFile(file: File) {
    if (!userId) {
      toast.error("Sign in to upload");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File is too large (max 15MB)");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/bg-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("profile-media")
        .upload(path, file, { contentType: file.type, upsert: true, cacheControl: "31536000" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const previousPath = pathFromPublicUrl(url);
      await saveUrl({ data: { url: publicUrl, previousPath } });
      onChange(publicUrl);
      toast.success("Custom background uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!url) return;
    setBusy(true);
    try {
      const previousPath = pathFromPublicUrl(url);
      await saveUrl({ data: { url: null, previousPath } });
      onChange(null);
      toast.success("Custom background removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-gradient-to-br from-primary/5 via-background/40 to-fuchsia-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">Custom animated background</div>
            <div className="text-[11px] text-muted-foreground">
              Upload your own GIF, PNG, JPG, WEBP, or short MP4/WebM (max 15MB).
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {url ? "Replace" : "Upload"}
          </button>
          {url && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      </div>

      {url && (
        <button
          type="button"
          onClick={onPick}
          className={`group relative mt-3 block h-28 w-full overflow-hidden rounded-lg border transition ${
            active ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-border"
          }`}
          title="Use this background"
        >
          {isVideo ? (
            <video src={url} autoPlay loop muted playsInline className="h-full w-full object-cover" />
          ) : (
            <img src={url} alt="Custom background" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
            <span>{active ? "Selected" : "Click to use"}</span>
            <span className="rounded bg-white/15 px-1.5 py-0.5">
              {isVideo ? "VIDEO" : isGif ? "GIF" : "IMAGE"}
            </span>
          </div>
        </button>
      )}
    </div>
  );
}

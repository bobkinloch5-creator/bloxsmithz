This is a sizable feature. Here's how I'd ship it cleanly. Reply with anything you want changed, otherwise I'll build it end-to-end.

## 1. Fix the broken "Private profile" toggle (quick win)
The current `<input type="checkbox">` uses a plain HTML control with `className="rounded border-border"` which renders invisibly on the dark theme — no checkmark, no fill. Replace with the existing themed `<Checkbox>` (shadcn) + label, with an explicit on/off pill so users can see the state.

## 2. Database — extend `profiles` with the missing fields
Single migration adds (existing columns kept untouched):
- `banner_url`, `banner_color` (already have `banner_url`), `profile_background` (preset key: `studio`, `neon-city`, `obby`, `forest`, `space`, `lava`, `clouds`, `void`, etc.)
- `profile_layout` (`classic` | `card` | `cinematic` | `compact`)
- `pfp_effect` (ring effect: `none` | `gold` | `rainbow` | `flame` | `electric` | `ice` | `galaxy`)
- `badges` (text[] — earned badge keys, server-controlled)
- `status_message` (text, 80 chars)
- `pronouns`, `location` (optional public fields)
- `presence_enabled` (bool, default true), `presence_status` (`online`|`idle`|`dnd`|`invisible`), `last_seen_at` (timestamptz)
- `show_activity` (bool — whether to show "working on X project")
- `current_activity` (jsonb — `{ kind: "project"|"chat"|"idle", label, project_id? }`)

All with proper CHECK constraints + RLS:
- public read of safe columns via a `profiles_public` view (excluding email, ban fields, verification codes) — gated by `private_profile`: if private, only friends + self + admins can read full data; others see only display_name, avatar, banner, badges, level.
- existing GRANTs preserved.

## 3. Profile customization page (account.tsx)
New "Profile" tab with sections:
- **Identity**: display name, bio, pronouns, location, status message
- **Avatar & Banner**: upload to `avatars`/`banners` storage buckets (already exist) with live preview, plus a "Banner color" fallback
- **Background theme**: 8 Roblox-themed animated SVG/gradient backgrounds in a grid picker with live preview
- **Layout**: 4 layout previews (Classic / Card / Cinematic / Compact)
- **PFP ring effect**: 7 animated ring presets shown on a live avatar
- **Accent + animated effect**: keep existing `profile_accent` + `profile_effect` (sparkle/aurora/neon/holo/confetti/stars)
- **Privacy**: fixed visible toggle for `private_profile` + `hide_email` + `presence_enabled` + `show_activity`
- **Presence status**: online / idle / dnd / invisible selector

Everything saves via a single `updateProfileCustomization` server function (createServerFn + requireSupabaseAuth + Zod validation). Optimistic UI + toast confirmation. All settings load from `profiles` on mount and persist across devices.

## 4. Public profile view (overhaul `UserProfilePopover` + new `/u/$userId` route)
- Banner with parallax + animated background theme
- Avatar with PFP ring effect + presence dot (green/yellow/red/gray)
- Display name, pronouns, status message, role badges, custom badges
- Stat row: followers · following · level/XP · achievements · projects shipped
- Action buttons: Add friend / Message / Report (already exist) + Follow
- Animated entry, mobile-friendly (full-screen sheet on mobile, dialog on desktop)
- Respects `private_profile`: shows minimal card + "This profile is private" if not friends

## 5. Presence system
- On app mount: heartbeat updates `last_seen_at` every 60s + sets `presence_status` (respects user choice; "invisible" never broadcasts online)
- On unmount/visibility hidden: best-effort update to idle after 5min
- `current_activity` updated when entering project editor / chat (debounced)
- Toggle in settings: "Show my online status" + "Show what I'm working on"
- Displayed as colored dot + label on avatar everywhere (chat, friends panel, profile)

## 6. Badges
Server-awarded keys mapped to icon + label + color in a `BADGES` registry (similar to current `RoleBadge`):
- `early-adopter`, `top-creator`, `bug-hunter`, `first-publish`, `community-helper`, `mvp`, `verified-roblox`, etc.
- Awarded by triggers/RPC on milestones; displayed on profile.

## Technical notes
- All new server logic via `createServerFn` (no edge functions).
- Zod-validated input on every write.
- Backgrounds rendered as CSS-only animated gradients or inline SVG (no extra assets to download).
- Mobile-first responsive layout, semantic tokens from `src/styles.css`.
- All `profiles` columns added in one migration with GRANTs, RLS policies, and the public view.

Want me to proceed with all of this, or trim anything (e.g. skip badges, skip backgrounds)?
# BloxSmith Changelog

## Latest Updates

### Roblox Video, Music & Speech Studio

- Added a new `/video-generator` creator workspace for Roblox-safe AI videos, music, and speech-to-text.
- Added Doubao Seedance 2.0 (`doubao-seedance-2-0`) video generation through CometAPI.
- Added a server-enforced one-video-per-week limit with unlock timing so users clearly know when they can generate again.
- Added a live mobile-ready preview frame before generation with the selected aspect ratio, prompt, CTA, reference image, and clip plan.
- Added stronger download controls for generated video clips, including mobile-friendly open/save links and a ready-downloads section.
- Added Roblox video presets for ad promos, trailers, update teasers, UGC showcases, obbies, tycoons, simulators, spooky teasers, before/after builds, and vertical shorts.
- Added animation-direction controls and safer prompt guidance for smooth Roblox avatar/object motion.
- Added 5s, 10s, 15s, 30s, and 1m duration choices. Longer videos are split into safe Seedance clip segments because the current Seedance API supports short clips per task.
- Added image-to-video reference uploads for PNG, JPG, and WEBP files.
- Added a Roblox-safe music generator panel with configurable title, style, length, instrumental mode, and Comet music endpoint support.
- Added a Roblox music import kit that downloads a Studio Lua script after users upload generated audio to Roblox and paste the audio asset ID.
- Added Gemini 3.1 Flash Lite Preview speech-to-text for uploaded audio/video, with transcript, captions, and script-notes modes.
- Added storage buckets for generated video and audio outputs so signed provider URLs can be re-hosted as public BloxSmith downloads.
- Added Roblox safety filtering before video and music provider calls.
- Added `gemini-3.1-flash-lite-preview` to the Google provider model list.
- Added a Global Chat collaboration invite button so users can post structured team-up requests for builders, scripters, UI designers, animators, testers, or partners.
- Added “How to earn credits” guidance to the Browse menu and community page so users can quickly see daily claims, Discord, referrals, chat rewards, badges, promo codes, promo videos, and credit packs.
- Added mobile nav shortcuts for earning credits so phone users can jump straight to daily claims, free signup credits, and credit info from the horizontal nav bar.

### MCP & Provider Secret Vault Migration

- Removed stale UI and server references to the dropped `user_mcp_servers.auth_header` column.
- Removed provider API key reads/writes from the dropped `user_provider_keys.api_key` column.
- Added server-side MCP add/remove functions so optional MCP authorization headers are stored in the encrypted vault instead of being written from the browser.
- Updated MCP health checks and MCP tool loading to resolve authorization headers from the vault.
- Updated user provider-key save, clear, and AI gateway resolution paths to use vault-backed secrets.
- Added a database migration that backfills old `auth_header` and `api_key` values into vault secrets before dropping the legacy columns.
- Regenerated the local Supabase TypeScript contract for the dropped secret columns.
- Verified the changes with TypeScript and a production build.

### AI Model Status & Availability

- Added green/red availability indicators to the AI model picker so users can immediately see which models are online and which are temporarily down.
- Disabled models that are currently marked down so users cannot select a broken or unavailable AI model by mistake.
- Added clear down-state labels such as Temporarily down, Provider down, Timed out, Rate limited, Auth failed, Model unavailable, and Not configured.
- Added automatic model health polling in the picker so availability refreshes every 30 seconds while users are working.
- Added server-side model health snapshots using recent AI provider events so the UI reflects real model failures and recoveries.
- Added fallback protection for saved project settings so if a saved Neokens model is down, the server tries an available site model instead of sending the request to a known-bad model.
- Updated admin model diagnostics so test results are recorded into provider health events, letting successful checks bring models back online.
- Kept user prompt/context/tool/JSON-specific failures from globally disabling a model, so only provider-style outages or availability problems mark a model down.
- Verified the changed files with TypeScript, targeted ESLint, and a production build.

### 3D Model Generator, Profile Themes & Onboarding

- Renamed and surfaced the 3D tool as a clear **3D Model Generator** website feature for Roblox text-to-3D and image-to-3D assets.
- Added new animated Roblox-style profile backgrounds including futuristic, simulator, tycoon, anime, fantasy, city, neon, dark, and premium themes.
- Added more earnable profile badges for onboarding, asset generation, 3D model creation, UI generation, image generation, clothing, invites, project milestones, and credit milestones.
- Rebuilt onboarding into a saved account tour with feature highlights, tooltips, progress steps, mobile-friendly layout, and a completion reward badge/free-credit grant.
- Added Supabase persistence for onboarding progress, completion, reward claiming, profile themes, and earned badge unlocks.

### Profile Badges & Role Labels

- Added owner/admin/moderator role labels and earned role badges to the account dropdown and public profile popover.
- Made profile badge saving safer by preventing users from self-selecting locked badges like Founder, Staff, Moderator, or Verified unless their account role earns them.
- Updated profile customization previews and the account profile badge list so earned role badges and selected display badges show together.

### Avatar Decoration Images

- Replaced emoji-only avatar decoration artwork with local image assets for crowns, halos, wings, rings, auras, hats, goggles, visors, and seasonal decorations.
- Kept animated premium motion effects while making the visible decoration previews and public profile overlays render from real image files.

### Profile Decoration & Card Effects

- Added premium animated avatar decorations including cosmic crowns, plasma halos, royal wings, orbit effects, star showers, glitch frames, flame/lightning auras, crystal spikes, coin crowns, and builder goggles.
- Added profile card color customization so users can tint their public profile card separately from their accent color.
- Added animated profile card effects including soft glow, aurora edge, premium shine, scanline, starfield, and pixel rain.
- Added new banner effects for comet trails, glowing runes, and spotlight overlays.
- Updated public profile cards so saved card colors and effects show in the Global Chat profile popover.

### Premium Templates, Avatar Preview & Usage Analytics

- Added premium credit-costing Roblox templates for RPG hubs, pet simulator hatcheries, tycoons, battle passes, trading plazas, and moderation suites.
- Upgraded the Browse menu and Template Store so premium templates are easier to find and show credit cost clearly.
- Added earned profile badge progress based on activity, projects, credits, Discord perks, and owner/staff status.
- Improved the Roblox clothing 3D preview so hoodies, layered clothing, accessories, and pants render as separate wearable shapes instead of flat shirt decals.
- Added explicit AI usage event logging for generators and template installs, including owner/free runs that do not spend credits.
- Improved the account usage dashboard so the graph always renders and fills from either usage events or credit transactions.
- Made UI Generator template tiles more premium with Pro labels, credit cost badges, and clearer descriptions.

### Signup Email & 3D Generator Safety

- Added a Resend confirmation email action on signup for users who did not receive their email.
- Added Image to 3D mode to the 3D generator with PNG/JPG/WEBP uploads and image preview.
- Added server-side NSFW safety checks for 3D text prompts and image uploads before Tripo generation starts.
- Added rigged / animation-ready Tripo export controls with FBX-friendly settings and in-place animation export support.

### UI Generator Reliability & Polish

- Fixed the UI Generator getting stuck and ending with "No output generated."
- Added a complete deterministic ScreenGui fallback so slow or empty AI responses still return usable Roblox UI.
- Shortened the visible generation wait so the page feels faster.
- Polished the `/ui-generator` page with a cleaner builder header, compact stats, better template tiles, stronger style controls, and an upgraded preview frame.
- Added a visible Save to Library action so generated previews can be saved even if automatic saving did not return a generation id.
- Made generated UI templates fancier with layered panels, gradients, header glow, badges, thicker strokes, stronger buttons, and clearer Roblox-style hierarchy.
- Upgraded Spin Wheel output into a more circular premium wheel with glow, reward badges, pointer marker, prize panel, spin button, RemoteEvent, LocalScript, and ServerScript.

### Global Chat Rules

- Added a Global Chat rules panel that explains respect, spam, scams, unsafe links, privacy, clean content, and staff direction rules.
- Updated `/rules` to open the rules panel and explain what happens after rule breaks.
- Clarified moderation consequences including blocked/removed messages, warnings, timeouts/mutes, and account restrictions for serious abuse.

### AI Building Replicas

- Improved image-based 1-to-1 building replica prompts so they use stronger vision routing and a longer client wait window.
- Added a complete Roblox-scale building replica fallback with floors, facade, roof, windows, trim, balcony, lights, spawn, and ground instead of an empty folder.
- Broadened build intent and asset-tool detection so visual build requests get richer actions more consistently.

### Admin Security

- Locked admin role promotion/demotion to owner accounts only.
- Updated database role policies, the `admin_set_role` RPC, the admin page, and the Global Chat `/role` command so regular admins cannot make other users admin.
- Added an owner-managed Moderator role for Global Chat moderation without admin/dashboard credit permissions.
- Locked manual credit adjustments to owners, protected profile credit fields from direct client edits, and tightened refund RPC checks so users cannot call refunds to mint credits.

### Profile Fixes

- Fixed profile settings not saving correctly.
- Added a stronger fallback save system for display name, bio, and studio specialty.
- Profile details now save into the profile table and auth metadata when needed.
- Profile data refreshes after saving so users see the newest info right away.

### Credit Deduction

- Tightened credit deduction for AI image generation.
- Tightened credit deduction for Roblox clothing generation.
- Added fallback credit charging if the Supabase credit RPC is missing or not working.
- Added credit transaction logging for successful paid generations.
- Owners/admins can still generate without being charged.

### Profile Customization

- Added real profile picture/avatar uploads inside the user profile page.
- Added profile banner uploads so users can customize their account with a wide cover image.
- Added Roblox-style generated avatars for users who do not upload a profile picture.
- Profile pictures now display as the user icon in the website header/account menu.

### AI Model Guide

- Added a Roblox AI model guide on AI/model areas of the website.
- The guide explains what each model is best used for when building Roblox games.

### Profile Security

- Added two-factor authentication setup directly inside the user profile/account area.
- Added Change Password inside profile settings.
- Login now supports accounts that require 2FA verification.

### AI Models

- Removed Gemini Pro from the selectable model list.
- Kept Gemini Flash as the fast fallback model.

### Chat Helper

- Repositioned the AI Help chat assistant properly across the site.

### Themes

- Added the official BloxSmith branded neon theme/background into the theme system.

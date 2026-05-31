# BloxSmith Changelog

## Latest Updates

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

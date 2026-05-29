## Goal
Ship a real Roblox UI/GUI Generator to Bloxsmith: AI-generated UI + Luau, live preview (desktop & mobile), credit-gated, one-click insert via the existing Studio plugin channel, with a template browser and saved generations. Plus polish the HelpChat and add a Toolbox asset picker inside chat.

## Scope (this batch)

### 1. UI Generator page — `/ui-generator`
- Template browser: 20 presets (Gamepass Shop, Dev Product Shop, Coin/Gem Shop, Main Menu, Loading Screen, Settings, Inventory, Pet Inventory, Trading, Daily Rewards, Spin Wheel, Codes, Quest, Teleport, Upgrade, Rebirth, Leaderboard, Admin Panel, Mobile Controls, HUDs) plus **Custom prompt**.
- Style presets: Modern / Neon / Minimal / Cartoon / Glass / Anime. Color picker for primary/accent/bg, title text, button labels (editable list), corner radius, font.
- AI generation: server fn `generateRobloxUI` using `google/gemini-3-flash-preview` with `Output.object` schema. Returns a typed `UISpec` (ScreenGui → Frames → children: TextLabel/TextButton/ImageButton/UIStroke/UICorner/UIGradient/UIList/UIGridLayout + LocalScripts + optional ServerScripts/RemoteEvents) AND ready-to-insert `actions[]` matching the existing plugin protocol used in `execute.ts` (`create` actions with `properties`, plus `file` writes for ServerScriptService / ReplicatedStorage).
- Credit cost: **5 credits** shown up-front, charged via existing `charge_credits` RPC, refunded on failure (mirrors `ai.functions.ts` pattern).

### 2. Dual-device live preview
- Pure React renderer that walks the returned `UISpec` and draws it inside a Roblox-screen viewport (1920×1080 desktop frame and 932×430 mobile frame, both scaled). Renders absolute-positioned divs styled from UDim2/Color3/UICorner/UIGradient/UIStroke. Toggle Desktop ↔ Mobile.
- Per-element click selects → side panel shows properties (text/color) for quick tweaks before insert.
- Tabs: **Preview · Luau Code · JSON Spec**.

### 3. Insert into Studio
- "Insert into Roblox Studio" button → calls existing plugin command channel (`api/public/plugin/*`) by enqueuing the `actions[]` + `files[]` against the active project (same path the AI builder already uses).
- UI shows "Queued" until plugin posts back success/error; surfaces the actual plugin response (no fake success). Re-uses `PluginStatus` connection state.

### 4. Generations library
- New table `ui_generations` (id, user_id, project_id, title, category, spec jsonb, actions jsonb, files jsonb, thumbnail_url, created_at) with RLS (owner read/write, service_role all) + GRANTs.
- "My UI Library" tab on the generator page — list, re-open, re-insert, delete.

### 5. HelpChat fixes
- Keep the draggable button + panel but rebuild internals: smaller floating button (48px), cleaner header, fixed mobile bottom-sheet, proper close animation, markdown rendering via `react-markdown` (already in repo if available; otherwise add), better error handling for 429/402.
- Wire a **Toolbox tool** into the help chat backend: when the user asks for assets (`/api/public/help-chat.ts`), the model can call a `searchToolbox` tool that returns up to 12 assets with thumbnail+id+name. The chat UI renders these as a clickable grid; each card has **Copy ID** and **Insert into Studio** (uses existing `insert_toolbox_asset` action). No fake confirmations.

### 6. Navigation
- Add "UI Generator" link to the main header nav and dashboard quick actions.

## Technical Details

**Files to create**
- `src/lib/ui-generator.server.ts` — UISpec schema (Zod), system prompt, `generateUI()` calling `streamText`/`generateText` with `Output.object`, conversion `spec → plugin actions[] + files[]`.
- `src/lib/ui-generator.functions.ts` — `generateRobloxUIFn`, `listUIGenerationsFn`, `getUIGenerationFn`, `deleteUIGenerationFn`, `insertUIGenerationFn` (enqueues to plugin).
- `src/routes/ui-generator.tsx` — page with template browser, customizer, preview canvas, code/spec tabs, library.
- `src/components/ui-generator/UIPreview.tsx` — recursive spec renderer.
- `src/components/ui-generator/TemplateGrid.tsx` — preset cards.
- `src/components/ui-generator/DevicePreviewFrame.tsx` — desktop/mobile frames.
- `src/components/help-chat/ToolboxResults.tsx` — asset grid renderer for chat.
- Migration: `ui_generations` table + RLS + GRANTs.

**Files to edit**
- `src/components/HelpChat.tsx` — internal rewrite (keep external API: still draggable, still localStorage position).
- `src/routes/api/public/help-chat.ts` — add `searchToolbox` tool.
- `src/components/layout.tsx` — add UI Generator nav link.
- `src/routeTree.gen.ts` — auto-regen.

**Out of scope (next batch, if you want)**
- Server-side gamepass / dev product purchase validation beyond a generated template script (templates ship working stub code, but live MarketplaceService wiring is the user's to configure with their actual asset IDs).
- 3D in-game preview / live-fire test inside Studio (preview is a faithful 2D render, not a Roblox runtime).
- Editing inserted UIs back from Studio (one-way insert).

## Confirm before I build
- OK with **5 credits** per UI generation?
- OK that preview is a faithful 2D React render (not a real Roblox runtime — that's not possible in the browser)?
- OK to ship 20 presets now and add more later as you request them?

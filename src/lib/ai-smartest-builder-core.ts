export const SMART_BUILDER_SYSTEM_UPGRADE = `
# BloxSmith Smartest Builder Core

You are not a generic chat model. You are BloxSmith's senior Roblox game-building agent.
Your job is to turn plain English into Studio-ready Roblox builds that are visible in edit mode, organized correctly, safe to run, and easy to continue later.

## Prime directive
For every actionable request, run this hidden loop before answering:
1. Understand the user's real goal, even if the message is misspelled, vague, or short.
2. Inspect project memory, live Studio context, existing project files, and queued/past generations.
3. Decide whether this is BUILD, EDIT, FIX, POLISH, ASSET, IMAGE, QUESTION, MCP, or BILLING.
4. Plan the correct Roblox service layout.
5. Generate only the files/actions needed.
6. Validate safety, paths, Remotes, server/client split, DataStore usage, mobile support, and image/export requirements.
7. Return Studio-ready JSON with a short confidence-building message.

## No lazy answers
Never stop at advice when you can create files/actions or generate an image. Do not say "I can't", "you need to manually", or "please clarify" unless the request is impossible to act on safely. Pick strong defaults and build.

## Correct Roblox placement rules
- Server scripts: ServerScriptService/<FeatureName>/
- LocalScripts: StarterPlayerScripts/<FeatureName>/ or StarterGui/<GuiName>/
- Shared modules: ReplicatedStorage/Modules/<FeatureName>/
- Server-only modules/templates: ServerStorage/<FeatureName>/
- RemoteEvents/RemoteFunctions: ReplicatedStorage/Remotes/<FeatureName>/
- GUIs: StarterGui/<GuiName>/ with LocalScripts under the GUI
- Tools: StarterPack/<ToolName>/
- World/map content: Workspace/<FeatureName>/
- Audio: SoundService/<FeatureName>/
- Lighting/PostFX: Lighting
- Values/config: ReplicatedStorage/Config or ServerStorage/Config depending on trust level

## Build quality standard
Every generated system should include:
- Safe server authority. Never trust client values for rewards, damage, purchases, or inventory.
- RemoteEvent validation with cooldowns and type checks.
- Clean ModuleScripts for config where the system is more than one file.
- Leaderstats integration when currency/progression is involved.
- DataStore-safe persistence only on the server, using pcall and UpdateAsync when changing saved records.
- Mobile-friendly UI sizing using Scale, AnchorPoint, UIAspectRatioConstraint where useful.
- Clear names that match the feature.
- Existing-file awareness: modify or extend matching existing systems instead of duplicating.

## Mobile-first website and chat rule
BloxSmith must feel great on phones. For mobile UI and website/chat changes:
- Use responsive layouts that fit 360px wide screens.
- Never allow chat cards, text bubbles, mode buttons, or bottom input bars to overflow horizontally.
- Use compact text on mobile: normal chat body around text-sm/base, not huge desktop text.
- Put action/mode buttons in a horizontal scroll row with snap or wrap them into two rows.
- Keep the input composer sticky near the bottom but not hidden behind the iOS Safari address bar or home indicator.
- Add safe-area padding using env(safe-area-inset-bottom) and env(safe-area-inset-top).
- Make image, mic, send, web, and tool buttons at least 44px tap targets.
- Keep scrolling inside the chat panel, not the whole page when using the builder.
- Add a clear Image button that opens image generation, not just image upload.

## Image generation rule for Roblox thumbnails/icons/decals
When the user asks for an image, thumbnail, icon, logo, decal, badge, gamepass image, group image, loading screen, banner, poster, or Roblox promo art, classify it as IMAGE.
- Never say you cannot generate images if the generate_image tool exists.
- Offer or call generate_image with a strong Roblox-ready prompt.
- Use 16:9 for Roblox thumbnails and game promo banners.
- Use 1:1 for Roblox game icons, decals, badges, gamepass icons, and square logos.
- Use 9:16 for TikTok/Reels/Shorts promo images.
- Return the generated image preview URL in the message and explain the suggested Roblox use.
- For decals/UI images, also prepare a Roblox UI/decal insertion path if the user wants it placed in Studio.
- If image generation is not configured, say: "Image generation is not connected yet — add an image provider key and I’ll generate Roblox thumbnails, icons, decals, and promo art."

## Full game template rule
When the user asks for a whole game, produce a starter game with these layers:
1. Core loop
2. Currency/progression
3. Map/lobby
4. UI/HUD
5. Shop/upgrades
6. Save system
7. Tutorial/onboarding prompt
8. Monetization placeholders that are disabled or clearly configured
9. Mobile controls if relevant
10. Publish checklist in the message

## Fix mode rule
When the user reports an error:
- Identify the likely broken file/system.
- Patch the script, not just explain.
- Add validation guards if the root cause is missing instances/remotes/services.
- Explain the fix in one short sentence.

## Asset/toolbox safety rule
When inserting free models/assets:
- For full visual builds, use the Roblox Toolbox asset planner first so maps/games get varied free assets instead of repeated copies.
- Prefer trusted/verified/free assets when available.
- City/map builds must use different asset searches for roads, buildings, streetlights, vehicles, trees, signs, props, and decorations.
- Simulator builds must use different asset searches for pets, coins/gems, zones, upgrade/shop props, tools, and theme decorations.
- Use each assetId once unless the user asks for repeated copies, and organize every insert under Workspace/Map, Workspace/NPCs, Workspace/Interactables, StarterPack/Tools, ReplicatedStorage/Assets, or SoundService.
- Scan inserted models for suspicious scripts.
- Never insert backdoors, require(assetId), loadstring, obfuscated code, or unexpected HttpService calls.
- If an asset is visual only, remove or quarantine scripts unless needed.

## Output behavior
- For build/edit/fix requests, keep message short: "Queued the system for Studio with scripts, UI, and validation."
- For image requests, keep message direct: "Generated a Roblox-ready 16:9 thumbnail and attached the preview."
- Do not claim it is created until plugin confirmation exists.
- Use "queued", "prepared", "generated", or "ready to apply" before plugin confirmation.
- Return empty files/actions only for pure questions, billing/account help, or MCP setup tool confirmations.

## Silent self-review before returning (do this every build)
Before you emit the JSON, re-read your own files against this checklist and FIX any miss silently — do not narrate the review:
1. Does every script have matching \`end\`s and balanced (), {}, []? (A missing \`end\` fails on paste — this is the #1 cause of rejected builds.)
2. Is every LocalScript under StarterPlayerScripts / StarterGui / ReplicatedFirst, and every server Script under ServerScriptService / ServerStorage?
3. Does every RemoteEvent handler on the server validate the sender and the payload type/range, with a cooldown?
4. Is any currency / damage / inventory / purchase mutated on the client? If so, move authority to the server.
5. Do DataStore writes use pcall and UpdateAsync, on the server only?
6. Did you reference a RemoteEvent / ModuleScript / Instance that you did not also create or that does not already exist in the project? If so, create it or guard the access.
7. Are you duplicating a file that already exists in the project map? If so, modify the existing one instead.
If any check fails, repair the file before returning. A build that passes validation on the first try is the goal.

## Reference: shape of a good single-feature build
When asked e.g. "add a coin pickup that gives +1 cash", a strong response queues something like (abbreviated — real content must be complete, no placeholders):
- ReplicatedStorage/Remotes/Economy/CollectCoin (RemoteEvent)
- ServerScriptService/Economy/CoinService (Script): listens to CollectCoin, validates the player owns/touches the coin, rate-limits, increments leaderstats cash server-side, then removes the coin server-side. Never trusts a client-sent amount.
- ReplicatedStorage/Modules/Economy/EconomyConfig (ModuleScript): { coinValue = 1, collectCooldown = 0.25 }
- Workspace/Coins/Coin (the visible part with a Touched-based client hint that only REQUESTS collection via the remote)
The message stays short: "Queued a server-authoritative coin pickup with config and leaderstats."
This is the bar: correct placement, server authority, config module, visible object, no client-trusted values.
`;

export const SMART_BUILDER_QUALITY_GATES = [
  "Understands vague/misspelled Roblox requests without asking repetitive clarifying questions",
  "Builds visible Studio edit-mode objects, not live-only temporary objects",
  "Places files/actions in correct Roblox services",
  "Uses server authority for currency, damage, inventory, saving, purchases, and rewards",
  "Validates RemoteEvents and RemoteFunctions with cooldowns and type checks",
  "Uses pcall and UpdateAsync for DataStore writes where appropriate",
  "Creates mobile-friendly UI when generating ScreenGuis",
  "Keeps the website chat/input/buttons usable on 360px mobile screens",
  "Provides a real Image button/workflow for Roblox thumbnails, icons, decals, badges, and promo art",
  "Modifies existing systems instead of duplicating them",
  "Queues plugin actions and says queued/prepared before confirmation",
  "Blocks common Roblox backdoor patterns before syncing to Studio",
] as const;

export const ROBLOX_GAME_TEMPLATE_STACK = {
  miningSimulator: [
    "Workspace/MiningSimulatorMap",
    "ServerScriptService/MiningSimulator",
    "ReplicatedStorage/Remotes/MiningSimulator",
    "ReplicatedStorage/Modules/MiningSimulator",
    "StarterGui/MiningHUD",
    "StarterPlayerScripts/MiningClient",
    "ServerStorage/MiningTemplates",
  ],
  tycoon: [
    "Workspace/TycoonMap",
    "ServerScriptService/Tycoon",
    "ReplicatedStorage/Remotes/Tycoon",
    "ReplicatedStorage/Modules/Tycoon",
    "StarterGui/TycoonHUD",
    "ServerStorage/TycoonTemplates",
  ],
  obby: [
    "Workspace/ObbyStages",
    "ServerScriptService/Obby",
    "ReplicatedStorage/Remotes/Obby",
    "StarterGui/ObbyHUD",
  ],
  horror: [
    "Workspace/HorrorMap",
    "ServerScriptService/HorrorGame",
    "ReplicatedStorage/Remotes/HorrorGame",
    "ReplicatedStorage/Modules/HorrorGame",
    "StarterGui/HorrorHUD",
    "StarterPlayerScripts/HorrorClient",
    "Lighting/HorrorPostFX",
  ],
} as const;

export const ROBLOX_IMAGE_PRESETS = {
  thumbnail: {
    aspectRatio: "16:9",
    use: "Roblox game thumbnail / promo banner",
    promptHint:
      "high-energy Roblox game thumbnail, bold readable title area, colorful 3D scene, dramatic lighting, clean composition",
  },
  icon: {
    aspectRatio: "1:1",
    use: "Roblox game icon",
    promptHint:
      "square Roblox game icon, centered subject, bold silhouette, bright background, readable at small size",
  },
  decal: {
    aspectRatio: "1:1",
    use: "Roblox decal / UI image / badge / gamepass icon",
    promptHint:
      "clean square decal art, transparent-style simple subject, strong outline, game-ready UI asset",
  },
  verticalPromo: {
    aspectRatio: "9:16",
    use: "TikTok, Reels, Shorts, mobile promo image",
    promptHint:
      "vertical Roblox promo poster, exciting scene, large subject, space for caption text",
  },
} as const;

export const MOBILE_BUILDER_REQUIREMENTS = [
  "360px width support",
  "No horizontal overflow",
  "Sticky composer with iOS safe-area padding",
  "Scrollable chat panel only",
  "44px minimum tap targets",
  "Compact mobile text sizes",
  "Mode buttons wrap or horizontally scroll",
  "Dedicated Generate Image button",
] as const;

export const SMART_BUILDER_RUNTIME_DIRECTIVE = `
## BloxSmith intelligence layer
Before every answer, silently behave like a senior Roblox engineer, product designer, security reviewer, and playtester at once.
- Convert vague or misspelled requests into a concrete Roblox build plan without asking repetitive clarification questions.
- Normalize typos, shorthand, and casual wording before planning. Treat "pls/please", "make better", "smarter", "gui/ui", "main menus", and similar broad asks as requests for a polished complete feature, not a tiny example.
- Preserve the user's latest message above project memory or older chat context. If the latest message says to fix, improve, replace, or add something, that is the controlling instruction.
- Break compound prompts into separate deliverables and satisfy all of them in one coherent system when safe: gameplay, UI, audio, saves, mobile support, testing, and polish.
- Think in connected systems: dependencies first, visible edit-mode objects second, scripts/remotes/modules/UI third, tests last.
- Reuse existing project systems when the context shows them; create uniquely named additions when unsure.
- Prefer high-quality Roblox outcomes over tiny demos: full-screen UI backgrounds for menus, real server authority for gameplay, mobile-safe UI, polish/VFX/audio where relevant.
- Self-repair before output: if a script references a RemoteEvent, ModuleScript, GUI, tool, folder, or asset that is missing, create it or guard it in the same batch.
- Explain briefly where things go and how to test them, but keep the structured JSON valid and action-focused.
`;

type SmartIntent = "BUILD" | "EDIT" | "FIX" | "POLISH" | "ASSET" | "IMAGE" | "QUESTION" | "META";

const INTENT_RULES: Array<{ intent: SmartIntent; pattern: RegExp }> = [
  {
    intent: "FIX",
    pattern: /\b(fix|broken|error|bug|not working|doesn'?t work|failed|missing|issue|debug|why)\b/i,
  },
  {
    intent: "POLISH",
    pattern:
      /\b(polish|better|improve|premium|clean|smooth|less laggy|optimi[sz]e|effects?|vfx|particles?|animate|animation)\b/i,
  },
  {
    intent: "ASSET",
    pattern: /\b(toolbox|asset|model id|free model|decal|sound|music|skybox|mesh|catalog)\b/i,
  },
  {
    intent: "IMAGE",
    pattern:
      /\b(image|thumbnail|icon|logo|decal|badge|gamepass|banner|poster|picture|background art)\b/i,
  },
  {
    intent: "EDIT",
    pattern: /\b(change|update|move|rename|resize|recolor|replace|swap|remove|delete)\b/i,
  },
  {
    intent: "BUILD",
    pattern:
      /\b(make|add|create|build|generate|spawn|insert|give me|i want|need|ui|gui|system|game|map|shop|menu|hud|tool)\b/i,
  },
  { intent: "META", pattern: /\b(cancel|stop|undo|revert|clear chat)\b/i },
  { intent: "QUESTION", pattern: /\b(how|what|why|when|where|explain)\b/i },
];

const SYSTEM_DEPENDENCIES: Array<{ name: string; pattern: RegExp; deps: string[] }> = [
  {
    name: "Simulator",
    pattern: /\b(simulator|sim|pet sim|clicker|rebirth|zone|egg|hatch|backpack|sell)\b/i,
    deps: ["Currency/leaderstats", "DataService", "Inventory", "Shop", "Zones", "Mobile HUD"],
  },
  {
    name: "Tycoon",
    pattern: /\b(tycoon|tycon|dropper|conveyor|collector|owner door|purchase pad)\b/i,
    deps: [
      "Cash/leaderstats",
      "Plot ownership",
      "Purchase validation",
      "Templates",
      "Collector",
      "Save data",
    ],
  },
  {
    name: "Obby",
    pattern: /\b(obby|obbie|obbyy|checkpoint|stage|killbrick|jump pad|moving platform)\b/i,
    deps: [
      "Checkpoints",
      "Stage save",
      "Spawn locations",
      "Hazards",
      "Finish reward",
      "Mobile HUD",
    ],
  },
  {
    name: "Combat",
    pattern: /\b(combat|weapon|sword|gun|boss|enemy|npc|damage|ability|skill|pvp)\b/i,
    deps: [
      "Server hit validation",
      "Cooldowns",
      "Tools/animations",
      "VFX/SFX",
      "Health/rewards",
      "Anti-exploit checks",
    ],
  },
  {
    name: "UI",
    pattern:
      /\b(ui|gui|guis|menus?|main menu|main menus|hud|shop screen|settings|inventory|loading|splash|button|panel|interface|screen|layout)\b/i,
    deps: [
      "StarterGui ScreenGui",
      "Responsive frames",
      "TweenService polish",
      "Input handlers",
      "Server remotes if gameplay changes",
    ],
  },
  {
    name: "Economy",
    pattern:
      /\b(coins?|cash|gems?|credits?|shop|buy|sell|reward|daily|code|promo|gamepass|developer product)\b/i,
    deps: [
      "Server authority",
      "Leaderstats",
      "DataService",
      "Purchase validation",
      "Receipts/rewards",
      "Confirmation UI",
    ],
  },
  {
    name: "World",
    pattern: /\b(map|world|city|lobby|island|forest|school|horror|arena|base|background)\b/i,
    deps: [
      "Workspace/Map folders",
      "SpawnLocation",
      "Lighting/PostFX",
      "Props/assets",
      "Collision/passability",
      "Performance budget",
    ],
  },
  {
    name: "Animation/VFX",
    pattern:
      /\b(animation|animate|emote|walk|run|idle|particle|vfx|trail|beam|aura|explosion|spark|effect)\b/i,
    deps: [
      "Animator-safe animation loading",
      "Reusable ReplicatedStorage/VFX helpers",
      "Debris cleanup",
      "Reasonable particle counts",
      "Preview/test step",
    ],
  },
  {
    name: "Audio",
    pattern:
      /\b(sound|sounds|sfx|music|audio|click sound|button sound|ambient|ambience|mute|volume)\b/i,
    deps: [
      "SoundService folders",
      "Reusable audio config",
      "UI feedback sounds",
      "Mute/volume setting",
      "No autoplay surprises",
    ],
  },
];

const PROMPT_NORMALIZATIONS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /\b(guis?|ui|menus?|main menus?|hud|interface)\b/i,
    hint: "Treat UI/menu requests as polished, mobile-safe ScreenGui systems with states, transitions, buttons, and feedback.",
  },
  {
    pattern: /\b(better|smarter|perfect|premium|pro|polish|improve|upgrade)\b/i,
    hint: "Treat quality words as a request for complete UX polish, not just wording changes.",
  },
  {
    pattern: /\b(sound|sounds|sfx|music|audio)\b/i,
    hint: "Include SoundService organization, safe defaults, UI click feedback, mute/volume controls, and graceful missing-asset fallback.",
  },
  {
    pattern: /\b(know|understand|prompt|what i am saying|wat i mean|wut i mean)\b/i,
    hint: "Infer the intended Roblox feature from messy wording while preserving the user's latest request.",
  },
  {
    pattern: /\b(game|full|whole|entire|complete|all functions?|everything)\b/i,
    hint: "Plan a connected vertical slice with core loop, UI, server authority, data, audio, mobile support, and test steps.",
  },
  {
    pattern: /\b(fix|broken|not working|doesn'?t work|errors?|bug)\b/i,
    hint: "Patch the likely broken system and add guards/tests instead of only explaining the issue.",
  },
  { pattern: /\b(tycon)\b/i, hint: "Normalize 'tycon' to tycoon." },
  { pattern: /\b(obbie|obbyy)\b/i, hint: "Normalize obby misspellings to obby." },
];

export function inferSmartIntent(prompt: string): SmartIntent {
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(prompt)) return rule.intent;
  }
  return "BUILD";
}

export function isSmartFullPromptRequest(prompt: string, aiMode?: string | null): boolean {
  const combined = `${prompt}\n${aiMode ?? ""}`;
  return (
    /\b(game|full|complete|entire|everything|all functions?|system|tycoon|tycon|simulator|sim|obby|obbie|obbyy|combat|inventory|shop|menu|menus?|main menu|main menus|hud|ui|gui|guis|interface|loading|splash|settings|quest|npc|enemy|boss|pet|map|world|city|lobby|datastore|save|gamepass|developer product|animation|vfx|particle|sound|sounds|audio|music|cutscene|playtest|debug|fix|better|smarter|premium|polish|mobile)\b/i.test(
      combined,
    ) ||
    /\b(and|also|plus|with|then)\b.+\b(ui|gui|sound|save|shop|map|menu|fix|better|polish|mobile)\b/i.test(
      combined,
    ) ||
    combined.length > 160
  );
}

export function buildPromptUnderstandingBlock(prompt: string) {
  const hints = PROMPT_NORMALIZATIONS.filter((rule) => rule.pattern.test(prompt)).map(
    (rule) => rule.hint,
  );
  if (!hints.length) {
    return "Prompt understanding: preserve the user's literal latest request, infer practical Roblox defaults, and avoid over-asking for clarification.";
  }
  return [
    "Prompt understanding:",
    ...[...new Set(hints)].slice(0, 6).map((hint) => `- ${hint}`),
  ].join("\n");
}

export function buildSmartContextBlock(
  prompt: string,
  options?: {
    aiMode?: string | null;
    studioConnected?: boolean;
    hasVisionImages?: boolean;
    fileCount?: number;
    liveInstanceCount?: number | null;
  },
) {
  const intent = inferSmartIntent(prompt);
  const matched = SYSTEM_DEPENDENCIES.filter((x) => x.pattern.test(prompt));
  const systems = matched.length ? matched.map((x) => x.name) : ["General Roblox build"];
  const dependencies = matched.flatMap((x) => x.deps);
  const uniqueDeps = [...new Set(dependencies)].slice(0, 12);
  const fullQuality = isSmartFullPromptRequest(prompt, options?.aiMode);
  const understanding = buildPromptUnderstandingBlock(prompt);
  const shouldUseTools =
    intent !== "QUESTION" &&
    /\b(asset|toolbox|model|sound|music|decal|skybox|map|world|city|lobby|npc|weapon|vehicle|pet|thumbnail|image|docs?|api|current|roblox)\b/i.test(
      prompt,
    );

  return [
    "=== SMART BUILD ROUTER ===",
    `Detected intent: ${intent}`,
    `Quality mode: ${fullQuality ? "deep connected Roblox build" : "fast focused Roblox edit"}`,
    `Likely systems: ${systems.join(", ")}`,
    understanding,
    uniqueDeps.length ? `Dependency order to respect: ${uniqueDeps.join(" -> ")}` : "",
    `Studio context: ${options?.studioConnected ? "plugin connected" : "plugin not connected or unknown"}; live instances: ${options?.liveInstanceCount ?? "unknown"}; saved files: ${options?.fileCount ?? 0}`,
    options?.hasVisionImages
      ? "Vision input: user attached image(s); inspect them for UI/layout/error clues before building."
      : "",
    shouldUseTools
      ? "Tool strategy: use Roblox docs/toolbox/image tools when useful; verify assets are free/safe; do not invent asset IDs."
      : "Tool strategy: no external lookup needed unless the model is unsure about a Roblox API.",
    "Self-check focus: correct service placement, no unsafe deletes, server-authoritative gameplay, mobile-safe UI, visible edit-mode objects, matching remotes/modules, concise test steps.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSmartBuilderPrompt(options?: { projectName?: string; mode?: string }) {
  const project = options?.projectName ? `\nCurrent project: ${options.projectName}` : "";
  const mode = options?.mode ? `\nRequested mode: ${options.mode}` : "";
  return `${SMART_BUILDER_SYSTEM_UPGRADE}${project}${mode}`;
}

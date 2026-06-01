// UI Generator: fast Roblox ScreenGui spec generation + plugin action conversion.
// Server-only.
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { createProvider } from "@/lib/ai-providers.server";
import {
  createGroqProvider,
  BLOXSMITH_THINK_MODEL,
  sanitizingFetch,
} from "@/lib/ai-gateway.server";

function createLovableProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: sanitizingFetch,
  });
}

// ---------------- UISpec schema ----------------
// Compact, model-friendly schema. Coordinates use a single struct so the model
// has fewer ways to get it wrong than emitting Roblox UDim2 strings.

const Udim2 = z.object({
  xScale: z.number().min(-1).max(2),
  xOffset: z.number().int().min(-2000).max(2000),
  yScale: z.number().min(-1).max(2),
  yOffset: z.number().int().min(-2000).max(2000),
});

const Color = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

const ElementBase = {
  id: z.string().min(1).max(48),
  name: z.string().min(1).max(60),
  position: Udim2.optional(),
  size: Udim2.optional(),
  anchorPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  zIndex: z.number().int().min(0).max(100).optional(),
  backgroundColor: Color.optional(),
  backgroundTransparency: z.number().min(0).max(1).optional(),
  cornerRadius: z.number().int().min(0).max(240).optional(),
  strokeColor: Color.optional(),
  strokeThickness: z.number().min(0).max(10).optional(),
  gradient: z
    .object({
      from: Color,
      to: Color,
      rotation: z.number().min(0).max(360).default(90),
    })
    .optional(),
};

type UIElement = {
  type: "Frame" | "TextLabel" | "TextButton" | "ImageButton" | "ImageLabel" | "ScrollingFrame";
  id: string;
  name: string;
  text?: string;
  textColor?: { r: number; g: number; b: number };
  textSize?: number;
  font?: string;
  textAlign?: "Left" | "Center" | "Right";
  image?: string; // rbxassetid:// or asset id number string
  position?: z.infer<typeof Udim2>;
  size?: z.infer<typeof Udim2>;
  anchorPoint?: { x: number; y: number };
  zIndex?: number;
  backgroundColor?: { r: number; g: number; b: number };
  backgroundTransparency?: number;
  cornerRadius?: number;
  strokeColor?: { r: number; g: number; b: number };
  strokeThickness?: number;
  gradient?: { from: { r: number; g: number; b: number }; to: { r: number; g: number; b: number }; rotation: number };
  layout?: "List" | "Grid" | "None";
  layoutDirection?: "Vertical" | "Horizontal";
  layoutPadding?: number;
  cellSize?: z.infer<typeof Udim2>;
  children?: UIElement[];
};

// Use z.lazy for recursion so both AI output and deterministic templates validate.
const UIElementSchema: z.ZodType<UIElement> = z.lazy(() =>
  z.object({
    type: z.enum(["Frame", "TextLabel", "TextButton", "ImageButton", "ImageLabel", "ScrollingFrame"]),
    ...ElementBase,
    text: z.string().max(200).optional(),
    textColor: Color.optional(),
    textSize: z.number().int().min(8).max(64).optional(),
    font: z.string().max(40).optional(),
    textAlign: z.enum(["Left", "Center", "Right"]).optional(),
    image: z.string().max(120).optional(),
    layout: z.enum(["List", "Grid", "None"]).optional(),
    layoutDirection: z.enum(["Vertical", "Horizontal"]).optional(),
    layoutPadding: z.number().int().min(0).max(80).optional(),
    cellSize: Udim2.optional(),
    children: z.array(UIElementSchema).max(40).optional(),
  }),
) as unknown as z.ZodType<UIElement>;

export const UISpecSchema = z.object({
  title: z.string().min(1).max(80),
  screenGuiName: z.string().min(1).max(60),
  mobileFriendly: z.boolean().default(true),
  description: z.string().max(400).optional(),
  root: UIElementSchema,
  remoteEvents: z.array(z.string().min(1).max(60)).max(10).optional(),
  serverScript: z.string().max(8000).optional(),
  localScript: z.string().max(8000).optional(),
});

export type UISpec = z.infer<typeof UISpecSchema>;

// ---------------- Categories & system prompt ----------------

export const UI_CATEGORIES = [
  "Gamepass Shop",
  "Dev Product Shop",
  "Coin Shop",
  "Gem Shop",
  "Main Menu",
  "Loading Screen",
  "Settings Menu",
  "Inventory",
  "Pet Inventory",
  "Trading",
  "Daily Rewards",
  "Spin Wheel",
  "Codes Redeem",
  "Quest UI",
  "Teleport UI",
  "Upgrade UI",
  "Rebirth UI",
  "Leaderboard",
  "Admin Panel",
  "Mobile Controls",
  "HUD",
  "Custom",
] as const;

export type UICategory = (typeof UI_CATEGORIES)[number];

export const UI_STYLES = ["Modern", "Neon", "Minimal", "Cartoon", "Glass", "Anime"] as const;
export type UIStyle = (typeof UI_STYLES)[number];

const UI_AI_TIMEOUT_MS = 7_500;
const UI_AI_OUTPUT_TOKENS = 4_500;

const STYLE_HINTS: Record<UIStyle, string> = {
  Modern: "Rounded corners (12-16px), drop shadows via UIStroke, balanced spacing, subtle gradients.",
  Neon: "Dark backgrounds, glowing neon accents on borders/text, strong gradients, vivid primary color.",
  Minimal: "Flat colors, no gradients, thin strokes, generous whitespace, small corner radius (4-8px).",
  Cartoon: "Thick borders (3-4px), bright saturated colors, large rounded corners (20-28px), playful fonts (FredokaOne/LuckiestGuy).",
  Glass: "Semi-transparent backgrounds (0.3-0.5 transparency), subtle gradients, frosted look, thin white strokes.",
  Anime: "Pastel/vivid gradients, sharp accents, decorative strokes, rounded but stylized.",
};

export const UI_SYSTEM_PROMPT = `You are BloxSmith's Roblox UI Generator. You design beautiful, production-ready Roblox ScreenGui layouts.

OUTPUT CONTRACT
Return a single JSON object matching the UISpec schema:
- title: short human title
- screenGuiName: PascalCase ScreenGui name (e.g. "GamepassShopGui")
- mobileFriendly: true unless user says otherwise
- root: a Frame element (the main container) with children
- remoteEvents: list of RemoteEvent names if the UI needs server validation (purchases, rewards)
- serverScript: optional Luau ServerScript content (validate purchases server-side)
- localScript: optional Luau LocalScript content (UI behavior, button handlers)

LAYOUT RULES
- Root Frame should fill the screen or center a modal. Use Scale (not Offset) so it scales on all devices.
- Use anchorPoint {x:0.5, y:0.5} + position {xScale:0.5, yScale:0.5} for centered modals.
- Make the UI look premium: layered panels, clear hierarchy, vivid accent borders, gradients, decorative badges, status rows, and strong Roblox game readability.
- For Main Menu, title screen, loading screen, or any request mentioning a background: build a full-screen 2D background INSIDE the ScreenGui. Use an ImageLabel or Frame named BackgroundImage/BackgroundLayer with size {1,0,1,0}, position {0,0,0,0}, zIndex 1, ScaleType Crop if image, plus a dark overlay if needed. Put title/buttons above it at zIndex 3+. Never represent UI backgrounds with Workspace parts, 3D models, terrain, or giant blocks.
- Buttons: cornerRadius 10-18, strokeThickness 1-3, hover-friendly sizes (min 44px height), bold labels.
- Circular widgets such as spin wheels, profile rings, or meters may use high cornerRadius values matching half their pixel size.
- For shop grids use layout:"Grid" with cellSize.
- For lists use layout:"List" with layoutDirection.
- Always set readable textColor (high contrast against background).
- Colors in 0-255 RGB. Use real palettes, not always grey.

LUAU RULES
- LocalScripts go inside the UI. Use script.Parent to find elements (use .Name lookups matching ids).
- RemoteEvents you declare go in ReplicatedStorage. Server script in ServerScriptService listens.
- For Gamepass/DevProduct shops: use MarketplaceService:PromptGamePassPurchase / PromptProductPurchase. Validate ownership server-side with UserOwnsGamePassAsync. Never trust the client.
- For coins/gems/codes/spin/daily rewards: server validates and updates leaderstats. Client only requests.
- Keep scripts concise: under 150 lines each. Use clear comments.
- Use task.wait / task.spawn (not wait/spawn).

DO NOT include markdown, prose, or explanations — JSON only.`;

function wantsMainMenuBackground(opts: { category: UICategory; prompt: string }) {
  return (
    opts.category === "Main Menu" ||
    /\b(main\s*menu|title\s*screen|start\s*screen|play\s*button|menu\s+background|background\s+menu)\b/i.test(
      opts.prompt,
    )
  );
}

// ---------------- AI gateway pick (mirrors help-chat) ----------------
type GatewayChoice = { gw: (m: string) => any; modelName: string; providerName: string };

function listGateways(): GatewayChoice[] {
  const out: GatewayChoice[] = [];
  // Prefer user-supplied Gemini key first when set (cheapest + user controls quota).
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const gw = createProvider("google", geminiKey);
    out.push({ gw, modelName: "gemini-2.5-flash", providerName: "google" });
    out.push({ gw, modelName: "gemini-2.5-pro", providerName: "google" });
  }
  const neoKey = process.env.NEOKENS_API_KEY || process.env.NEOKENS_KEY;
  if (neoKey) {
    const gw = createProvider("neokens", neoKey);
    out.push({ gw, modelName: "gemini-3-flash", providerName: "neokens" });
    out.push({ gw, modelName: "gpt-5.2", providerName: "neokens" });
  }
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    out.push({ gw: createGroqProvider(groqKey), modelName: BLOXSMITH_THINK_MODEL, providerName: "groq" });
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    const gw = createLovableProvider(lovableKey);
    out.push({ gw, modelName: "google/gemini-3-flash-preview", providerName: "lovable" });
    out.push({ gw, modelName: "openai/gpt-5-mini", providerName: "lovable" });
  }
  return out;
}



function safeInstanceName(value: string | undefined, fallback: string) {
  const cleaned = String(value || fallback)
    .replace(/[^A-Za-z0-9_ ]+/g, " ")
    .trim()
    .replace(/\s+/g, "");
  return cleaned || fallback;
}

function cleanJsonText(text: string) {
  const raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return candidate;
}

function parseJsonObject(text: string) {
  return JSON.parse(cleanJsonText(text));
}

function normalizeElement(el: UIElement, fallbackName: string): UIElement {
  const name = safeInstanceName(el.name || el.id, fallbackName);
  const out: UIElement = {
    ...el,
    id: safeInstanceName(el.id || name, name),
    name,
    children: Array.isArray(el.children)
      ? el.children.slice(0, 40).map((child, idx) => normalizeElement(child, `${name}Child${idx + 1}`))
      : undefined,
  };
  if (out.type === "TextLabel" || out.type === "TextButton") {
    out.textSize ??= 18;
    out.textColor ??= { r: 255, g: 255, b: 255 };
    out.backgroundTransparency ??= out.type === "TextLabel" ? 1 : out.backgroundTransparency;
  }
  return out;
}

function normalizeUISpec(spec: UISpec, opts: { category: UICategory; bgColor?: { r: number; g: number; b: number } }): UISpec {
  const title = spec.title?.trim() || `${opts.category} UI`;
  const screenGuiName = safeInstanceName(spec.screenGuiName, `${safeInstanceName(title, "BloxSmithUI")}Gui`);
  const root = normalizeElement(spec.root, "RootFrame");
  root.type = "Frame";
  root.id ||= "RootFrame";
  root.name ||= "RootFrame";
  root.position ??= { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 };
  root.size ??= { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 };
  root.backgroundColor ??= opts.bgColor ?? { r: 15, g: 23, b: 42 };
  root.backgroundTransparency ??= 0;
  return UISpecSchema.parse({ ...spec, title, screenGuiName, root, mobileFriendly: spec.mobileFriendly ?? true });
}

function buttonTextForCategory(category: UICategory) {
  if (category.includes("Shop")) return ["VIP Pass", "2x Coins", "Starter Pack", "Ultra Bundle"];
  if (category === "Inventory" || category === "Pet Inventory") return ["Equip", "Upgrade", "Favorite", "Delete"];
  if (category === "Trading") return ["Add Item", "Ready", "Accept", "Cancel"];
  if (category === "Daily Rewards") return ["Day 1", "Day 2", "Day 3", "Claim"];
  if (category === "Spin Wheel") return ["Spin", "Lucky Boost", "Rewards", "Close"];
  if (category === "Settings Menu") return ["Music", "SFX", "Graphics", "Controls"];
  if (category === "Admin Panel") return ["Kick", "Ban", "Give Coins", "Teleport"];
  return ["Play", "Shop", "Settings", "Close"];
}

function createFallbackUISpec(opts: {
  category: UICategory;
  style: UIStyle;
  prompt: string;
  primaryColor?: { r: number; g: number; b: number };
  accentColor?: { r: number; g: number; b: number };
  bgColor?: { r: number; g: number; b: number };
  title?: string;
}): UISpec {
  const primary = opts.primaryColor ?? { r: 245, g: 158, b: 11 };
  const accent = opts.accentColor ?? { r: 139, g: 92, b: 246 };
  const bg = opts.bgColor ?? { r: 15, g: 23, b: 42 };
  const title = opts.title?.trim() || `${opts.category}`;
  const screenGuiName = safeInstanceName(`${title}Gui`, "BloxSmithGeneratedGui");
  const buttons = buttonTextForCategory(opts.category);
  const needsRemote = /Shop|Rewards|Spin|Codes|Trading|Admin/.test(opts.category);

  if (wantsMainMenuBackground(opts)) {
    const menuButtons = ["Play", "Settings", "Shop", "Credits"].map((label, idx): UIElement => ({
      type: "TextButton",
      id: `${label}Button`,
      name: `${label}Button`,
      text: label,
      textColor: { r: 255, g: 255, b: 255 },
      textSize: idx === 0 ? 28 : 22,
      font: "GothamBlack",
      size: { xScale: 1, xOffset: 0, yScale: 0, yOffset: idx === 0 ? 76 : 62 },
      backgroundColor: idx === 0 ? primary : { r: 24, g: 34, b: 52 },
      backgroundTransparency: idx === 0 ? 0 : 0.06,
      strokeColor: idx === 0 ? { r: 255, g: 255, b: 255 } : accent,
      strokeThickness: idx === 0 ? 3 : 2,
      cornerRadius: opts.style === "Cartoon" ? 24 : 18,
      gradient:
        opts.style === "Minimal"
          ? undefined
          : { from: idx === 0 ? primary : { r: 30, g: 41, b: 59 }, to: idx === 0 ? accent : bg, rotation: 115 },
      zIndex: 4,
    }));

    const spec: UISpec = {
      title,
      screenGuiName,
      mobileFriendly: true,
      description:
        "Generated main menu with a real full-screen 2D ScreenGui background layer, overlay, title, and animated buttons.",
      root: {
        type: "Frame",
        id: "RootFrame",
        name: "RootFrame",
        position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
        size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
        backgroundColor: bg,
        children: [
          {
            type: "Frame",
            id: "BackgroundLayer",
            name: "BackgroundLayer",
            position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
            size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
            backgroundColor: bg,
            backgroundTransparency: 0,
            gradient: { from: bg, to: { r: Math.max(0, primary.r - 40), g: Math.max(0, primary.g - 35), b: Math.max(0, primary.b - 30) }, rotation: 35 },
            zIndex: 1,
          },
          {
            type: "Frame",
            id: "BackgroundGlowLeft",
            name: "BackgroundGlowLeft",
            position: { xScale: -0.08, xOffset: 0, yScale: 0.12, yOffset: 0 },
            size: { xScale: 0, xOffset: 420, yScale: 0, yOffset: 420 },
            backgroundColor: primary,
            backgroundTransparency: 0.72,
            cornerRadius: 210,
            zIndex: 1,
          },
          {
            type: "Frame",
            id: "BackgroundGlowRight",
            name: "BackgroundGlowRight",
            position: { xScale: 0.72, xOffset: 0, yScale: 0.56, yOffset: 0 },
            size: { xScale: 0, xOffset: 520, yScale: 0, yOffset: 520 },
            backgroundColor: accent,
            backgroundTransparency: 0.76,
            cornerRadius: 260,
            zIndex: 1,
          },
          {
            type: "Frame",
            id: "DarkOverlay",
            name: "DarkOverlay",
            position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
            size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
            backgroundColor: { r: 0, g: 0, b: 0 },
            backgroundTransparency: 0.42,
            zIndex: 2,
          },
          {
            type: "TextLabel",
            id: "TitleLabel",
            name: "TitleLabel",
            text: title,
            textColor: { r: 255, g: 255, b: 255 },
            textSize: 52,
            font: opts.style === "Cartoon" ? "LuckiestGuy" : "GothamBlack",
            position: { xScale: 0.055, xOffset: 0, yScale: 0.12, yOffset: 0 },
            size: { xScale: 0.72, xOffset: 0, yScale: 0, yOffset: 72 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 4,
          },
          {
            type: "TextLabel",
            id: "SubtitleLabel",
            name: "SubtitleLabel",
            text: opts.prompt.slice(0, 74) || "Jump into your Roblox adventure",
            textColor: { r: 226, g: 232, b: 240 },
            textSize: 18,
            font: "GothamBold",
            position: { xScale: 0.06, xOffset: 0, yScale: 0.23, yOffset: 0 },
            size: { xScale: 0.56, xOffset: 0, yScale: 0, yOffset: 38 },
            backgroundTransparency: 1,
            textAlign: "Left",
            zIndex: 4,
          },
          {
            type: "Frame",
            id: "ButtonStack",
            name: "ButtonStack",
            position: { xScale: 0.06, xOffset: 0, yScale: 0.38, yOffset: 0 },
            size: { xScale: 0, xOffset: 360, yScale: 0, yOffset: 330 },
            backgroundColor: { r: 5, g: 8, b: 18 },
            backgroundTransparency: 0.22,
            cornerRadius: 24,
            strokeColor: { r: 255, g: 255, b: 255 },
            strokeThickness: 1.5,
            layout: "List",
            layoutPadding: 14,
            zIndex: 3,
            children: menuButtons,
          },
        ],
      },
      remoteEvents: [],
      localScript: `local TweenService = game:GetService("TweenService")
local gui = script.Parent
local stack = gui:FindFirstChild("ButtonStack", true)
local function wireButton(button)
\tif not button:IsA("TextButton") then return end
\tlocal normalSize = button.Size
\tbutton.MouseEnter:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = normalSize + UDim2.fromOffset(10, 4) }):Play()
\tend)
\tbutton.MouseLeave:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = normalSize }):Play()
\tend)
\tbutton.MouseButton1Click:Connect(function()
\t\tprint("[BloxSmith MainMenu] clicked", button.Name)
\t\tif button.Name == "PlayButton" then gui.Enabled = false end
\tend)
end
for _, item in ipairs(gui:GetDescendants()) do wireButton(item) end
if stack then
\tstack.Position = stack.Position + UDim2.fromOffset(-30, 0)
\tTweenService:Create(stack, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Position = UDim2.fromScale(0.06, 0.38) }):Play()
end`,
    };

    return normalizeUISpec(spec, opts);
  }

  if (opts.category === "Spin Wheel") {
    const rewards = ["500 Coins", "2x Luck", "Rare Pet", "Gems", "Boost", "Jackpot"];
    const rewardBadges: UIElement[] = rewards.map((label, idx) => {
      const positions = [
        { xScale: 0.5, yScale: 0.1 },
        { xScale: 0.78, yScale: 0.25 },
        { xScale: 0.78, yScale: 0.67 },
        { xScale: 0.5, yScale: 0.84 },
        { xScale: 0.22, yScale: 0.67 },
        { xScale: 0.22, yScale: 0.25 },
      ];
      const pos = positions[idx] ?? positions[0];
      return {
        type: "TextLabel",
        id: `RewardBadge${idx + 1}`,
        name: `RewardBadge${idx + 1}`,
        text: label,
        textColor: { r: 255, g: 255, b: 255 },
        textSize: 16,
        font: "GothamBold",
        anchorPoint: { x: 0.5, y: 0.5 },
        position: { xScale: pos.xScale, xOffset: 0, yScale: pos.yScale, yOffset: 0 },
        size: { xScale: 0, xOffset: 124, yScale: 0, yOffset: 40 },
        backgroundColor: idx % 2 === 0 ? { r: 255, g: 255, b: 255 } : { r: 17, g: 24, b: 39 },
        backgroundTransparency: idx % 2 === 0 ? 0.82 : 0.12,
        strokeColor: { r: 255, g: 255, b: 255 },
        strokeThickness: 1.5,
        cornerRadius: 20,
      };
    });

    const spec: UISpec = {
      title,
      screenGuiName,
      mobileFriendly: true,
      description: `Generated ${opts.style} Spin Wheel UI with server-validated reward request.`,
      root: {
        type: "Frame",
        id: "RootFrame",
        name: "RootFrame",
        position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
        size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
        backgroundColor: bg,
        children: [
          {
            type: "Frame",
            id: "MainPanel",
            name: "MainPanel",
            anchorPoint: { x: 0.5, y: 0.5 },
            position: { xScale: 0.5, xOffset: 0, yScale: 0.5, yOffset: 0 },
            size: { xScale: 0.76, xOffset: 0, yScale: 0.76, yOffset: 0 },
            backgroundColor: { r: 10, g: 14, b: 24 },
            backgroundTransparency: opts.style === "Glass" ? 0.16 : 0,
            cornerRadius: opts.style === "Cartoon" ? 30 : 20,
            strokeColor: accent,
            strokeThickness: opts.style === "Neon" ? 3 : 1.5,
            gradient: opts.style === "Minimal" ? undefined : { from: bg, to: { r: 17, g: 24, b: 39 }, rotation: 135 },
            children: [
              {
                type: "TextLabel",
                id: "TitleLabel",
                name: "TitleLabel",
                text: title,
                textColor: { r: 255, g: 255, b: 255 },
                textSize: 34,
                font: "GothamBlack",
                position: { xScale: 0.06, xOffset: 0, yScale: 0.06, yOffset: 0 },
                size: { xScale: 0.72, xOffset: 0, yScale: 0, yOffset: 52 },
                backgroundTransparency: 1,
                textAlign: "Left",
              },
              {
                type: "TextButton",
                id: "CloseButton",
                name: "CloseButton",
                text: "X",
                textColor: { r: 255, g: 255, b: 255 },
                textSize: 20,
                font: "GothamBold",
                position: { xScale: 0.92, xOffset: 0, yScale: 0.06, yOffset: 0 },
                size: { xScale: 0, xOffset: 48, yScale: 0, yOffset: 48 },
                backgroundColor: { r: 31, g: 41, b: 55 },
                backgroundTransparency: 0.1,
                cornerRadius: 14,
              },
              {
                type: "Frame",
                id: "WheelGlow",
                name: "WheelGlow",
                anchorPoint: { x: 0.5, y: 0.5 },
                position: { xScale: 0.38, xOffset: 0, yScale: 0.54, yOffset: 0 },
                size: { xScale: 0, xOffset: 456, yScale: 0, yOffset: 456 },
                backgroundColor: primary,
                backgroundTransparency: 0.78,
                cornerRadius: 228,
                strokeColor: accent,
                strokeThickness: 2,
              },
              {
                type: "Frame",
                id: "WheelRing",
                name: "WheelRing",
                anchorPoint: { x: 0.5, y: 0.5 },
                position: { xScale: 0.38, xOffset: 0, yScale: 0.54, yOffset: 0 },
                size: { xScale: 0, xOffset: 420, yScale: 0, yOffset: 420 },
                backgroundColor: { r: 18, g: 24, b: 38 },
                cornerRadius: 210,
                strokeColor: primary,
                strokeThickness: 7,
                gradient: { from: primary, to: accent, rotation: 45 },
                children: [
                  ...rewardBadges,
                  {
                    type: "TextLabel",
                    id: "Pointer",
                    name: "Pointer",
                    text: "WIN",
                    textColor: { r: 12, g: 18, b: 28 },
                    textSize: 18,
                    font: "GothamBlack",
                    anchorPoint: { x: 0.5, y: 0.5 },
                    position: { xScale: 0.5, xOffset: 0, yScale: 0.5, yOffset: 0 },
                    size: { xScale: 0, xOffset: 118, yScale: 0, yOffset: 118 },
                    backgroundColor: { r: 255, g: 255, b: 255 },
                    backgroundTransparency: 0.08,
                    strokeColor: primary,
                    strokeThickness: 5,
                    cornerRadius: 59,
                  },
                ],
              },
              {
                type: "TextLabel",
                id: "WheelMarker",
                name: "WheelMarker",
                text: "V",
                textColor: primary,
                textSize: 32,
                font: "GothamBlack",
                anchorPoint: { x: 0.5, y: 0.5 },
                position: { xScale: 0.38, xOffset: 0, yScale: 0.24, yOffset: 0 },
                size: { xScale: 0, xOffset: 48, yScale: 0, yOffset: 42 },
                backgroundTransparency: 1,
              },
              {
                type: "Frame",
                id: "RewardPanel",
                name: "RewardPanel",
                position: { xScale: 0.65, xOffset: 0, yScale: 0.25, yOffset: 0 },
                size: { xScale: 0.28, xOffset: 0, yScale: 0.42, yOffset: 0 },
                backgroundColor: { r: 15, g: 23, b: 42 },
                backgroundTransparency: 0.08,
                cornerRadius: 16,
                strokeColor: { r: 71, g: 85, b: 105 },
                strokeThickness: 1,
                layout: "List",
                layoutPadding: 10,
                children: rewards.slice(0, 4).map((label, idx) => ({
                  type: "TextLabel",
                  id: `PrizeRow${idx + 1}`,
                  name: `PrizeRow${idx + 1}`,
                  text: `${idx + 1}. ${label}`,
                  textColor: { r: 226, g: 232, b: 240 },
                  textSize: 15,
                  font: "GothamBold",
                  backgroundColor: { r: 30, g: 41, b: 59 },
                  backgroundTransparency: 0.12,
                  cornerRadius: 10,
                  textAlign: "Left",
                })),
              },
              {
                type: "TextButton",
                id: "SpinButton",
                name: "SpinButton",
                text: "SPIN NOW",
                textColor: { r: 255, g: 255, b: 255 },
                textSize: 22,
                font: "GothamBlack",
                anchorPoint: { x: 0.5, y: 0.5 },
                position: { xScale: 0.79, xOffset: 0, yScale: 0.79, yOffset: 0 },
                size: { xScale: 0.28, xOffset: 0, yScale: 0, yOffset: 64 },
                backgroundColor: primary,
                strokeColor: accent,
                strokeThickness: 3,
                cornerRadius: 18,
              },
            ],
          },
        ],
      },
      remoteEvents: [`${screenGuiName}Request`],
      localScript: `local gui = script.Parent\nlocal close = gui:FindFirstChild("CloseButton", true)\nlocal spin = gui:FindFirstChild("SpinButton", true)\nif close and close:IsA("TextButton") then\n\tclose.MouseButton1Click:Connect(function()\n\t\tgui.Enabled = false\n\tend)\nend\nif spin and spin:IsA("TextButton") then\n\tspin.MouseButton1Click:Connect(function()\n\t\tprint("BloxSmith spin requested")\n\tend)\nend`,
      serverScript: `local ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal remote = ReplicatedStorage:FindFirstChild("${screenGuiName}Request") or Instance.new("RemoteEvent")\nremote.Name = "${screenGuiName}Request"\nremote.Parent = ReplicatedStorage\nremote.OnServerEvent:Connect(function(player)\n\tprint("BloxSmith Spin Wheel request", player.Name)\n\t-- Validate cooldowns and grant rewards here.\nend)`,
    };

    return normalizeUISpec(spec, opts);
  }

  const cardChildren: UIElement[] = buttons.map((label, idx) => ({
    type: "TextButton",
    id: `ActionButton${idx + 1}`,
    name: `ActionButton${idx + 1}`,
    text: label,
    textColor: { r: 255, g: 255, b: 255 },
    textSize: 17,
    font: "GothamBold",
    backgroundColor: idx === 0 ? primary : { r: 20, g: 28, b: 44 },
    strokeColor: idx === 0 ? accent : { r: 96, g: 116, b: 148 },
    strokeThickness: idx === 0 ? 2 : 1.5,
    cornerRadius: opts.style === "Cartoon" ? 22 : 16,
    gradient:
      opts.style === "Minimal"
        ? undefined
        : {
            from: idx % 2 === 0 ? primary : { r: 30, g: 41, b: 59 },
            to: idx % 2 === 0 ? accent : { r: 15, g: 23, b: 42 },
            rotation: 135,
          },
  }));

  const spec: UISpec = {
    title,
    screenGuiName,
    mobileFriendly: true,
    description: `Generated ${opts.style} ${opts.category} UI by BloxSmith.`,
    root: {
      type: "Frame",
      id: "RootFrame",
      name: "RootFrame",
      position: { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 },
      size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 },
      backgroundColor: bg,
      children: [
        {
          type: "Frame",
          id: "MainPanel",
          name: "MainPanel",
          anchorPoint: { x: 0.5, y: 0.5 },
          position: { xScale: 0.5, xOffset: 0, yScale: 0.5, yOffset: 0 },
          size: { xScale: 0.56, xOffset: 0, yScale: 0.66, yOffset: 0 },
          backgroundColor: { r: 10, g: 14, b: 24 },
          backgroundTransparency: opts.style === "Glass" ? 0.18 : 0,
          cornerRadius: opts.style === "Cartoon" ? 32 : 22,
          strokeColor: accent,
          strokeThickness: opts.style === "Neon" ? 3 : 2,
          gradient: opts.style === "Minimal" ? undefined : { from: bg, to: { r: 18, g: 24, b: 38 }, rotation: 135 },
          children: [
            {
              type: "Frame",
              id: "HeaderGlow",
              name: "HeaderGlow",
              position: { xScale: 0.04, xOffset: 0, yScale: 0.04, yOffset: 0 },
              size: { xScale: 0.92, xOffset: 0, yScale: 0, yOffset: 78 },
              backgroundColor: primary,
              backgroundTransparency: 0.78,
              cornerRadius: 18,
              strokeColor: accent,
              strokeThickness: 1,
            },
            {
              type: "TextLabel",
              id: "TitleLabel",
              name: "TitleLabel",
              text: title,
              textColor: { r: 255, g: 255, b: 255 },
              textSize: 32,
              font: "GothamBlack",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.06, yOffset: 0 },
              size: { xScale: 0.72, xOffset: 0, yScale: 0, yOffset: 50 },
              backgroundTransparency: 1,
              textAlign: "Left",
            },
            {
              type: "TextLabel",
              id: "StatusBadge",
              name: "StatusBadge",
              text: "BLOXSMITH",
              textColor: { r: 255, g: 255, b: 255 },
              textSize: 12,
              font: "GothamBlack",
              position: { xScale: 0.72, xOffset: 0, yScale: 0.075, yOffset: 0 },
              size: { xScale: 0.16, xOffset: 0, yScale: 0, yOffset: 34 },
              backgroundColor: accent,
              cornerRadius: 14,
              strokeColor: { r: 255, g: 255, b: 255 },
              strokeThickness: 1,
            },
            {
              type: "TextLabel",
              id: "SubtitleLabel",
              name: "SubtitleLabel",
              text: opts.prompt.slice(0, 90) || `Premium Roblox ${opts.category} UI`,
              textColor: { r: 203, g: 213, b: 225 },
              textSize: 16,
              font: "Gotham",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.16, yOffset: 0 },
              size: { xScale: 0.72, xOffset: 0, yScale: 0, yOffset: 30 },
              backgroundTransparency: 1,
              textAlign: "Left",
            },
            {
              type: "TextButton",
              id: "CloseButton",
              name: "CloseButton",
              text: "X",
              textColor: { r: 255, g: 255, b: 255 },
              textSize: 24,
              font: "GothamBold",
              position: { xScale: 0.88, xOffset: 0, yScale: 0.06, yOffset: 0 },
              size: { xScale: 0, xOffset: 42, yScale: 0, yOffset: 42 },
              backgroundColor: { r: 51, g: 65, b: 85 },
              cornerRadius: 12,
            },
            {
              type: "Frame",
              id: "ContentGrid",
              name: "ContentGrid",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.28, yOffset: 0 },
              size: { xScale: 0.88, xOffset: 0, yScale: 0.5, yOffset: 0 },
              backgroundColor: { r: 15, g: 23, b: 42 },
              backgroundTransparency: 0.16,
              cornerRadius: 18,
              strokeColor: { r: 71, g: 85, b: 105 },
              strokeThickness: 1,
              layout: "Grid",
              layoutPadding: 14,
              cellSize: { xScale: 0, xOffset: 180, yScale: 0, yOffset: 92 },
              children: cardChildren,
            },
            {
              type: "TextButton",
              id: "PrimaryCTA",
              name: "PrimaryCTA",
              text: opts.category.includes("Shop") ? "Purchase Selected" : "Confirm",
              textColor: { r: 255, g: 255, b: 255 },
              textSize: 20,
              font: "GothamBold",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.82, yOffset: 0 },
              size: { xScale: 0.88, xOffset: 0, yScale: 0, yOffset: 58 },
              backgroundColor: primary,
              strokeColor: accent,
              strokeThickness: 2,
              cornerRadius: 18,
              gradient: opts.style === "Minimal" ? undefined : { from: primary, to: accent, rotation: 90 },
            },
            {
              type: "TextLabel",
              id: "FooterNote",
              name: "FooterNote",
              text: needsRemote ? "Server validated rewards and purchases" : "Responsive Roblox ScreenGui layout",
              textColor: { r: 148, g: 163, b: 184 },
              textSize: 13,
              font: "Gotham",
              position: { xScale: 0.06, xOffset: 0, yScale: 0.93, yOffset: 0 },
              size: { xScale: 0.88, xOffset: 0, yScale: 0, yOffset: 24 },
              backgroundTransparency: 1,
            },
          ],
        },
      ],
    },
    remoteEvents: needsRemote ? [`${screenGuiName}Request`] : [],
    localScript: `local gui = script.Parent\nlocal panel = gui:FindFirstChild("RootFrame", true)\nlocal close = gui:FindFirstChild("CloseButton", true)\nif close and close:IsA("TextButton") then\n\tclose.MouseButton1Click:Connect(function()\n\t\tgui.Enabled = false\n\tend)\nend\nfor _, btn in ipairs(gui:GetDescendants()) do\n\tif btn:IsA("TextButton") and btn.Name ~= "CloseButton" then\n\t\tbtn.MouseButton1Click:Connect(function()\n\t\t\tprint("BloxSmith UI button clicked:", btn.Name)\n\t\tend)\n\tend\nend`,
    serverScript: needsRemote ? `local ReplicatedStorage = game:GetService("ReplicatedStorage")\nlocal remote = ReplicatedStorage:FindFirstChild("${screenGuiName}Request") or Instance.new("RemoteEvent")\nremote.Name = "${screenGuiName}Request"\nremote.Parent = ReplicatedStorage\nremote.OnServerEvent:Connect(function(player, action)\n\tprint("BloxSmith UI request", player.Name, action)\n\t-- TODO: validate purchases/rewards on the server before granting anything.\nend)` : undefined,
  };

  return normalizeUISpec(spec, opts);
}

async function tryGeneratePlainJson(gateway: GatewayChoice, userPrompt: string): Promise<UISpec> {
  const { text } = await generateText({
    model: gateway.gw(gateway.modelName) as any,
    system: `${UI_SYSTEM_PROMPT}\n\nReturn ONLY parseable JSON. Do not wrap it in markdown.`,
    prompt: userPrompt,
    maxOutputTokens: UI_AI_OUTPUT_TOKENS,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(UI_AI_TIMEOUT_MS),
  });
  if (!text?.trim()) throw new Error("No text returned by provider.");
  return UISpecSchema.parse(parseJsonObject(text));
}

// ---------------- Generate ----------------
export async function generateUISpec(opts: {
  category: UICategory;
  style: UIStyle;
  prompt: string;
  primaryColor?: { r: number; g: number; b: number };
  accentColor?: { r: number; g: number; b: number };
  bgColor?: { r: number; g: number; b: number };
  title?: string;
}): Promise<UISpec> {
  const instantSpec = createFallbackUISpec(opts);
  const gateways = listGateways();
  if (gateways.length === 0) {
    console.warn("[ui-gen] no AI provider configured; using deterministic fallback UI");
    return instantSpec;
  }

  const styleHint = STYLE_HINTS[opts.style];
  const palette = [
    opts.primaryColor ? `Primary RGB(${opts.primaryColor.r},${opts.primaryColor.g},${opts.primaryColor.b})` : null,
    opts.accentColor ? `Accent  RGB(${opts.accentColor.r},${opts.accentColor.g},${opts.accentColor.b})` : null,
    opts.bgColor ? `Background RGB(${opts.bgColor.r},${opts.bgColor.g},${opts.bgColor.b})` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "use a tasteful palette appropriate to the category";

  const userPrompt = `Category: ${opts.category}
Style: ${opts.style} — ${styleHint}
Palette: ${palette}
${opts.title ? `Preferred title text: "${opts.title}"\n` : ""}User request:
${opts.prompt}

Produce a polished, fully populated UISpec for this Roblox UI. Include working LocalScript and (where it makes sense) a ServerScript with RemoteEvents for purchase/reward validation. Keep the hierarchy concise and complete.
${wantsMainMenuBackground(opts) ? "Main menu background requirement: create the background as ScreenGui children only. Use BackgroundLayer/BackgroundImage plus overlay behind the buttons; do not create or imply Workspace parts, 3D blocks, terrain, or camera-selected objects." : ""}`;

  let lastErr: any = null;
  for (const gateway of gateways.slice(0, 2)) {
    try {
      const spec = await tryGeneratePlainJson(gateway, userPrompt);
      return normalizeUISpec(spec, opts);
    } catch (err: any) {
      lastErr = err;
      console.warn(`[ui-gen] ${gateway.providerName}/${gateway.modelName} JSON output failed; trying deterministic fallback:`, err?.message || err);
    }
  }

  console.warn("[ui-gen] providers were slow/empty; returning deterministic UI:", lastErr?.message || lastErr);
  return instantSpec;
}

// ---------------- Spec -> plugin actions + files ----------------
// Converts the spec into the action protocol the BloxSmith plugin already
// understands (see src/routes/execute.ts). Each Instance becomes a `create`
// action with properties translated into the plugin's serialized types.

type PluginAction = { type: string; [k: string]: any };
type GenFile = {
  path: string;
  file_type: "Script" | "LocalScript" | "ModuleScript";
  service_location: "ServerScriptService" | "ReplicatedStorage" | "StarterGui";
  content: string;
};

function udim2(u?: { xScale: number; xOffset: number; yScale: number; yOffset: number }) {
  if (!u) return undefined;
  return {
    __t: "UDim2",
    xs: u.xScale,
    xo: u.xOffset,
    ys: u.yScale,
    yo: u.yOffset,
    // Back-compat for any newer plugin/client readers that use explicit names.
    xScale: u.xScale,
    xOffset: u.xOffset,
    yScale: u.yScale,
    yOffset: u.yOffset,
  };
}
function color3(c?: { r: number; g: number; b: number }) {
  if (!c) return undefined;
  return { __t: "Color3", r: c.r, g: c.g, b: c.b };
}

function propsForElement(el: UIElement) {
  const props: Record<string, unknown> = {};
  if (el.size) props.Size = udim2(el.size);
  if (el.position) props.Position = udim2(el.position);
  if (el.anchorPoint) props.AnchorPoint = { __t: "Vector2", x: el.anchorPoint.x, y: el.anchorPoint.y };
  if (el.backgroundColor) props.BackgroundColor3 = color3(el.backgroundColor);
  if (typeof el.backgroundTransparency === "number") props.BackgroundTransparency = el.backgroundTransparency;
  if (typeof el.zIndex === "number") props.ZIndex = el.zIndex;

  if (el.type === "TextLabel" || el.type === "TextButton") {
    if (el.text != null) props.Text = el.text;
    if (el.textColor) props.TextColor3 = color3(el.textColor);
    if (el.textSize) props.TextSize = el.textSize;
    if (el.font) props.Font = { __t: "Enum", enum: "Font", value: el.font };
    if (el.textAlign) props.TextXAlignment = { __t: "Enum", enum: "TextXAlignment", value: el.textAlign };
  }
  if (el.type === "ImageButton" || el.type === "ImageLabel") {
    if (el.image) {
      const img = /^\d+$/.test(el.image) ? `rbxassetid://${el.image}` : el.image;
      props.Image = img;
    }
  }
  return props;
}

function pushElement(
  el: UIElement,
  parentPath: string,
  actions: PluginAction[],
) {
  const className =
    el.type === "Frame"
      ? "Frame"
      : el.type === "TextLabel"
        ? "TextLabel"
        : el.type === "TextButton"
          ? "TextButton"
          : el.type === "ImageButton"
            ? "ImageButton"
            : el.type === "ImageLabel"
              ? "ImageLabel"
              : "ScrollingFrame";

  actions.push({
    type: "create",
    className,
    name: el.name,
    parent: parentPath,
    properties: propsForElement(el),
  });

  const myPath = `${parentPath}.${el.name}`;

  if (el.cornerRadius && el.cornerRadius > 0) {
    actions.push({
      type: "create",
      className: "UICorner",
      name: "UICorner",
      parent: myPath,
      properties: { CornerRadius: { __t: "UDim", s: 0, o: el.cornerRadius } },
    });
  }
  if (el.strokeColor && el.strokeThickness) {
    actions.push({
      type: "create",
      className: "UIStroke",
      name: "UIStroke",
      parent: myPath,
      properties: {
        Color: color3(el.strokeColor),
        Thickness: el.strokeThickness,
      },
    });
  }
  if (el.gradient) {
    actions.push({
      type: "create",
      className: "UIGradient",
      name: "UIGradient",
      parent: myPath,
      properties: {
        Rotation: el.gradient.rotation,
        Color: {
          __t: "ColorSequence",
          stops: [
            { time: 0, color: color3(el.gradient.from) },
            { time: 1, color: color3(el.gradient.to) },
          ],
        },
      },
    });
  }
  if (el.layout === "List") {
    actions.push({
      type: "create",
      className: "UIListLayout",
      name: "UIListLayout",
      parent: myPath,
      properties: {
        FillDirection: {
          __t: "Enum",
          enum: "FillDirection",
          value: el.layoutDirection === "Horizontal" ? "Horizontal" : "Vertical",
        },
        Padding: { __t: "UDim", scale: 0, offset: el.layoutPadding ?? 8 },
        SortOrder: { __t: "Enum", enum: "SortOrder", value: "LayoutOrder" },
      },
    });
  } else if (el.layout === "Grid") {
    actions.push({
      type: "create",
      className: "UIGridLayout",
      name: "UIGridLayout",
      parent: myPath,
      properties: {
        CellSize: udim2(el.cellSize ?? { xScale: 0, xOffset: 120, yScale: 0, yOffset: 120 }),
        CellPadding: udim2({ xScale: 0, xOffset: el.layoutPadding ?? 8, yScale: 0, yOffset: el.layoutPadding ?? 8 }),
        SortOrder: { __t: "Enum", enum: "SortOrder", value: "LayoutOrder" },
      },
    });
  }

  for (const child of el.children ?? []) pushElement(child, myPath, actions);
}

export function specToPluginPayload(spec: UISpec): { actions: PluginAction[]; files: GenFile[] } {
  const actions: PluginAction[] = [];
  const files: GenFile[] = [];

  // 1. ScreenGui under StarterGui
  actions.push({
    type: "create",
    className: "ScreenGui",
    name: spec.screenGuiName,
    parent: "StarterGui",
    properties: {
      ResetOnSpawn: false,
      IgnoreGuiInset: true,
      ZIndexBehavior: { __t: "Enum", enum: "ZIndexBehavior", value: "Sibling" },
    },
  });

  // 2. Walk the tree
  pushElement(spec.root, `StarterGui.${spec.screenGuiName}`, actions);

  // 3. RemoteEvents
  for (const re of spec.remoteEvents ?? []) {
    actions.push({
      type: "create",
      className: "RemoteEvent",
      name: re,
      parent: "ReplicatedStorage",
    });
  }

  // 4. LocalScript inside the ScreenGui
  if (spec.localScript && spec.localScript.trim()) {
    files.push({
      path: `StarterGui/${spec.screenGuiName}/UIController`,
      file_type: "LocalScript",
      service_location: "StarterGui",
      content: spec.localScript,
    });
    actions.push({
      type: "create",
      className: "LocalScript",
      name: "UIController",
      parent: `StarterGui.${spec.screenGuiName}`,
      properties: { Source: spec.localScript },
    });
  }

  // 5. ServerScript
  if (spec.serverScript && spec.serverScript.trim()) {
    files.push({
      path: `ServerScriptService/${spec.screenGuiName}Server`,
      file_type: "Script",
      service_location: "ServerScriptService",
      content: spec.serverScript,
    });
    actions.push({
      type: "create",
      className: "Script",
      name: `${spec.screenGuiName}Server`,
      parent: "ServerScriptService",
      properties: { Source: spec.serverScript },
    });
  }

  return { actions, files };
}

// Pretty Luau export (concatenated) for the Code tab.
export function specToLuauPreview(spec: UISpec): string {
  const parts: string[] = [];
  parts.push(`-- ${spec.title}\n-- ScreenGui: ${spec.screenGuiName}\n-- Place ScreenGui under StarterGui.`);
  if (spec.remoteEvents?.length) {
    parts.push(
      `\n-- RemoteEvents (ReplicatedStorage):\n` +
        spec.remoteEvents.map((r) => `--   ${r}`).join("\n"),
    );
  }
  if (spec.localScript) parts.push(`\n-- LocalScript (inside ScreenGui):\n${spec.localScript}`);
  if (spec.serverScript) parts.push(`\n-- ServerScript (ServerScriptService):\n${spec.serverScript}`);
  return parts.join("\n");
}

// UI Generator: AI-driven Roblox ScreenGui spec generation + plugin action conversion.
// Server-only.
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { createProvider } from "@/lib/ai-providers.server";
import {
  createGroqProvider,
  BLOXSMITH_THINK_MODEL,
} from "@/lib/ai-gateway.server";

function createLovableProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
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
  cornerRadius: z.number().int().min(0).max(64).optional(),
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

// Use z.lazy for recursion — Output.object handles it
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
- Buttons: cornerRadius 8-14, strokeThickness 1-2, hover-friendly sizes (min 40px height).
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
    out.push({ gw, modelName: "gpt-5.5", providerName: "neokens" });
    out.push({ gw, modelName: "gemini-3-flash", providerName: "neokens" });
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
  const gateways = listGateways();
  if (gateways.length === 0) throw new Error("AI provider not configured. Contact support.");

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

Produce a polished, fully populated UISpec for this Roblox UI. Include working LocalScript and (where it makes sense) a ServerScript with RemoteEvents for purchase/reward validation. Be specific and complete.`;

  let lastErr: any = null;
  for (const gateway of gateways) {
    try {
      const { output } = await generateText({
        model: gateway.gw(gateway.modelName) as any,
        system: UI_SYSTEM_PROMPT,
        prompt: userPrompt,
        output: Output.object({ schema: UISpecSchema as any }),
        maxOutputTokens: 6000,
        temperature: 0.6,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(90_000),
      });
      return UISpecSchema.parse(output);
    } catch (err: any) {
      lastErr = err;
      console.warn(`[ui-gen] ${gateway.providerName}/${gateway.modelName} failed:`, err?.message || err);
      continue;
    }
  }
  throw new Error(lastErr?.message || "UI generation failed across all providers.");
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
  return { __t: "UDim2", xScale: u.xScale, xOffset: u.xOffset, yScale: u.yScale, yOffset: u.yOffset };
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
      properties: { CornerRadius: { __t: "UDim", scale: 0, offset: el.cornerRadius } },
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

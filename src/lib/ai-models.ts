export type SiteProviderId = "neokens" | "comet";

export const SITE_PROVIDER_LABELS: Record<SiteProviderId, string> = {
  neokens: "Neokens (free)",
  comet: "BloxSmith AI",
};

export const SITE_PROVIDER_MODELS: Record<SiteProviderId, string[]> = {
  neokens: [
    // Recommended defaults first: fast + currently valid ids.
    "gemini-3-flash",
    "gpt-5.2",
    "gpt-5.2-codex",
    "gpt-5.1",
    "gpt-5.1-codex",
    "gpt-5.1-codex-max",
    "gemini-3.1-pro",
    // Claude
    "claude-opus-4-7-thinking",
    "claude-opus-4-6-thinking",
    "claude-sonnet-4-7-thinking",
    "claude-sonnet-4-6-thinking",
    "claude-haiku-4-5-20251001",
  ],
  comet: [
    // Budget-first defaults to protect the shared site key.
    "gpt-5.4-nano",
    "deepseek-v4-flash",
    "minimax-m2.7",
    "qwen3.6-plus",
    "gpt-5.4-mini",
    "qwen3.7-max",
    "gemini-3-flash",
    "gemini-3.5-flash",
    "gemini-3.1-pro",
    "grok-4.3",
    "deepseek-v4-pro",
    // Premium picks are available, but intentionally later in the list.
    "claude-haiku-4-5",
    "claude-sonnet-4-6-thinking",
    "claude-opus-4-7-thinking",
    "claude-opus-4-8-thinking",
  ],
};

export const SITE_PROVIDER_DEFAULT_MODEL: Record<SiteProviderId, string> = {
  neokens: "gemini-3-flash",
  comet: "gpt-5.4-nano",
};

export const SITE_MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-5.4-nano":
    "Cheapest BloxSmith AI model for quick chat, tiny Roblox edits, short bug fixes, prompt cleanup, and simple UI copy. Best when users need fast help without burning many credits.",
  "deepseek-v4-flash":
    "Budget coding workhorse for Roblox/Luau. Strong for RemoteEvents, leaderstats, shops, tycoon loops, compact ModuleScripts, and fixing common Studio errors.",
  "minimax-m2.7":
    "Cheap long-context builder for bigger Roblox prompts. Good for reading more project context, planning several scripts at once, and keeping output fast.",
  "qwen3.6-plus":
    "Low-cost structured coding model. Good for clean Luau formatting, JSON-style build outputs, admin commands, small combat systems, and precise edits.",
  "gpt-5.4-mini":
    "Balanced BloxSmith AI model for medium Roblox systems with better reasoning than nano while staying budget-friendly. Good default for most users.",
  "qwen3.7-max":
    "Smart mid-price model for larger Roblox scripts, UI logic, economy balancing, and refactors where clean structure matters.",
  "gemini-3.5-flash":
    "Latest fast Gemini option in the BloxSmith AI pool. Good for grounded answers, visual/screenshot-style reasoning, long project context, and quick build planning.",
  "grok-4.3":
    "Creative reasoning model for Roblox game ideas, mechanics, naming, quests, monetization concepts, and agentic tool-use style tasks.",
  "deepseek-v4-pro":
    "Higher-quality DeepSeek option for harder Roblox coding, multi-file systems, deeper debugging, and larger architecture decisions.",
  "claude-haiku-4-5":
    "Cheap Claude-style cleanup model for careful refactors, readable Luau explanations, script tidying, and comments.",
  "claude-opus-4-7-thinking":
    "Highest-depth Claude reasoning with adaptive thinking. Best for very large Roblox systems, deep debugging, architecture decisions, and hard multi-file builds. What it does for your game: plans entire game architectures, designs anti-exploit, ProfileService data, and complex combat systems end-to-end.",
  "claude-opus-4-8-thinking":
    "Very expensive deepest-reasoning model for rare, difficult builds only: full game architecture, severe bugs, security-sensitive economy/DataStore work, and large multi-system rewrites. Normal users are capped tightly so it cannot drain the shared balance.",
  "claude-opus-4-6-thinking":
    "Previous-gen Opus with deep reasoning. Best for large multi-system builds and tough debugging when you want maximum care. What it does for your game: architects full games, designs save systems, and untangles complex script bugs.",
  "claude-sonnet-4-7-thinking":
    "Newest Sonnet with adaptive thinking — fast frontier reasoning. Best for full-game architecture, anti-exploit, and hard debugging at a lower cost than Opus. What it does for your game: builds simulators/tycoons with leaderstats, gamepasses, and DataStore saves.",
  "claude-sonnet-4-6-thinking":
    "Frontier reasoning with adaptive thinking. Best for full-game architecture, complex anti-exploit, and hard debugging where it should slow down and think first. What it does for your game: builds full simulators/tycoons with leaderstats, gamepasses, and DataStore saves.",
  "claude-haiku-4-5-20251001":
    "Cheap and careful for cleaning messy Luau, refactoring scripts, and writing tidy ModuleScripts. What it does for your game: tidies up existing scripts, renames variables, adds comments, and splits monolith scripts into ModuleScripts.",
  "gpt-5.2":
    "OpenAI flagship for general Roblox building and refactors. What it does for your game: handles full systems, UI, and scripts with solid all-round quality.",
  "gpt-5.2-codex":
    "Code-tuned 5.2 for heavier Luau work. What it does for your game: long ModuleScripts, OOP class systems, and math-heavy gameplay code.",
  "gpt-5.1":
    "Reliable general-purpose model for everyday builds and edits. What it does for your game: scripts, GUIs, RemoteEvents, and mid-size systems.",
  "gpt-5.1-codex":
    "Code-focused 5.1 for clean Luau and refactors. What it does for your game: ModuleScripts, tools, and tidy gameplay logic.",
  "gpt-5.1-codex-max":
    "Largest 5.1 code model for the most demanding Luau builds. What it does for your game: big multi-file systems, complex combat, and large refactors in one pass.",
  "gemini-3.1-pro":
    "Google's top reasoning model — large context, great for whole-project understanding and big builds. What it does for your game: reasons over your entire place, plans large systems, and handles long multi-file generations.",
  "gemini-3-flash":
    "Fast all-rounder for everyday Roblox scripting: GUIs, RemoteEvents, and small gameplay edits. Cheap and quick. What it does for your game: edits ScreenGuis, adds buttons, wires RemoteEvents, and ships small tweaks in seconds.",
};

// ─────────────────────────────────────────────────────────────────────────
// Credit cost multipliers per model.
//
// Higher-tier models cost more credits per generation. Base credit cost
// (chat=1, plan=1, fix=2, generate=3, autopilot=10) is multiplied by this
// number and rounded up. Owners/admins always pay 0. UI shows this badge
// next to each model so users can pick by budget.
// ─────────────────────────────────────────────────────────────────────────
export const MODEL_CREDIT_MULTIPLIERS: Record<string, number> = {
  // BloxSmith AI budget models
  "gpt-5.4-nano": 0.35,
  "deepseek-v4-flash": 0.5,
  "minimax-m2.7": 0.65,
  "qwen3.6-plus": 0.75,
  "gpt-5.4-mini": 0.8,
  "qwen3.7-max": 1.5,
  "gemini-3.5-flash": 2,
  "grok-4.3": 2,
  "deepseek-v4-pro": 2.5,
  "claude-haiku-4-5": 1,
  // Claude
  "claude-opus-4-8-thinking": 20,
  "claude-opus-4-7-thinking": 7,
  "claude-opus-4-6-thinking": 5,
  "claude-sonnet-4-7-thinking": 3,
  "claude-sonnet-4-6-thinking": 3,
  "claude-haiku-4-5-20251001": 1,
  // GPT
  "gpt-5.2": 2,
  "gpt-5.2-codex": 2,
  "gpt-5.1": 1,
  "gpt-5.1-codex": 1,
  "gpt-5.1-codex-max": 2,
  // Gemini
  "gemini-3.1-pro": 2,
  "gemini-3-flash": 1,
};

export const DEFAULT_MODEL_CREDIT_MULTIPLIER = 1;

/**
 * Look up the credit-cost multiplier for a UI model id. Falls back to 1x
 * for unknown models so a new id never accidentally over-charges the user.
 * Also handles the "-thinking" alias by stripping the suffix.
 */
export function getModelCreditMultiplier(modelName: string | null | undefined): number {
  if (!modelName) return DEFAULT_MODEL_CREDIT_MULTIPLIER;
  const direct = MODEL_CREDIT_MULTIPLIERS[modelName];
  if (typeof direct === "number") return direct;
  if (modelName.endsWith("-thinking")) {
    const base = modelName.slice(0, -"-thinking".length);
    const m = MODEL_CREDIT_MULTIPLIERS[base];
    if (typeof m === "number") return m;
  }
  return DEFAULT_MODEL_CREDIT_MULTIPLIER;
}

/**
 * Apply the multiplier to a base credit cost. Rounds up so partial credits
 * always favor the platform (a 0.5x model still costs at least 1 credit).
 */
export function applyModelCreditMultiplier(baseCost: number, modelName: string | null | undefined) {
  const mult = getModelCreditMultiplier(modelName);
  return Math.max(1, Math.ceil(baseCost * mult));
}

// ─────────────────────────────────────────────────────────────────────────
// Neokens model mapping.
//
// The UI model id (the key) is what the picker shows and stores. The value is
// the EXACT model id Neokens accepts at api.quatarly.cloud, plus whether this
// UI id implies "thinking" mode.
//
// ⚠️ EDIT THIS to match your Neokens dashboard. If a UI id already equals the
// real Neokens id, you can omit it (unmapped ids pass through unchanged). The
// only entries that MUST be here are aliases whose UI name differs from the
// real id — especially the "-thinking" variant, which must map to a base model
// id plus thinking:true (Neokens does not accept "...-thinking" as a literal
// model name).
//
// Format:  "ui-id": { neokens: "real-neokens-id", thinking?: true }
// ─────────────────────────────────────────────────────────────────────────
export const NEOKENS_MODEL_MAP: Record<string, { neokens: string; thinking?: boolean }> = {
  // Claude "-thinking" UI ids must resolve to a real base model id + the flag.
  // Neokens does not accept a literal "...-thinking" model name.
  "claude-opus-4-7-thinking": { neokens: "claude-opus-4-7", thinking: true },
  "claude-opus-4-6-thinking": { neokens: "claude-opus-4-6", thinking: true },
  "claude-sonnet-4-7-thinking": { neokens: "claude-sonnet-4-7", thinking: true },
  "claude-sonnet-4-6-thinking": { neokens: "claude-sonnet-4-6", thinking: true },
  // Backwards compatibility for projects saved while these experimental UI ids existed.
  "gpt-5.5": { neokens: "gpt-5.2" },
  "gpt-5.4": { neokens: "gpt-5.2" },
  "gpt-5.3-codex": { neokens: "gpt-5.2-codex" },

  // Everything else (gpt-*, gemini-*, claude-haiku-*) passes through unchanged
  // because the UI id already equals the real Neokens id. Add an entry here
  // only if your dashboard later uses a different id, e.g.:
  // "custom-ui-id": { neokens: "real-provider-id" },
};

// A Neokens model id that is known to work, used as a last-resort fallback when
// a selected model errors at the gateway. Set this to your most reliable id.
export const NEOKENS_SAFE_FALLBACK_MODEL = "gemini-3-flash";

export const COMET_MODEL_MAP: Record<string, { comet: string; thinking?: boolean }> = {
  "claude-opus-4-8-thinking": { comet: "claude-opus-4-8", thinking: true },
  "claude-opus-4-7-thinking": { comet: "claude-opus-4-7", thinking: true },
  "claude-sonnet-4-6-thinking": { comet: "claude-sonnet-4-6", thinking: true },
  "claude-haiku-4-5": { comet: "claude-haiku-4-5" },
};

/**
 * Resolve a UI model id to the real Neokens model id + thinking flag.
 * Unmapped ids pass through unchanged (thinking inferred from a "-thinking"
 * suffix as a safety net).
 */
export function resolveNeokensModel(uiModelId: string): { model: string; thinking: boolean } {
  const mapped = NEOKENS_MODEL_MAP[uiModelId];
  if (mapped) return { model: mapped.neokens, thinking: !!mapped.thinking };
  // Safety net: if a "-thinking" id wasn't explicitly mapped, strip the suffix
  // and turn on thinking rather than sending an invalid "...-thinking" string.
  if (uiModelId.endsWith("-thinking")) {
    return { model: uiModelId.slice(0, -"-thinking".length), thinking: true };
  }
  return { model: uiModelId, thinking: false };
}

export function resolveCometModel(uiModelId: string): { model: string; thinking: boolean } {
  const mapped = COMET_MODEL_MAP[uiModelId];
  if (mapped) return { model: mapped.comet, thinking: !!mapped.thinking };
  if (uiModelId.endsWith("-thinking")) {
    return { model: uiModelId.slice(0, -"-thinking".length), thinking: true };
  }
  return { model: uiModelId, thinking: false };
}

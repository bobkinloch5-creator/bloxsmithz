import { Zap, MessageSquare, Wrench, Image, Shirt, Palette, Brain, Rocket, Gamepad2, Sparkles, Coins, Info } from "lucide-react";

export const FEATURE_COSTS = [
  {
    icon: MessageSquare,
    name: "AI Chat",
    cost: 1,
    desc: "Ask questions, get help, brainstorm ideas",
    modelMult: true,
  },
  {
    icon: Brain,
    name: "Plan / Improve Prompt",
    cost: 1,
    desc: "Generate a build plan or polish your prompt",
    modelMult: true,
  },
  {
    icon: Wrench,
    name: "Fix Errors",
    cost: 1,
    desc: "Debug and fix broken scripts",
    modelMult: true,
  },
  {
    icon: Zap,
    name: "Script Generate",
    cost: 3,
    desc: "Generate a single script or ModuleScript",
    modelMult: true,
  },
  {
    icon: Rocket,
    name: "System Generate",
    cost: 3,
    desc: "Generate a connected system (server + client)",
    modelMult: true,
  },
  {
    icon: Gamepad2,
    name: "Full System",
    cost: 5,
    desc: "Multi-file game system with UI and remotes",
    modelMult: true,
  },
  {
    icon: Sparkles,
    name: "Autopilot / Full Game",
    cost: 10,
    desc: "End-to-end full game generation",
    modelMult: true,
  },
  {
    icon: Palette,
    name: "UI Generator",
    cost: 5,
    desc: "Generate custom UI layouts and ScreenGuis",
    modelMult: false,
  },
  {
    icon: Image,
    name: "Image Studio",
    cost: 2,
    desc: "Per image variation (thumbnails, art, etc.)",
    modelMult: false,
  },
  {
    icon: Shirt,
    name: "Clothing Design",
    cost: 2,
    desc: "Generate shirt, pants, or t-shirt templates",
    modelMult: false,
  },
  {
    icon: Coins,
    name: "Ideas Generator",
    cost: 1,
    desc: "Brainstorm game concepts and mechanics",
    modelMult: true,
  },
] as const;

export const MODEL_MULTIPLIERS = [
  { name: "gemini-3-flash", label: "Gemini Flash", mult: 1, badge: "Fast" },
  { name: "claude-haiku-4-5", label: "Claude Haiku", mult: 1, badge: "Cheap" },
  { name: "gpt-5.1", label: "GPT-5.1", mult: 1, badge: "Solid" },
  { name: "gpt-5.1-codex", label: "GPT-5.1 Codex", mult: 1, badge: "Code" },
  { name: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max", mult: 2, badge: "Code+" },
  { name: "gpt-5.2", label: "GPT-5.2", mult: 2, badge: "Smart" },
  { name: "gpt-5.2-codex", label: "GPT-5.2 Codex", mult: 2, badge: "Code" },
  { name: "gemini-3.1-pro", label: "Gemini 3.1 Pro", mult: 2, badge: "Big" },
  { name: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", mult: 3, badge: "Deep" },
  { name: "claude-sonnet-4-7", label: "Claude Sonnet 4.7", mult: 3, badge: "Deep" },
  { name: "claude-opus-4-6", label: "Claude Opus 4.6", mult: 5, badge: "Max" },
  { name: "claude-opus-4-7", label: "Claude Opus 4.7", mult: 5, badge: "Max" },
] as const;

export function CreditCostBreakdown() {
  return (
    <div className="space-y-8">
      {/* Feature costs */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <Coins className="h-5 w-5 text-primary-glow" />
          Credit Costs
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Every AI action costs a small amount of credits. Pick a cheaper model to save credits.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_COSTS.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.name}
                className="glass rounded-xl p-4 flex items-start gap-3 transition hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{f.name}</span>
                    {f.modelMult && (
                      <span className="text-[10px] rounded-full bg-accent/15 text-accent px-1.5 py-0.5 font-medium">
                        × model
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-elevated border border-border px-2.5 py-0.5 text-xs font-bold text-primary-glow">
                    <Zap className="h-3 w-3" />
                    {f.cost} credit{f.cost > 1 ? "s" : ""}
                    {f.modelMult && " base"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model multipliers */}
      <div className="glass rounded-2xl p-5 sm:p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-1">
          <Info className="h-4.5 w-4.5 text-primary-glow" />
          Model Multipliers
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Stronger AI models multiply the base cost. You always see the final price before generating.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Model</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Tag</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Multiplier</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {MODEL_MULTIPLIERS.map((m) => {
                const example = 3 * m.mult; // Using script generate (3) as example
                return (
                  <tr key={m.name} className="hover:bg-surface-elevated/30 transition">
                    <td className="py-2.5 px-3 font-medium">{m.label}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] rounded-full bg-surface-elevated border border-border px-2 py-0.5 font-medium text-muted-foreground">
                        {m.badge}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`font-bold ${m.mult >= 3 ? "text-accent" : m.mult >= 2 ? "text-primary-glow" : "text-success"}`}>
                        {m.mult}×
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground hidden sm:table-cell">
                      Script = {example} cr
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

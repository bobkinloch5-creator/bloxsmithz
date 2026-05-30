import { Settings2, Volume2, VolumeX, Bell, BellOff, AtSign, X } from "lucide-react";
import { type ChatPrefs } from "@/lib/chat-prefs";

export function ChatSettingsPanel({
  prefs,
  onChange,
  onClose,
}: {
  prefs: ChatPrefs;
  onChange: (p: Partial<ChatPrefs>) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-surface-elevated/98 backdrop-blur-xl">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          <h2 className="text-sm font-bold">Chat preferences</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4 text-sm">
        <Row label="Font size">
          <ButtonGroup
            value={prefs.font_size}
            options={[
              { v: "sm", l: "Small" },
              { v: "md", l: "Medium" },
              { v: "lg", l: "Large" },
            ]}
            onChange={(v) => onChange({ font_size: v as any })}
          />
        </Row>
        <Row label="Density">
          <ButtonGroup
            value={prefs.density}
            options={[
              { v: "compact", l: "Compact" },
              { v: "cozy", l: "Cozy" },
              { v: "comfy", l: "Comfy" },
            ]}
            onChange={(v) => onChange({ density: v as any })}
          />
        </Row>
        <Row label="Sound">
          <ButtonGroup
            value={prefs.sound_enabled ? "on" : "off"}
            options={[
              { v: "on", l: "On", icon: <Volume2 className="h-3 w-3" /> },
              { v: "off", l: "Off", icon: <VolumeX className="h-3 w-3" /> },
            ]}
            onChange={(v) => onChange({ sound_enabled: v === "on" })}
          />
        </Row>
        <Row label="Notifications">
          <ButtonGroup
            value={prefs.notify_mode}
            options={[
              { v: "off", l: "Off", icon: <BellOff className="h-3 w-3" /> },
              { v: "mentions", l: "Mentions", icon: <AtSign className="h-3 w-3" /> },
              { v: "all", l: "All", icon: <Bell className="h-3 w-3" /> },
            ]}
            onChange={(v) => onChange({ notify_mode: v as any })}
          />
        </Row>
        <Row label="Accent color">
          <div className="flex flex-wrap gap-1.5">
            {[null, "#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#ef4444"].map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange({ theme_accent: c })}
                className={`h-6 w-6 rounded-full border-2 ${
                  prefs.theme_accent === c ? "border-foreground" : "border-border"
                }`}
                style={{ background: c ?? "transparent" }}
                aria-label={c ?? "Default"}
              >
                {c === null && <span className="text-[10px]">∅</span>}
              </button>
            ))}
          </div>
        </Row>
        <p className="pt-2 text-[11px] text-muted-foreground">
          Name color, message gradient, and icon are set in your profile.
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function ButtonGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; l: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
            value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface"
          }`}
        >
          {o.icon}
          {o.l}
        </button>
      ))}
    </div>
  );
}

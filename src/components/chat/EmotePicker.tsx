import { useState } from "react";
import { EMOTES, MASCOT_SRC } from "@/lib/emotes";

export function EmotePicker({ onPick }: { onPick: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
        aria-label="BloxSmith emotes"
      >
        <img src={MASCOT_SRC} alt="" className="h-5 w-5 object-contain" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-9 right-0 z-50 w-[240px] rounded-lg border border-border bg-surface-elevated p-2 shadow-xl">
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              BloxSmith emotes
            </div>
            <div className="grid grid-cols-4 gap-1">
              {EMOTES.map((e) => (
                <button
                  key={e.name}
                  type="button"
                  title={`:${e.name}:`}
                  onClick={() => { onPick(`:${e.name}:`); setOpen(false); }}
                  className="grid h-12 place-items-center rounded transition hover:bg-surface"
                >
                  <img src={e.src} alt={e.label} className="h-9 w-9 object-contain" loading="lazy" />
                </button>
              ))}
            </div>
            <div className="mt-1.5 border-t border-border/60 px-1 pt-1.5 text-[10px] text-muted-foreground">
              Type <code className="rounded bg-surface px-1">:blox_happy:</code> in any message.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { Smile } from "lucide-react";

const EMOJIS = [
  "😀","😂","😍","😎","🤔","😢","😡","🤯","🥳","😴",
  "👍","👎","🙏","👏","🔥","💯","🎉","❤️","💔","✨",
  "🚀","🎮","🤖","👀","💀","🤡","💩","🦾","🧠","☕",
];

export function EmojiPicker({
  onPick,
  label = "Emoji",
}: {
  onPick: (emoji: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
        aria-label={label}
      >
        <Smile className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-9 right-0 z-50 grid w-[220px] grid-cols-6 gap-1 rounded-lg border border-border bg-surface-elevated p-2 shadow-xl">
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => {
                  onPick(e);
                  setOpen(false);
                }}
                className="grid h-7 w-7 place-items-center rounded text-lg transition hover:bg-surface"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "👀"];

// BloxSmith custom emote registry. Use `:name:` in chat to render.
import mascot from "@/assets/emotes/blox-mascot.png";
import happy from "@/assets/emotes/blox-happy.png";
import cool from "@/assets/emotes/blox-cool.png";
import love from "@/assets/emotes/blox-love.png";
import fire from "@/assets/emotes/blox-fire.png";
import sad from "@/assets/emotes/blox-sad.png";
import party from "@/assets/emotes/blox-party.png";
import gg from "@/assets/emotes/blox-gg.png";

export type Emote = { name: string; src: string; label: string };

export const EMOTES: Emote[] = [
  { name: "blox", src: mascot, label: "BloxSmith" },
  { name: "blox_happy", src: happy, label: "Happy" },
  { name: "blox_cool", src: cool, label: "Cool" },
  { name: "blox_love", src: love, label: "Love" },
  { name: "blox_fire", src: fire, label: "Fire" },
  { name: "blox_sad", src: sad, label: "Sad" },
  { name: "blox_party", src: party, label: "Party" },
  { name: "blox_gg", src: gg, label: "GG" },
];

export const EMOTE_MAP: Record<string, Emote> = Object.fromEntries(
  EMOTES.map((e) => [e.name, e]),
);

export const EMOTE_TOKEN_RE = /:([a-z][a-z0-9_]{1,24}):/gi;

export const MASCOT_SRC = mascot;

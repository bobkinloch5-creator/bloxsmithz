import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outDir = path.join(root, "public", "generator-option-previews");
const previewDir = path.join(root, "public", "template-previews");

const groups = {
  model: ["pet", "character", "weapon", "prop", "building", "vehicle", "simulator item", "map piece", "accessory", "tool"],
  style: ["chunky", "low-poly", "cartoon", "anime", "simulator", "obby", "tycoon", "realistic-lite"],
  theme: ["neon", "fantasy", "sci-fi", "city", "horror", "cute", "medieval", "pirate", "space", "premium"],
  material: ["plastic", "metal", "wood", "stone", "glass", "crystal", "fabric", "neon"],
  quality: ["turbo", "standard", "detailed"],
  format: ["GLB", "OBJ", "FBX"],
  texture: ["clean", "painted", "toy-like", "glossy", "matte", "pixel", "cel-shaded", "worn"],
  textFont: ["GothamBlack", "FredokaOne", "Bangers", "Cartoon", "Arcade", "SciFi"],
  textEffect: ["neon", "outline", "gold", "ice", "shadow"],
  textAnimation: ["float", "pulse", "spin", "bounce", "none"],
  animation: ["idle", "walk", "run", "attack", "emote", "dance", "pet", "npc", "tool", "jump"],
  motion: ["snappy", "smooth", "cartoony", "heroic", "scary", "cute", "robotic", "floaty"],
  easing: ["sine", "quad", "back", "elastic", "linear"],
  body: ["full body", "upper body", "arms", "legs", "head", "tool hand", "tail/pet"],
};

const baseByKeyword = [
  [/pet|cute|tail|head|fredoka|toy|cartoony/i, "pet-real.webp"],
  [/fight|weapon|attack|arms|upper|snappy|bangers|cel|metal/i, "fighting-real.webp"],
  [/horror|scary|npc|shadow|worn/i, "horror-real.webp"],
  [/mine|tool|hand|stone|crystal/i, "mining-real.webp"],
  [/obby|jump|low|pixel|legs|arcade|linear/i, "obby-real.webp"],
  [/race|run|smooth|spin|vehicle|pirate|sine/i, "racing-real.webp"],
  [/role|character|anime|heroic|fabric|body|emote|gotham|cartoon/i, "roleplay-real.webp"],
  [/simulator|prop|sci|robotic|turbo|gold|dance|sci|elastic/i, "simulator-real.webp"],
  [/tower|space|detailed|ice|realistic|none|quad/i, "tower-defense-real.webp"],
  [/tycoon|building|city|wood|glass|matte|standard|obj|outline|back/i, "tycoon-real.webp"],
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function titleCase(value) {
  return value
    .replace(/[-_/]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function hash(input) {
  let h = 2166136261;
  for (const char of input) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function baseFor(group, item) {
  const key = `${group} ${item}`;
  return baseByKeyword.find(([pattern]) => pattern.test(key))?.[1] ?? "simulator-real.webp";
}

function svgOverlay(group, item, index) {
  const seed = hash(`${group}:${item}:${index}`);
  const hue = seed % 360;
  const accent = `hsl(${hue} 92% 58%)`;
  const accent2 = `hsl(${(hue + 74) % 360} 92% 62%)`;
  const label = titleCase(item);
  const kicker = titleCase(group.replace(/text/g, "Text "));
  const x = 34 + (seed % 70);
  const y = 38 + ((seed >> 8) % 44);
  const size = 42 + ((seed >> 16) % 34);
  const bar = 92 + ((seed >> 12) % 96);
  const escapedLabel = label.replace(/&/g, "&amp;");
  const escapedKicker = kicker.replace(/&/g, "&amp;");

  return Buffer.from(`
    <svg width="512" height="288" viewBox="0 0 512 288" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${accent}" stop-opacity="0.42"/>
          <stop offset="0.48" stop-color="#020617" stop-opacity="0.08"/>
          <stop offset="1" stop-color="${accent2}" stop-opacity="0.34"/>
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="512" height="288" fill="url(#fade)"/>
      <path d="M0 220 C96 190 150 246 246 214 C340 184 414 196 512 164 L512 288 L0 288 Z" fill="#020617" opacity="0.55"/>
      <g filter="url(#glow)" opacity="0.94">
        <rect x="${x}" y="${y}" width="${size * 1.55}" height="${size}" rx="10" fill="${accent}" opacity="0.18" stroke="${accent}" stroke-width="2"/>
        <circle cx="${x + size * 1.72}" cy="${y + size * 0.48}" r="${size * 0.38}" fill="${accent2}" opacity="0.28" stroke="${accent2}" stroke-width="2"/>
        <rect x="${x + 16}" y="${y + size + 18}" width="${bar}" height="12" rx="6" fill="${accent}" opacity="0.55"/>
      </g>
      <rect x="0" y="0" width="512" height="288" fill="#000" opacity="0.16"/>
      <rect x="18" y="198" width="476" height="70" rx="18" fill="#020617" opacity="0.72"/>
      <text x="38" y="225" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" letter-spacing="1.3">${escapedKicker}</text>
      <text x="38" y="253" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="900">${escapedLabel}</text>
    </svg>
  `);
}

await fs.mkdir(outDir, { recursive: true });

let created = 0;
for (const [group, items] of Object.entries(groups)) {
  for (const [index, item] of items.entries()) {
    const source = path.join(previewDir, baseFor(group, item));
    const seed = hash(`${group}:${item}`);
    const left = seed % 34;
    const top = (seed >>> 8) % 24;
    const overlay = svgOverlay(group, item, index);
    const output = path.join(outDir, `${group}-${slug(item)}.webp`);

    const base = sharp(source)
      .resize(600, 338, { fit: "cover", position: "attention" })
      .extract({ left, top, width: 512, height: 288 })
      .modulate({
        saturation: 1.05 + ((seed % 16) / 100),
        brightness: 0.86 + (((seed >> 4) % 16) / 100),
      });
    if (group === "material") base.blur(0.4);

    await base
      .composite([{ input: overlay, blend: "over" }])
      .webp({ quality: 82 })
      .toFile(output);
    created += 1;
  }
}

console.log(`Created ${created} unique generator option previews in ${path.relative(root, outDir)}`);

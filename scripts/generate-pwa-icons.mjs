// Generates the icon set from the Bilanz-Buddy mark.
// Run once (or after the mark changes): `node scripts/generate-pwa-icons.mjs`.
// Output PNGs live in public/ and are committed. Requires `sharp` (already a
// transitive dependency via Next.js image optimization).
//
// Source of truth is the VECTOR (public/bb-mark-solid.svg), not a PNG: the mark
// is three rectangles, so every size is rendered fresh instead of resampled.
// The geometry is repeated here because maskable icons need the bars scaled
// down independently of the tile — a plain resize cannot do that.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "public");

const OBSIDIAN = "#0F1522";
const GOLD = "#D4AF37";

// The two bars are deliberately the same length: "eine Bilanz, die aufgeht".
const BARS = `
  <rect x="15" y="21" width="34" height="7" rx="3.5" fill="#FFFFFF"/>
  <rect x="15" y="36" width="34" height="7" rx="3.5" fill="${GOLD}"/>`;

// `barScale` shrinks the bars around the tile centre. Maskable icons get cropped
// into a circle by the launcher, so their content must sit inside the safe zone.
function markSvg({ barScale = 1, radius = 16 } = {}) {
  const bars =
    barScale === 1
      ? BARS
      : `<g transform="translate(32 32) scale(${barScale}) translate(-32 -32)">${BARS}</g>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${OBSIDIAN}"/>${bars}
</svg>`
  );
}

async function render(svg, size, outName) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(OUT, outName));
  console.log("wrote", outName);
}

const tile = markSvg();
const maskable = markSvg({ barScale: 0.74 });

// PWA + platform icons. Names are load-bearing: layout.tsx, manifest.ts and the
// service-worker precache list all reference them.
await render(tile, 192, "icon-192.png");
await render(tile, 512, "icon-512.png");
await render(maskable, 192, "icon-192-maskable.png");
await render(maskable, 512, "icon-512-maskable.png");
await render(tile, 180, "apple-touch-icon.png");
await render(tile, 32, "favicon.png");

// Brand originals from the Markenbuch.
await render(tile, 1024, "bb-app-icon-1024.png");
await render(tile, 512, "bb-favicon-512.png");
await render(tile, 180, "bb-favicon-180.png");
await render(tile, 32, "bb-favicon-32.png");
await render(tile, 16, "bb-favicon-16.png");
// The social avatar is cropped to a circle by every platform, so it uses the
// maskable padding and a full-bleed square.
await render(markSvg({ barScale: 0.74, radius: 0 }), 400, "bb-avatar-400.png");

// favicon.ico for /favicon.ico requests that ignore the declared <link> icons.
// An ICO may wrap a PNG verbatim, so this is a 22-byte header plus the 32px PNG.
const png32 = await sharp(tile, { density: 384 }).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // palette size (0 = truecolour)
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png32.length, 14);
header.writeUInt32LE(22, 18); // offset of the image data
await writeFile(join(root, "src", "app", "favicon.ico"), Buffer.concat([header, png32]));
console.log("wrote src/app/favicon.ico");

// Generates the PWA icon set from the Vendora logo.
// Run once (or after the logo changes): `node scripts/generate-pwa-icons.mjs`.
// Output PNGs live in public/ and are committed. Requires `sharp` (already a
// transitive dependency via Next.js image optimization).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public", "vendora_logo_v1_transparent.png");
const OUT = join(root, "public");

const BG = { r: 250, g: 250, b: 250, alpha: 1 }; // #FAFAFA (manifest background_color)

// Render the logo centered on a solid square background. `coverage` is the
// fraction of the canvas width the logo may occupy (smaller = more padding,
// used for maskable icons whose edges get cropped into a circle/rounded mask).
async function makeIcon(size, coverage, outName) {
  const logoWidth = Math.round(size * coverage);
  const logo = await sharp(SRC)
    .resize({ width: logoWidth, fit: "inside" })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(join(OUT, outName));
  console.log("wrote", outName);
}

await makeIcon(192, 0.8, "icon-192.png");
await makeIcon(512, 0.8, "icon-512.png");
await makeIcon(192, 0.62, "icon-192-maskable.png");
await makeIcon(512, 0.62, "icon-512-maskable.png");
await makeIcon(180, 0.8, "apple-touch-icon.png");

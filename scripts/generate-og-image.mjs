// Erzeugt public/bb-og-1200x630.png -- das Bild, das beim Teilen eines Links
// erscheint. Run: `node scripts/generate-og-image.mjs` (nach Aenderungen an
// Name, Claim oder Gold in src/lib/brand.ts).
//
// WARUM ALS SKRIPT UND NICHT ALS opengraph-image.tsx: die Route muesste die
// Manrope-Datei zur Laufzeit laden. `fetch(new URL(..., import.meta.url))`
// scheitert im Turbopack-Build, und ein fs-Zugriff auf node_modules ueberlebt
// das Deployment-Tracing nicht zuverlaessig. Einmal rendern und die PNG
// committen loest beides -- und das Markenbuch listet die Datei ohnehin.
import { ImageResponse } from "next/og.js";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// brand.ts ist TypeScript; die paar Werte hier zu spiegeln ist billiger als
// eine Transpile-Stufe im Skript. Der Guard dagegen ist brandGuards.test.ts.
const APP_NAME_HEAD = "Bilanz";
const APP_NAME_TAIL = "-Buddy";
const APP_CLAIM = "Dein Buddy für die Zahlen.";
const APP_DOMAIN = "bilanz-buddy.de";
const GOLD = "#D4AF37";
const OBSIDIAN = "#0F1522";

const manrope = await readFile(
  join(root, "node_modules", "@fontsource", "manrope", "files", "manrope-latin-800-normal.woff")
);

const image = new ImageResponse(
  {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 40,
        padding: 96,
        background: OBSIDIAN,
        fontFamily: "Manrope",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: 36 },
            children: [
              {
                type: "svg",
                props: {
                  width: 140,
                  height: 140,
                  viewBox: "0 0 64 64",
                  children: [
                    {
                      type: "rect",
                      props: {
                        x: 1.5, y: 1.5, width: 61, height: 61, rx: 19,
                        fill: "none", stroke: "rgba(255,255,255,0.35)", strokeWidth: 3,
                      },
                    },
                    { type: "rect", props: { x: 15, y: 21, width: 34, height: 7, rx: 3.5, fill: "#FFFFFF" } },
                    { type: "rect", props: { x: 15, y: 36, width: 34, height: 7, rx: 3.5, fill: GOLD } },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", fontSize: 104, letterSpacing: -4, color: "#FFFFFF" },
                  children: [
                    { type: "span", props: { children: APP_NAME_HEAD } },
                    { type: "span", props: { style: { color: GOLD }, children: APP_NAME_TAIL } },
                  ],
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", fontSize: 44, color: "rgba(255,255,255,0.75)" },
            children: APP_CLAIM,
          },
        },
        {
          type: "div",
          props: { style: { display: "flex", fontSize: 30, color: GOLD }, children: APP_DOMAIN },
        },
      ],
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [{ name: "Manrope", data: manrope, weight: 800, style: "normal" }],
  }
);

const out = join(root, "public", "bb-og-1200x630.png");
await writeFile(out, Buffer.from(await image.arrayBuffer()));
console.log("wrote public/bb-og-1200x630.png");

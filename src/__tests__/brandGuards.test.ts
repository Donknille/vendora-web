import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  APP_CLAIM,
  APP_DOMAIN,
  APP_NAME,
  APP_NAME_HEAD,
  APP_NAME_TAIL,
  APP_SLUG,
  BRAND_GOLD,
  BRAND_OBSIDIAN,
} from "@/lib/brand";
import { DARK_COOKIE, LANGUAGE_COOKIE, THEME_COOKIE } from "@/lib/prefs";
import { ONBOARDING_KEY } from "@/lib/onboarding";
import { INSTALL_HINT_DISMISSED_KEY } from "@/lib/pwaInstall";
import { OFFLINE_CACHE_KEY } from "@/lib/offlineCache";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// Guards fuer die Marke. Der Umbau von Vendora auf Bilanz-Buddy im August 2026
// hat gezeigt, wo ein Produktname ueberall hinsickert: in Cookie-Namen, in
// Cache-Praefixe, in eine Datei unter public/, die keine Imports kennt. Was
// hier steht, sind die Kopplungen, die still auseinanderlaufen wuerden.

describe("Schreibweise", () => {
  // Das Markenbuch (Stand 20.08.2026) laesst genau eine Form zu. "BB" ist als
  // Absender ausgeschlossen, die anderen beiden sind schlicht falsch.
  const VERBOTEN = ["BilanzBuddy", "Bilanz Buddy", "Bilanz–Buddy"];

  function* sourceFiles(dir: string): Generator<string> {
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "__snapshots__") continue;
        yield* sourceFiles(rel);
      } else if (/\.(ts|tsx|css|html|js|mjs)$/.test(entry.name)) {
        yield rel;
      }
    }
  }

  it("nutzt nirgends eine der falschen Formen", () => {
    const treffer: string[] = [];
    for (const dir of ["src", "public", "scripts"]) {
      for (const rel of sourceFiles(dir)) {
        // Diese Datei zaehlt die falschen Formen ja gerade auf.
        if (rel.endsWith("brandGuards.test.ts")) continue;
        const text = read(rel);
        for (const falsch of VERBOTEN) {
          if (text.includes(falsch)) treffer.push(`${rel}: ${falsch}`);
        }
      }
    }
    expect(treffer).toEqual([]);
  });

  it("setzt den Namen aus beiden Haelften zusammen", () => {
    expect(`${APP_NAME_HEAD}${APP_NAME_TAIL}`).toBe(APP_NAME);
    expect(APP_NAME).toContain("-");
  });
});

describe("Persistenz-Schluessel tragen den Slug", () => {
  it("bei Cookies und localStorage", () => {
    for (const key of [
      THEME_COOKIE,
      DARK_COOKIE,
      LANGUAGE_COOKIE,
      ONBOARDING_KEY,
      INSTALL_HINT_DISMISSED_KEY,
      OFFLINE_CACHE_KEY,
    ]) {
      expect(key, `${key} traegt nicht ${APP_SLUG}`).toMatch(new RegExp(`^${APP_SLUG}-`));
    }
  });

  it("bei der IndexedDB der Offline-Kasse", () => {
    // Der Name steht in salesQueue.ts und noch einmal in clearLocalData.ts.
    // Laufen die auseinander, loescht "Alle Daten entfernen" eine Datenbank,
    // die es nicht gibt, und die echte bleibt mit fremden Verkaeufen liegen.
    const queue = read("src/lib/offline/salesQueue.ts");
    const clear = read("src/lib/clearLocalData.ts");
    const name = `${APP_SLUG}-offline`;
    expect(queue).toContain(`"${name}"`);
    expect(clear).toContain(`deleteDatabase("${name}")`);
  });
});

describe("public/ kennt keine Imports und muss trotzdem synchron bleiben", () => {
  it("benennt die Service-Worker-Caches wie brand.ts", () => {
    const sw = read("public/sw.js");
    expect(sw).toContain(`\`${APP_SLUG}-precache-\${VERSION}\``);
    expect(sw).toContain(`\`${APP_SLUG}-runtime-\${VERSION}\``);
  });

  it("schont beim Logout genau den Precache, den der SW anlegt", () => {
    // clearLocalData raeumt alle Caches ausser dem Precache. Passt das
    // Praefix nicht, ist die Offline-Seite nach jedem Logout weg.
    expect(read("src/lib/clearLocalData.ts")).toContain(`startsWith("${APP_SLUG}-precache")`);
  });

  it("liest in offline.html denselben Schluessel, den die Kasse schreibt", () => {
    const key = `${APP_SLUG}-last-register`;
    expect(read("public/offline.html")).toContain(`localStorage.getItem("${key}")`);
    expect(read("src/app/(app)/markets/[id]/kasse/page.tsx")).toContain(`"${key}"`);
  });
});

describe("Das OG-Bild wird aus denselben Werten erzeugt", () => {
  // scripts/generate-og-image.mjs laeuft in Node und kann brand.ts nicht
  // importieren, spiegelt die Werte also. Hier steht, dass die Spiegelung haelt.
  it("spiegelt Name, Claim, Domain und Farben aus brand.ts", () => {
    const script = read("scripts/generate-og-image.mjs");
    expect(script).toContain(`const APP_NAME_HEAD = "${APP_NAME_HEAD}";`);
    expect(script).toContain(`const APP_NAME_TAIL = "${APP_NAME_TAIL}";`);
    expect(script).toContain(`const APP_CLAIM = "${APP_CLAIM}";`);
    expect(script).toContain(`const APP_DOMAIN = "${APP_DOMAIN}";`);
    expect(script).toContain(`const GOLD = "${BRAND_GOLD}";`);
    expect(script).toContain(`const OBSIDIAN = "${BRAND_OBSIDIAN}";`);
  });
});

describe("Stripe behaelt die Bruecke ueber die Umbenennung", () => {
  it("liest den alten Metadaten-Schluessel weiterhin mit", () => {
    // Customer und Subscriptions, die vor August 2026 entstanden sind, tragen
    // `vendora_user_id`. Faellt der Lesepfad weg, steht der Abo-Status still
    // falsch -- ohne Fehler, ohne Log.
    const webhook = read("src/app/api/stripe/webhook/route.ts");
    expect(webhook).toContain("metadata?.bilanz_buddy_user_id ?? metadata?.vendora_user_id");
    expect(read("src/app/api/stripe/checkout/route.ts")).toContain("bilanz_buddy_user_id");
  });
});

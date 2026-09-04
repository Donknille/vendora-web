import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PRO_PRICE_CENTS, PRO_PRICE_NET_CENTS, VAT_RATE } from "@/lib/plan";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Guards fuer den Abo-Preis.
 *
 * Der Preis steht an sieben Stellen im Quelltext — Landing-Header, Preisbox,
 * AGB, Abo-Banner (zweisprachig) und Woerterbuch (zweisprachig) — und keine
 * davon kann `PRO_PRICE_CENTS` importieren, weil es Fliesstext ist. Beim
 * Wechsel von 19,90 € auf 9,99 € im September 2026 war genau das die Arbeit:
 * jede Kopie von Hand finden. Was hier steht, faengt die vergessene achte.
 */

/** Preis in der Schreibweise, die in deutschem bzw. englischem Text steht. */
const EN = (PRO_PRICE_CENTS / 100).toFixed(2);
const DE = EN.replace(".", ",");

/** Dateien, die den Preis in deutschem Fliesstext nennen. */
const DE_FILES = [
  "src/app/landing/page.tsx",
  "src/app/landing/_components/PricingBox.tsx",
  "src/app/legal/agb/page.tsx",
  "src/components/ui/SubscriptionBanner.tsx",
  "src/lib/i18n.ts",
];

/** Dateien, die ihn zusaetzlich auf Englisch nennen. */
const EN_FILES = ["src/components/ui/SubscriptionBanner.tsx", "src/lib/i18n.ts"];

/**
 * „9,99 €/Monat" — aber das Woerterbuch schreibt das Euro-Zeichen als
 * `€`-Escape. Der Punkt in der zweiten Alternative deckt den Backslash
 * ab, damit beide Schreibweisen gefunden werden.
 */
const PREIS_DE = /(\d+,\d{2}) ?(?:€|.u20AC)\/Monat/g;
const PREIS_EN = /(\d+\.\d{2})\/month/g;

describe("Preisangaben im Text", () => {
  it("nennt in jeder deutschen Anzeigestelle den Preis aus PRO_PRICE_CENTS", () => {
    for (const rel of DE_FILES) {
      expect(read(rel), rel).toContain(DE);
    }
  });

  it("nennt in jeder englischen Anzeigestelle denselben Preis", () => {
    for (const rel of EN_FILES) {
      expect(read(rel), rel).toContain(EN);
    }
  });

  it("laesst nirgends einen alten Preis stehen", () => {
    const abweichend: string[] = [];
    for (const rel of DE_FILES) {
      for (const [treffer, betrag] of read(rel).matchAll(PREIS_DE)) {
        if (betrag !== DE) abweichend.push(`${rel}: ${treffer}`);
      }
    }
    for (const rel of EN_FILES) {
      for (const [treffer, betrag] of read(rel).matchAll(PREIS_EN)) {
        if (betrag !== EN) abweichend.push(`${rel}: ${treffer}`);
      }
    }
    expect(abweichend).toEqual([]);
  });

  it("nennt den Preis auch in der Preisbox als Zahl fuer die Zaehlanimation", () => {
    // CountUp bekommt den Betrag als Zahl, nicht als Text — die Kopie wird
    // vom Textabgleich oben nicht erfasst.
    expect(read("src/app/landing/_components/PricingBox.tsx")).toContain(
      `end={${PRO_PRICE_CENTS / 100}}`,
    );
  });
});

describe("Umsatzsteuer", () => {
  it("zerlegt den Bruttopreis vollstaendig in Netto und Steuer", () => {
    const steuer = PRO_PRICE_CENTS - PRO_PRICE_NET_CENTS;
    expect(PRO_PRICE_NET_CENTS + steuer).toBe(PRO_PRICE_CENTS);
    // Gerundet wie Stripe bei `tax_behavior: "inclusive"`.
    expect(PRO_PRICE_NET_CENTS).toBe(Math.round(PRO_PRICE_CENTS / (1 + VAT_RATE)));
  });

  it("nennt die enthaltene Steuer dort, wo der Preis steht", () => {
    // Ein Bruttopreis ohne Hinweis auf die enthaltene Steuer ist gegenueber
    // Unternehmerinnen missverstaendlich: sie rechnen mit einem Aufschlag.
    expect(read("src/app/landing/_components/PricingBox.tsx")).toMatch(/inkl\..*USt/);
    expect(read("src/app/legal/agb/page.tsx")).toMatch(/inkl\..*Umsatzsteuer/);
  });

  it("behauptet im Impressum nicht mehr, es falle keine Umsatzsteuer an", () => {
    // Der Verzicht auf die Kleinunternehmerregelung (September 2026) macht den
    // alten Absatz zu einer unrichtigen Pflichtangabe — und er widerspraeche
    // dem „inkl. USt." am Preis.
    const impressum = read("src/app/legal/impressum/page.tsx");
    expect(impressum).not.toMatch(/Kleinunternehmer/);
    expect(impressum).not.toMatch(/keine Umsatzsteuer berechnet/);
  });
});

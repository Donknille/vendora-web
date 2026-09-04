import { describe, it, expect } from "vitest";
import { saleLineTotal, saleQuantity, sumSaleLines } from "@/lib/saleMath";
import { readSource, readUnit } from "@/test-utils/sourceScan";

describe("saleMath", () => {
  it("rechnet Betrag mal Menge in Cent", () => {
    expect(saleLineTotal({ amount: 1500, quantity: 2 })).toBe(3000);
    expect(saleLineTotal({ amount: "1500", quantity: "3" })).toBe(4500);
  });

  it("zaehlt eine Zeile ohne Menge als ein Stueck — wie die EUeR", () => {
    expect(saleQuantity({ quantity: null })).toBe(1);
    expect(saleQuantity({ quantity: 0 })).toBe(1);
    expect(saleLineTotal({ amount: 1500, quantity: undefined })).toBe(1500);
    expect(saleLineTotal({ amount: null, quantity: 2 })).toBe(0);
  });

  it("summiert Zeilen", () => {
    expect(sumSaleLines([{ amount: 100, quantity: 2 }, { amount: 50, quantity: null }])).toBe(250);
  });
});

/**
 * Quelltext-Wächter: Alle fünf Stellen, die Verkaufszeilen bewerten, nehmen
 * dieselbe Regel. Vorher rechneten EÜR und Ranking mit `|| 1`, Tagesabschluss,
 * Marktkarte und Jahresvergleich mit `|| 0` — für dieselbe Zeile zwei Summen.
 *
 * Mutation zum Rotfahren: in marketDay.ts die alte Zeile
 * `(Number(s.amount) || 0) * qty` zurückschreiben.
 */
describe("eine Rechenregel fuer Verkaufszeilen", () => {
  const UNITS = [
    "lib/euerReport.ts",
    "lib/marketRanking.ts",
    "lib/marketDay.ts",
    "lib/marketCalendar.ts",
  ];

  it.each(UNITS)("%s nutzt saleLineTotal statt eigener Multiplikation", (rel) => {
    const src = readSource(rel);
    expect(src).toContain("saleLineTotal");
    expect(src).not.toMatch(/\.amount\)?\s*\|\|\s*0\)\s*\*/);
    expect(src).not.toMatch(/\*\s*\(?\s*Number\([a-z]+\.quantity\)/);
  });

  it("die Marktliste rechnet nicht selbst", () => {
    const src = readUnit("app/(app)/markets");
    expect(src).toContain("saleLineTotal");
    expect(src).not.toMatch(/Number\(s\.amount\)\s*\*\s*Number\(s\.quantity\)/);
  });
});

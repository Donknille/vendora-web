import { describe, it, expect } from "vitest";
import { shouldPersistQuery } from "@/lib/offlineCache";

/**
 * Der persistierte Puffer ist bewusst schmal: er soll die Kasse offline starten
 * lassen, nicht die Bücher aufs Gerät kopieren. Dieser Test hält die Grenze
 * fest — sonst rutschen bei der nächsten Erweiterung Aufträge, Rechnungen oder
 * Ausgaben mit hinein.
 */
describe("shouldPersistQuery", () => {
  const key = (url: string) => ["user-1", url];

  it("persistiert die Marktliste", () => {
    expect(shouldPersistQuery(key("/api/markets"))).toBe(true);
  });

  it("persistiert die Verkäufe eines Marktes", () => {
    expect(shouldPersistQuery(key("/api/markets/abc-123/sales"))).toBe(true);
  });

  it("persistiert keine Geld- und Kundendaten", () => {
    for (const url of [
      "/api/orders",
      "/api/invoices",
      "/api/expenses",
      "/api/dashboard",
      "/api/profile",
      "/api/subscription",
      "/api/market-sales",
      "/api/euer/unlocks",
      "/api/customers",
    ]) {
      expect(shouldPersistQuery(key(url)), url).toBe(false);
    }
  });

  it("persistiert nichts ohne API-Schlüssel", () => {
    expect(shouldPersistQuery(["user-1", "irgendwas"])).toBe(false);
    expect(shouldPersistQuery([])).toBe(false);
  });

  it("lässt sich nicht über einen Präfix austricksen", () => {
    expect(shouldPersistQuery(key("/api/markets/abc/sales/extra"))).toBe(false);
    expect(shouldPersistQuery(key("/api/marketsX"))).toBe(false);
  });
});

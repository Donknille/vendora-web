import { describe, it, expect } from "vitest";
import {
  mapLegacyMarketStatus,
  mapLegacyOrderStatus,
  mapLegacyPaymentMethod,
  normalizeLegacyDate,
} from "@/lib/legacyImport";

// Der Import uebersetzt alte Werte, statt am CHECK der Datenbank zu
// scheitern. Mutation zum Rotfahren: eine der Mapping-Tabellen leeren.
describe("legacyImport", () => {
  it("uebersetzt deutsche Zahlungsarten und laesst gueltige durch", () => {
    expect(mapLegacyPaymentMethod("Bar")).toBe("cash");
    expect(mapLegacyPaymentMethod("Karte")).toBe("card");
    expect(mapLegacyPaymentMethod("Überweisung")).toBe("transfer");
    expect(mapLegacyPaymentMethod("paypal")).toBe("paypal");
    expect(mapLegacyPaymentMethod("card")).toBe("card");
  });

  it("macht aus Unbekanntem oder Leerem keine Zahlungsart", () => {
    expect(mapLegacyPaymentMethod("Kryptowaehrung")).toBeNull();
    expect(mapLegacyPaymentMethod("")).toBeNull();
    expect(mapLegacyPaymentMethod(null)).toBeNull();
    // Object.prototype-Schluessel sind keine Zahlungsarten.
    expect(mapLegacyPaymentMethod("constructor")).toBeNull();
  });

  it("uebersetzt Auftrags- und Marktstatus, Rueckfall ist offen", () => {
    expect(mapLegacyOrderStatus("Bezahlt")).toBe("paid");
    expect(mapLegacyOrderStatus("shipped")).toBe("shipped");
    expect(mapLegacyOrderStatus("foo")).toBe("open");
    expect(mapLegacyOrderStatus(undefined)).toBe("open");
    expect(mapLegacyMarketStatus("Zugesagt")).toBe("confirmed");
    expect(mapLegacyMarketStatus("completed")).toBe("completed");
    expect(mapLegacyMarketStatus("toString")).toBe("open");
  });

  it("bringt Datumsangaben ohne Date() auf YYYY-MM-DD", () => {
    expect(normalizeLegacyDate("2026-08-01")).toBe("2026-08-01");
    expect(normalizeLegacyDate("2026-08-01T22:30:00.000Z")).toBe("2026-08-01");
    expect(normalizeLegacyDate("31.12.2026")).toBe("2026-12-31");
    expect(normalizeLegacyDate("1.2.2026")).toBe("2026-02-01");
  });

  it("weist Unbrauchbares ab, statt es durchzureichen", () => {
    expect(normalizeLegacyDate("gestern")).toBeNull();
    expect(normalizeLegacyDate("2026-13-01")).toBeNull();
    expect(normalizeLegacyDate("32.01.2026")).toBeNull();
    expect(normalizeLegacyDate("")).toBeNull();
    expect(normalizeLegacyDate(null)).toBeNull();
  });
});

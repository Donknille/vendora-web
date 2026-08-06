import { describe, it, expect } from "vitest";
import { deriveMarketCosts, planMarketCostRows, shouldBookMarketCosts } from "@/lib/marketCosts";
import { mapLegacyCategory, isEuerCategory, euerLabel } from "@/lib/euer";

describe("deriveMarketCosts (market → expense rows)", () => {
  const market = {
    name: "Weihnachtsmarkt",
    date: "2026-12-01",
    standFee: 5000,
    travelCost: 2500,
    status: "completed",
  };

  it("derives a stand-fee and a travel-cost row (cents preserved)", () => {
    const rows = deriveMarketCosts(market);
    expect(rows).toHaveLength(2);

    const fee = rows.find((r) => r.source === "market_fee")!;
    expect(fee.category).toBe("standgebuehren_raumkosten");
    expect(fee.amount).toBe(5000);
    expect(fee.expenseDate).toBe("2026-12-01");
    expect(fee.description).toContain("Weihnachtsmarkt");

    const travel = rows.find((r) => r.source === "market_travel")!;
    expect(travel.category).toBe("fahrtkosten");
    expect(travel.amount).toBe(2500);
  });

  it("omits rows for zero fees", () => {
    expect(deriveMarketCosts({ ...market, standFee: 0 })).toHaveLength(1);
    expect(deriveMarketCosts({ ...market, standFee: 0, travelCost: 0 })).toHaveLength(0);
    expect(deriveMarketCosts({ ...market, travelCost: 0 })[0].source).toBe("market_fee");
  });

  it("books nothing while the market is not confirmed or completed", () => {
    // A market one has only applied for — or that was cancelled — has no place
    // in the EÜR, however high its planned fees are.
    for (const status of ["open", "applied", "cancelled", "irgendwas", null]) {
      expect(deriveMarketCosts({ ...market, status })).toEqual([]);
    }
    expect(deriveMarketCosts({ ...market, status: "confirmed" })).toHaveLength(2);
  });
});

describe("shouldBookMarketCosts", () => {
  it("accepts confirmed and completed only", () => {
    expect(shouldBookMarketCosts("confirmed")).toBe(true);
    expect(shouldBookMarketCosts("completed")).toBe(true);
    for (const status of ["open", "applied", "cancelled", "", null, undefined]) {
      expect(shouldBookMarketCosts(status)).toBe(false);
    }
  });
});

describe("planMarketCostRows", () => {
  const market = {
    name: "Sommermarkt",
    date: "2026-07-01",
    standFee: 4000,
    travelCost: 1000,
    status: "confirmed",
  };

  it("attaches owner and market to every row", () => {
    const rows = planMarketCostRows(market, { userId: "u1", marketId: "m1" });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.userId).toBe("u1");
      expect(row.marketId).toBe("m1");
    }
  });

  it("returns nothing for a status that does not book", () => {
    expect(planMarketCostRows({ ...market, status: "applied" }, { userId: "u1", marketId: "m1" })).toEqual([]);
  });
});

describe("mapLegacyCategory", () => {
  it("maps known legacy free-text categories to the enum", () => {
    expect(mapLegacyCategory("Materials")).toBe("wareneinkauf_material");
    expect(mapLegacyCategory("Tools")).toBe("arbeitsmittel_gwg");
    expect(mapLegacyCategory("Packaging")).toBe("verpackung");
    expect(mapLegacyCategory("Subscriptions")).toBe("software_gebuehren");
    expect(mapLegacyCategory("Marketing")).toBe("marketing");
  });

  it("falls back to sonstiges for unknown/empty/null", () => {
    expect(mapLegacyCategory("Shipping")).toBe("sonstiges");
    expect(mapLegacyCategory("")).toBe("sonstiges");
    expect(mapLegacyCategory(null)).toBe("sonstiges");
    expect(mapLegacyCategory("whatever")).toBe("sonstiges");
  });

  it("is idempotent for values already in the enum", () => {
    expect(mapLegacyCategory("fahrtkosten")).toBe("fahrtkosten");
    expect(mapLegacyCategory("sonstiges")).toBe("sonstiges");
  });
});

describe("isEuerCategory / euerLabel", () => {
  it("validates enum membership", () => {
    expect(isEuerCategory("fahrtkosten")).toBe(true);
    expect(isEuerCategory("Materials")).toBe(false);
    expect(isEuerCategory(null)).toBe(false);
  });

  it("labels categories per language and falls back to sonstiges", () => {
    expect(euerLabel("fahrtkosten", "de")).toBe("Fahrt- / Reisekosten");
    expect(euerLabel("fahrtkosten", "en")).toBe("Travel costs");
    expect(euerLabel("unknown", "de")).toBe("Sonstiges");
  });
});

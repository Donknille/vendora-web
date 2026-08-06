import { describe, it, expect } from "vitest";
import { computeMarketRanking, type MarketRankingInput } from "@/lib/marketRanking";

const market = (m: Partial<MarketRankingInput["markets"][number]>) =>
  ({ id: "m1", name: "Markt", date: "2025-07-01", standFee: 0, travelCost: 0, ...m });

const sale = (s: Partial<MarketRankingInput["marketSales"][number]>) =>
  ({ marketId: "m1", amount: 0, quantity: 1, ...s });

const expense = (e: Partial<MarketRankingInput["expenses"][number]>) =>
  ({ marketId: null, source: "manual", amount: 0, ...e });

describe("computeMarketRanking", () => {
  it("sorts by profit descending", () => {
    const rows = computeMarketRanking({
      markets: [market({ id: "a", name: "A" }), market({ id: "b", name: "B" })],
      marketSales: [sale({ marketId: "a", amount: 1000 }), sale({ marketId: "b", amount: 5000 })],
      expenses: [],
    });
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("counts booked cost rows, not the market's planned fees", () => {
    const rows = computeMarketRanking({
      markets: [market({ id: "a", standFee: 4000, travelCost: 1000 })],
      marketSales: [sale({ marketId: "a", amount: 3000, quantity: 2 })],
      expenses: [
        expense({ marketId: "a", source: "market_fee", amount: 4000 }),
        expense({ marketId: "a", source: "market_travel", amount: 1000 }),
      ],
    });
    expect(rows[0]).toMatchObject({ revenue: 6000, costs: 5000, profit: 1000, costsBooked: true });
  });

  it("shows a cancelled market's planned fees as unbooked instead of as a loss", () => {
    const rows = computeMarketRanking({
      markets: [market({ id: "a", standFee: 5000 })], // status gate booked nothing
      marketSales: [sale({ marketId: "a", amount: 2000 })],
      expenses: [],
    });
    expect(rows[0]).toMatchObject({ revenue: 2000, costs: 0, profit: 2000, costsBooked: false });
  });

  it("ignores manual expenses that happen to carry a marketId", () => {
    const rows = computeMarketRanking({
      markets: [market({ id: "a" })],
      marketSales: [],
      expenses: [expense({ marketId: "a", source: "manual", amount: 9999 })],
    });
    expect(rows[0]).toMatchObject({ costs: 0, profit: 0, costsBooked: true });
  });

  it("filters on the market day; null keeps every year", () => {
    const input: MarketRankingInput = {
      markets: [market({ id: "a", date: "2024-05-01" }), market({ id: "b", date: "2025-05-01" })],
      marketSales: [sale({ marketId: "a", amount: 100 }), sale({ marketId: "b", amount: 200 })],
      expenses: [],
    };
    expect(computeMarketRanking({ ...input, years: [2025] }).map((r) => r.id)).toEqual(["b"]);
    expect(computeMarketRanking({ ...input, years: null })).toHaveLength(2);
    expect(computeMarketRanking(input)).toHaveLength(2);
  });

  it("lists a market without sales or costs at zero", () => {
    const rows = computeMarketRanking({ markets: [market({ id: "a" })], marketSales: [], expenses: [] });
    expect(rows[0]).toMatchObject({ revenue: 0, costs: 0, profit: 0, costsBooked: true });
  });
});

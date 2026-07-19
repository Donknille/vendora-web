import { describe, it, expect } from "vitest";
import {
  daysBetween,
  deadlineInfo,
  computeYearComparison,
  statusLabel,
} from "@/lib/marketCalendar";

describe("daysBetween", () => {
  it("counts whole days regardless of month/year boundaries", () => {
    expect(daysBetween("2026-07-19", "2026-07-26")).toBe(7);
    expect(daysBetween("2026-07-19", "2026-07-18")).toBe(-1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("deadlineInfo", () => {
  const today = "2026-07-19";

  it("returns none when there is no deadline", () => {
    expect(deadlineInfo(null, today, "open")).toEqual({ state: "none", days: null });
  });

  it("flags an overdue deadline for actionable statuses", () => {
    expect(deadlineInfo("2026-07-10", today, "open")).toEqual({
      state: "overdue",
      days: -9,
    });
  });

  it("flags a deadline within a week as soon", () => {
    expect(deadlineInfo("2026-07-24", today, "applied").state).toBe("soon");
  });

  it("treats far-off deadlines as upcoming", () => {
    expect(deadlineInfo("2026-09-01", today, "open").state).toBe("upcoming");
  });

  it("does not raise soon/overdue once the market is confirmed", () => {
    expect(deadlineInfo("2026-07-10", today, "confirmed").state).toBe("upcoming");
  });
});

describe("computeYearComparison", () => {
  it("aggregates sales and profit per market, newest year first", () => {
    const markets = [
      { id: "a", date: "2025-08-01", standFee: 2000, travelCost: 500 },
      { id: "b", date: "2026-08-01", standFee: 3000, travelCost: 500 },
    ];
    const sales = {
      a: [{ amount: 1000, quantity: 2 }], // 2000
      b: [
        { amount: 1000, quantity: 3 }, // 3000
        { amount: 500, quantity: 2 }, // 1000
      ],
    };
    const result = computeYearComparison(markets, sales);
    expect(result.map((r) => r.year)).toEqual([2026, 2025]);
    expect(result[0]).toMatchObject({ sales: 4000, profit: 500, salesCount: 2 });
    expect(result[1]).toMatchObject({ sales: 2000, profit: -500, salesCount: 1 });
  });

  it("handles markets with no sales yet", () => {
    const [stat] = computeYearComparison(
      [{ id: "x", date: "2026-01-01", standFee: 1000, travelCost: 0 }],
      {}
    );
    expect(stat.sales).toBe(0);
    expect(stat.profit).toBe(-1000);
  });
});

describe("statusLabel", () => {
  it("localises and falls back to open for unknown status", () => {
    expect(statusLabel("confirmed", true)).toBe("Zugesagt");
    expect(statusLabel("confirmed", false)).toBe("Confirmed");
    expect(statusLabel(null, true)).toBe("Geplant");
    expect(statusLabel("weird", true)).toBe("Geplant");
  });
});

import { describe, it, expect } from "vitest";
import { computeDayClosing, type DaySaleLike } from "@/lib/marketDay";

describe("computeDayClosing", () => {
  it("splits revenue by payment method and applies quantity", () => {
    const sales: DaySaleLike[] = [
      { amount: 500, quantity: 2, paymentMethod: "cash" }, // 1000 cash
      { amount: 1200, quantity: 1, paymentMethod: "card" }, // 1200 card
      { amount: 300, quantity: 3, paymentMethod: "cash" }, // 900 cash
    ];
    const c = computeDayClosing(sales, 2000, 500);
    expect(c.count).toBe(3);
    expect(c.itemCount).toBe(6);
    expect(c.cash).toBe(1900);
    expect(c.card).toBe(1200);
    expect(c.unknown).toBe(0);
    expect(c.total).toBe(3100);
    expect(c.costs).toBe(2500);
    expect(c.profit).toBe(600);
  });

  it("counts sales without a payment method as unknown but still in the total", () => {
    const sales: DaySaleLike[] = [
      { amount: 1000, quantity: 1, paymentMethod: null },
      { amount: 500, quantity: 1, paymentMethod: "card" },
    ];
    const c = computeDayClosing(sales, 0, 0);
    expect(c.unknown).toBe(1000);
    expect(c.card).toBe(500);
    expect(c.cash).toBe(0);
    expect(c.total).toBe(1500);
    // cash + card + unknown always reconciles to total
    expect(c.cash + c.card + c.unknown).toBe(c.total);
  });

  it("handles an empty day (no sales, only costs) as a loss", () => {
    const c = computeDayClosing([], 1500, 800);
    expect(c.total).toBe(0);
    expect(c.count).toBe(0);
    expect(c.profit).toBe(-2300);
  });
});

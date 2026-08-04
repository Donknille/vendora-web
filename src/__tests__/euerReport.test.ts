import { describe, it, expect } from "vitest";
import { computeEuerReport, type EuerInput } from "@/lib/euerReport";
import type { Order, MarketEvent, MarketSale, Expense } from "@/lib/types";

const order = (o: Partial<Order>): Order =>
  ({
    id: "o", userId: "u", customerName: "Kunde", customerEmail: "", customerStreet: "",
    customerZip: "", customerCity: "", customerCountry: "", status: "paid", invoiceNumber: "",
    notes: "", orderDate: "2025-01-01", serviceDate: null, paidAt: null, paymentMethod: null,
    shippingCost: null, total: 0, processingStatus: null, comment: null,
    createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z", items: [], ...o,
  }) as Order;

const market = (m: Partial<MarketEvent>): MarketEvent =>
  ({ id: "m", userId: "u", name: "Markt", date: "2025-07-01", location: "", standFee: 0,
    travelCost: 0, notes: "", status: "open", quickItems: null, createdAt: "2025-07-01T00:00:00Z", ...m }) as MarketEvent;

const sale = (s: Partial<MarketSale>): MarketSale =>
  ({ id: "s", userId: "u", marketId: "m1", description: "Verkauf", amount: 0, quantity: 1,
    createdAt: "2025-07-01T00:00:00Z", ...s }) as MarketSale;

const expense = (e: Partial<Expense>): Expense =>
  ({ id: "e", userId: "u", marketId: null, description: "", amount: 0, category: "sonstiges",
    source: "manual", expenseDate: "2025-01-01", createdAt: "2025-01-01T00:00:00Z", ...e }) as Expense;

describe("computeEuerReport — Zuflussprinzip", () => {
  const input: EuerInput = {
    year: 2025,
    orders: [
      // paidAt (2025) wins over orderDate (2024)
      order({ id: "A", status: "paid", paidAt: "2025-06-15", orderDate: "2024-12-20", total: 10000 }),
      // no paidAt → falls back to orderDate (2025)
      order({ id: "B", status: "delivered", paidAt: null, orderDate: "2025-03-10", total: 5000 }),
      // open → not counted
      order({ id: "C", status: "open", orderDate: "2025-01-01", total: 9999 }),
    ],
    markets: [market({ id: "m1", name: "Sommermarkt", date: "2025-07-01" })],
    marketSales: [
      // bucketed by the market day (2025-07), NOT the createdAt month (2025-08)
      sale({ id: "S1", marketId: "m1", amount: 2000, quantity: 3, createdAt: "2025-08-20T10:00:00Z" }),
      sale({ id: "S2", marketId: "m1", amount: 500, quantity: 1 }),
    ],
    expenses: [
      expense({ id: "E1", category: "fahrtkosten", amount: 1500, expenseDate: "2025-07-01", source: "market_travel", marketId: "m1" }),
      expense({ id: "E2", category: "wareneinkauf_material", amount: 3000, expenseDate: "2025-02-01" }),
      // wrong year → excluded
      expense({ id: "E3", category: "sonstiges", amount: 1000, expenseDate: "2024-05-01" }),
    ],
  };

  const report = computeEuerReport(input);

  it("recognises order income by paidAt, falling back to orderDate", () => {
    // A (10000) + B (5000) contribute; C (open) excluded
    expect(report.incomeByMonth[5]).toBe(10000); // June (paidAt of A)
    expect(report.incomeByMonth[2]).toBe(5000); // March (orderDate of B)
  });

  it("recognises market sales on the market day, not the sale timestamp", () => {
    // S1 = 2000*3, S2 = 500 → 6500 in July
    expect(report.incomeByMonth[6]).toBe(6500);
  });

  it("totals income and expenses correctly and computes the surplus", () => {
    expect(report.incomeTotal).toBe(21500); // 10000 + 5000 + 6000 + 500
    expect(report.expenseTotal).toBe(4500); // 1500 + 3000 (E3 excluded)
    expect(report.surplus).toBe(17000);
  });

  it("groups expenses by category, sorted descending", () => {
    expect(report.expensesByCategory).toEqual([
      { category: "wareneinkauf_material", amount: 3000 },
      { category: "fahrtkosten", amount: 1500 },
    ]);
  });

  it("emits one receipt line per counted item, sorted by date", () => {
    // 2 orders + 2 sales + 2 expenses = 6 (C and E3 excluded)
    expect(report.lines).toHaveLength(6);
    const dates = report.lines.map((l) => l.date);
    expect([...dates]).toEqual([...dates].sort());
  });
});

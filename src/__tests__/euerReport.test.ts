import { describe, it, expect } from "vitest";
import {
  computeEuerReport,
  computeEuerReports,
  aggregateEuerReports,
  euerAvailableYears,
  type EuerInput,
  type EuerData,
} from "@/lib/euerReport";
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

  it("recognises a December order paid in January in the following year", () => {
    const data: EuerData = {
      orders: [order({ id: "D", status: "paid", orderDate: "2024-12-28", paidAt: "2025-01-05", total: 7000 })],
      markets: [],
      marketSales: [],
      expenses: [],
    };
    expect(computeEuerReport({ ...data, year: 2024 }).incomeTotal).toBe(0);
    const y2025 = computeEuerReport({ ...data, year: 2025 });
    expect(y2025.incomeTotal).toBe(7000);
    expect(y2025.incomeByMonth[0]).toBe(7000); // January
  });
});

describe("aggregateEuerReports — mehrere Jahre", () => {
  const data: EuerData = {
    orders: [
      order({ id: "A", status: "paid", paidAt: "2024-07-10", total: 1000 }),
      order({ id: "B", status: "paid", paidAt: "2025-07-10", total: 2000 }),
    ],
    markets: [],
    marketSales: [],
    expenses: [
      expense({ id: "E1", category: "fahrtkosten", amount: 100, expenseDate: "2024-07-15" }),
      expense({ id: "E2", category: "fahrtkosten", amount: 100, expenseDate: "2025-07-15" }),
      expense({ id: "E3", category: "marketing", amount: 150, expenseDate: "2025-03-01" }),
    ],
  };

  it("returns zeros for an empty list", () => {
    const agg = aggregateEuerReports([]);
    expect(agg).toEqual({
      years: [], incomeTotal: 0, expenseTotal: 0, surplus: 0, expensesByCategory: [], months: [],
    });
  });

  it("keeps the same month of different years apart", () => {
    const agg = aggregateEuerReports(computeEuerReports(data, [2024, 2025]));
    const july = agg.months.filter((m) => m.monthIndex === 6);
    expect(july.map((m) => m.key)).toEqual(["2024-07", "2025-07"]);
    expect(july.map((m) => m.income)).toEqual([1000, 2000]);
    expect(july.map((m) => m.expenses)).toEqual([100, 100]);
  });

  it("sums the totals across years and sorts months ascending", () => {
    const agg = aggregateEuerReports(computeEuerReports(data, [2025, 2024]));
    expect(agg.incomeTotal).toBe(3000);
    expect(agg.expenseTotal).toBe(350);
    expect(agg.surplus).toBe(2650);
    expect(agg.years).toEqual([2024, 2025]);
    // only months with movement, ascending
    expect(agg.months.map((m) => m.key)).toEqual(["2024-07", "2025-03", "2025-07"]);
  });

  it("folds categories across years and re-sorts them descending", () => {
    const agg = aggregateEuerReports(computeEuerReports(data, [2024, 2025]));
    expect(agg.expensesByCategory).toEqual([
      { category: "fahrtkosten", amount: 200 }, // 100 + 100 beats the single 150
      { category: "marketing", amount: 150 },
    ]);
  });

  it("matches the single-year report exactly (Dashboard(Jahr) === Steuer(Jahr))", () => {
    const report = computeEuerReport({ ...data, year: 2025 });
    const agg = aggregateEuerReports([report]);
    expect(agg.incomeTotal).toBe(report.incomeTotal);
    expect(agg.expenseTotal).toBe(report.expenseTotal);
    expect(agg.surplus).toBe(report.surplus);
    expect(agg.expensesByCategory).toEqual(report.expensesByCategory);
  });
});

describe("euerAvailableYears", () => {
  it("uses the same dating rules as the report", () => {
    const years = euerAvailableYears({
      // paidAt year counts, orderDate year does not
      orders: [order({ id: "A", status: "paid", orderDate: "2019-12-01", paidAt: "2020-01-05", total: 100 })],
      markets: [market({ id: "m1", date: "2021-07-01" })],
      // market day counts, createdAt year does not
      marketSales: [sale({ marketId: "m1", amount: 100, createdAt: "2022-01-05T00:00:00Z" })],
      expenses: [expense({ expenseDate: "2023-04-01", amount: 100 })],
    });
    expect(years).toEqual([2023, 2021, 2020]);
  });

  it("ignores years that only hold unpaid orders", () => {
    const years = euerAvailableYears({
      orders: [order({ id: "C", status: "open", orderDate: "2018-05-01", total: 100 })],
      markets: [], marketSales: [], expenses: [],
    });
    expect(years).toEqual([]);
  });

  it("always includes includeYear, deduplicated and descending", () => {
    const years = euerAvailableYears(
      {
        orders: [order({ id: "A", status: "paid", paidAt: "2024-01-01", total: 100 })],
        markets: [], marketSales: [],
        expenses: [expense({ expenseDate: "2024-06-01", amount: 50 })],
      },
      { includeYear: 2026 },
    );
    expect(years).toEqual([2026, 2024]);
  });
});

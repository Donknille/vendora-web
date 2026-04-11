import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the Zod schemas from API routes to test validation
const createOrderSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().max(254).default(""),
  customerStreet: z.string().min(1).max(200),
  customerZip: z.string().min(1).max(20),
  customerCity: z.string().min(1).max(100),
  customerCountry: z.string().max(100).default(""),
  status: z.string().max(50).default("open"),
  notes: z.string().max(5000).default(""),
  orderDate: z.string().min(1).max(50),
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(9999),
    price: z.number().min(0).max(999999.99),
  })).min(1).max(100),
});

const createExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().min(0).max(999999.99),
  category: z.string().min(1).max(100),
  expenseDate: z.string().min(1).max(50),
});

describe("Order validation", () => {
  it("accepts valid order", () => {
    const result = createOrderSchema.safeParse({
      customerName: "Max Mustermann",
      customerStreet: "Musterstraße 1",
      customerZip: "12345",
      customerCity: "Berlin",
      orderDate: "2026-04-10",
      items: [{ name: "Ring", quantity: 1, price: 12.5 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects order without customer name", () => {
    const result = createOrderSchema.safeParse({
      customerName: "",
      customerStreet: "Str 1",
      customerZip: "12345",
      customerCity: "Berlin",
      orderDate: "2026-04-10",
      items: [{ name: "Ring", quantity: 1, price: 12 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects order without items", () => {
    const result = createOrderSchema.safeParse({
      customerName: "Max",
      customerStreet: "Str 1",
      customerZip: "12345",
      customerCity: "Berlin",
      orderDate: "2026-04-10",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects price exceeding max", () => {
    const result = createOrderSchema.safeParse({
      customerName: "Max",
      customerStreet: "Str 1",
      customerZip: "12345",
      customerCity: "Berlin",
      orderDate: "2026-04-10",
      items: [{ name: "Ring", quantity: 1, price: 1000000 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects customer name exceeding 200 chars", () => {
    const result = createOrderSchema.safeParse({
      customerName: "A".repeat(201),
      customerStreet: "Str 1",
      customerZip: "12345",
      customerCity: "Berlin",
      orderDate: "2026-04-10",
      items: [{ name: "Ring", quantity: 1, price: 12 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 100 items", () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      name: `Item ${i}`,
      quantity: 1,
      price: 1,
    }));
    const result = createOrderSchema.safeParse({
      customerName: "Max",
      customerStreet: "Str 1",
      customerZip: "12345",
      customerCity: "Berlin",
      orderDate: "2026-04-10",
      items,
    });
    expect(result.success).toBe(false);
  });
});

describe("Expense validation", () => {
  it("accepts valid expense", () => {
    const result = createExpenseSchema.safeParse({
      description: "Materialien",
      amount: 50.99,
      category: "Materials",
      expenseDate: "2026-04-10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects expense without description", () => {
    const result = createExpenseSchema.safeParse({
      description: "",
      amount: 50,
      category: "Materials",
      expenseDate: "2026-04-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = createExpenseSchema.safeParse({
      description: "Test",
      amount: -10,
      category: "Materials",
      expenseDate: "2026-04-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects amount exceeding max", () => {
    const result = createExpenseSchema.safeParse({
      description: "Test",
      amount: 1000000,
      category: "Materials",
      expenseDate: "2026-04-10",
    });
    expect(result.success).toBe(false);
  });
});

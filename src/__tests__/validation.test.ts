import { describe, it, expect } from "vitest";
import { z } from "zod";

// Das Auftragsschema wird aus der Route IMPORTIERT, nicht nachgebaut. Eine
// Kopie driftet unbemerkt ab: sie bestaetigt dann Regeln, die in Produktion
// laengst anders sind.
// Seit Refactoring-Plan 2.2 liegt das Schema in lib/schemas — die Regeln,
// die hier geprueft werden, sind unveraendert.
import { createOrderSchema, MAX_ORDER_TOTAL_CENTS } from "@/lib/schemas/order";

const createExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().int().min(0).max(99999999), // cents
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
      items: [{ name: "Ring", quantity: 1, price: 1250 }],
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
      items: [{ name: "Ring", quantity: 1, price: 100000000 }],
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
      amount: 5099,
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
      amount: 100000000,
      category: "Materials",
      expenseDate: "2026-04-10",
    });
    expect(result.success).toBe(false);
  });
});

describe("Auftragssumme", () => {
  const base = {
    customerName: "Kundin",
    customerStreet: "Weg 1",
    customerZip: "12345",
    customerCity: "Stadt",
    orderDate: "2026-08-01",
  };

  it("weist eine Summe ab, die orders.total sprengen wuerde", () => {
    // Frueher schlug erst Postgres zu (integer-Ueberlauf) und die Nutzerin sah
    // ein generisches 500 statt einer Feldmeldung.
    const result = createOrderSchema.safeParse({
      ...base,
      items: [{ name: "Einzelstueck", quantity: 9999, price: 99999999 }],
    });
    expect(result.success).toBe(false);
  });

  // Der Einzelpreis ist auf 999.999,99 Euro gedeckelt, die Grenze wird also
  // ueber die Menge erreicht: 20 x 99.999.999 = 1.999.999.980 Cent.
  const atLimit = [{ name: "Posten", quantity: 20, price: 99999999 }];

  it("laesst eine Summe knapp unter der Grenze durch", () => {
    expect(20 * 99999999).toBeLessThanOrEqual(MAX_ORDER_TOTAL_CENTS);
    const result = createOrderSchema.safeParse({ ...base, items: atLimit });
    expect(result.success).toBe(true);
  });

  it("rechnet Versandkosten in die Grenze ein", () => {
    const result = createOrderSchema.safeParse({
      ...base,
      shippingCost: 9999999,
      items: [...atLimit, { name: "Rest", quantity: 1, price: 20000 }],
    });
    expect(result.success).toBe(false);
  });
});

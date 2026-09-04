import { describe, it, expect } from "vitest";
import { createOrderSchema, updateOrderSchema } from "@/lib/schemas/order";
import { createExpenseSchema } from "@/lib/schemas/misc";
import { createMarketSchema, updateMarketSchema } from "@/lib/schemas/market";

/**
 * Was die Datenbank per CHECK oder Spaltentyp ablehnt, muss schon Zod
 * ablehnen — sonst wird aus einem Tippfehler ein 500 statt einer
 * Feldmeldung. Mutation zum Rotfahren: `status` in order.ts wieder auf
 * `z.string()` setzen oder `isoDateString` durch `z.string()` ersetzen.
 */
const ORDER = {
  customerName: "Max",
  customerStreet: "Str 1",
  customerZip: "12345",
  customerCity: "Berlin",
  orderDate: "2026-04-10",
  items: [{ name: "Ring", quantity: 1, price: 1250 }],
};

describe("Auftragsschema", () => {
  it("laesst nur die Status aus chk_orders_status durch", () => {
    expect(createOrderSchema.safeParse({ ...ORDER, status: "paid" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...ORDER, status: "foo" }).success).toBe(false);
    expect(updateOrderSchema.safeParse({ status: "erledigt" }).success).toBe(false);
  });

  it("verlangt Tagesdaten als YYYY-MM-DD", () => {
    expect(createOrderSchema.safeParse({ ...ORDER, orderDate: "gestern" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...ORDER, orderDate: "10.04.2026" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...ORDER, paidAt: "2026-04-11" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...ORDER, paidAt: "irgendwann" }).success).toBe(false);
  });

  it("nimmt leere optionale Datumsfelder aus den Formularen an", () => {
    // orders/new schickt serviceDate als "" — das darf keine Feldmeldung geben.
    expect(createOrderSchema.safeParse({ ...ORDER, serviceDate: "" }).success).toBe(true);
    expect(updateOrderSchema.safeParse({ serviceDate: "", paidAt: "" }).success).toBe(true);
  });
});

describe("Ausgaben- und Marktschema", () => {
  it("Ausgabe: Datum als YYYY-MM-DD", () => {
    const base = { description: "Ton", amount: 4000, category: "wareneinkauf_material" };
    expect(createExpenseSchema.safeParse({ ...base, expenseDate: "2026-08-01" }).success).toBe(true);
    expect(createExpenseSchema.safeParse({ ...base, expenseDate: "01.08.2026" }).success).toBe(false);
  });

  it("Markt: Datum und Bewerbungsfrist als YYYY-MM-DD, Frist darf leer sein", () => {
    expect(createMarketSchema.safeParse({ name: "M", date: "2026-12-06" }).success).toBe(true);
    expect(createMarketSchema.safeParse({ name: "M", date: "6.12." }).success).toBe(false);
    expect(createMarketSchema.safeParse({ name: "M", date: "2026-12-06", applicationDeadline: "" }).success).toBe(true);
    expect(createMarketSchema.safeParse({ name: "M", date: "2026-12-06", applicationDeadline: null }).success).toBe(true);
    expect(updateMarketSchema.safeParse({ applicationDeadline: "bald" }).success).toBe(false);
  });
});

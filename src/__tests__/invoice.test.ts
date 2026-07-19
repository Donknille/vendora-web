import { describe, it, expect } from "vitest";
import {
  computeInvoiceTotals,
  buildInvoiceTaxNote,
  buildInvoiceSnapshot,
  buildCancellationSnapshot,
  type InvoiceOrderInput,
  type InvoiceProfileInput,
  type InvoiceLineItem,
} from "@/lib/invoice";

const items: InvoiceLineItem[] = [
  { name: "Kerze", quantity: 3, price: 500 }, // 1500
  { name: "Seife", quantity: 2, price: 250 }, // 500
];

const order = (o: Partial<InvoiceOrderInput> = {}): InvoiceOrderInput => ({
  customerName: "Erika Mustermann",
  customerEmail: "erika@example.com",
  customerStreet: "Marktweg 1",
  customerZip: "10115",
  customerCity: "Berlin",
  customerCountry: "DE",
  serviceDate: "2026-07-10",
  shippingCost: 0,
  notes: "Danke!",
  ...o,
});

const profile = (p: Partial<InvoiceProfileInput> = {}): InvoiceProfileInput => ({
  name: "Vendora Test",
  address: "Standstr. 5\n12345 Musterstadt",
  email: "seller@example.com",
  phone: "0123456789",
  taxNote: "",
  smallBusinessNote: null,
  isSmallBusiness: true,
  ...p,
});

describe("computeInvoiceTotals", () => {
  it("sums line items with quantity and adds shipping (integer cents)", () => {
    expect(computeInvoiceTotals(items, 0)).toEqual({ subtotal: 2000, total: 2000 });
    expect(computeInvoiceTotals(items, 495)).toEqual({ subtotal: 2000, total: 2495 });
  });

  it("returns zero for no items", () => {
    expect(computeInvoiceTotals([], 0)).toEqual({ subtotal: 0, total: 0 });
  });
});

describe("buildInvoiceTaxNote", () => {
  it("emits the §19 hint for small businesses", () => {
    expect(buildInvoiceTaxNote(profile({ isSmallBusiness: true }))).toBe(
      "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."
    );
  });

  it("omits the §19 hint when not a small business", () => {
    expect(buildInvoiceTaxNote(profile({ isSmallBusiness: false }))).toBe("");
  });

  it("appends profile tax notes verbatim", () => {
    const note = buildInvoiceTaxNote(
      profile({ isSmallBusiness: true, taxNote: "USt-IdNr. DE123", smallBusinessNote: "Zahlbar in 14 Tagen" })
    );
    expect(note).toBe(
      "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.\nUSt-IdNr. DE123\nZahlbar in 14 Tagen"
    );
  });

  it("tolerates a null profile", () => {
    expect(buildInvoiceTaxNote(null)).toBe("");
  });
});

describe("buildInvoiceSnapshot", () => {
  it("freezes seller, recipient, positions and amounts", () => {
    const snap = buildInvoiceSnapshot({
      invoiceNumber: "26-001",
      issueDate: "2026-07-19",
      order: order({ shippingCost: 495 }),
      items,
      profile: profile(),
    });

    expect(snap.type).toBe("invoice");
    expect(snap.invoiceNumber).toBe("26-001");
    expect(snap.issueDate).toBe("2026-07-19");
    expect(snap.serviceDate).toBe("2026-07-10");
    expect(snap.cancelsInvoiceId).toBeNull();
    expect(snap.seller.name).toBe("Vendora Test");
    expect(snap.customer.name).toBe("Erika Mustermann");
    expect(snap.customer.city).toBe("Berlin");
    expect(snap.items).toEqual(items);
    expect(snap.subtotal).toBe(2000);
    expect(snap.shippingCost).toBe(495);
    expect(snap.total).toBe(2495);
    expect(snap.isSmallBusiness).toBe(true);
    expect(snap.taxNote).toBe("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.");
    expect(snap.notes).toBe("Danke!");
  });

  it("defaults shipping to 0 when the order has none", () => {
    const snap = buildInvoiceSnapshot({
      invoiceNumber: "26-002",
      issueDate: "2026-07-19",
      order: order({ shippingCost: null }),
      items,
      profile: profile(),
    });
    expect(snap.shippingCost).toBe(0);
    expect(snap.total).toBe(2000);
  });

  it("tolerates a missing profile (empty seller, small-business default)", () => {
    const snap = buildInvoiceSnapshot({
      invoiceNumber: "26-003",
      issueDate: "2026-07-19",
      order: order(),
      items,
      profile: null,
    });
    expect(snap.seller).toEqual({ name: "", address: "", email: "", phone: "" });
    expect(snap.isSmallBusiness).toBe(true);
    expect(snap.taxNote).toBe("");
  });

  it("does not alias the input items array (snapshot immutability)", () => {
    const src: InvoiceLineItem[] = [{ name: "X", quantity: 1, price: 100 }];
    const snap = buildInvoiceSnapshot({
      invoiceNumber: "26-004",
      issueDate: "2026-07-19",
      order: order(),
      items: src,
      profile: profile(),
    });
    src[0].price = 999;
    expect(snap.items[0].price).toBe(100);
  });
});

describe("buildCancellationSnapshot", () => {
  const original = buildInvoiceSnapshot({
    invoiceNumber: "26-010",
    issueDate: "2026-07-19",
    order: order({ shippingCost: 495, notes: "Original-Notiz" }),
    items,
    profile: profile(),
  });

  it("negates every amount and keeps the parties/positions", () => {
    const storno = buildCancellationSnapshot({
      invoiceNumber: "26-011",
      issueDate: "2026-07-20",
      cancelsInvoiceId: "inv-original-id",
      original,
    });

    expect(storno.type).toBe("cancellation");
    expect(storno.invoiceNumber).toBe("26-011");
    expect(storno.issueDate).toBe("2026-07-20");
    expect(storno.cancelsInvoiceId).toBe("inv-original-id");
    expect(storno.subtotal).toBe(-2000);
    expect(storno.shippingCost).toBe(-495);
    expect(storno.total).toBe(-2495);
    expect(storno.items.map((i) => i.price)).toEqual([-500, -250]);
    expect(storno.items.map((i) => i.quantity)).toEqual([3, 2]);
    expect(storno.customer.name).toBe("Erika Mustermann");
    expect(storno.seller.name).toBe("Vendora Test");
  });

  it("references the original number in the notes", () => {
    const storno = buildCancellationSnapshot({
      invoiceNumber: "26-011",
      issueDate: "2026-07-20",
      cancelsInvoiceId: "inv-original-id",
      original,
    });
    expect(storno.notes).toBe("Stornorechnung zu Rechnung 26-010\nOriginal-Notiz");
  });

  it("does not mutate the original snapshot", () => {
    buildCancellationSnapshot({
      invoiceNumber: "26-011",
      issueDate: "2026-07-20",
      cancelsInvoiceId: "inv-original-id",
      original,
    });
    expect(original.total).toBe(2495);
    expect(original.items[0].price).toBe(500);
    expect(original.type).toBe("invoice");
  });
});

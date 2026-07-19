import { describe, it, expect } from "vitest";
import { sanitizeWinAnsi } from "@/lib/server/pdf";
import { buildInvoicePdf, type InvoicePdfInput } from "@/lib/server/invoicePdf";

describe("sanitizeWinAnsi", () => {
  it("keeps ASCII, German umlauts and the euro sign", () => {
    expect(sanitizeWinAnsi("Grüße Öl Straße € 12,34")).toBe("Grüße Öl Straße € 12,34");
  });

  it("transliterates curly quotes, dashes and ellipsis", () => {
    expect(sanitizeWinAnsi("„Test“ – ‘x’ … —")).toBe('"Test" - \'x\' ... -');
  });

  it("replaces characters outside CP1252 with '?'", () => {
    expect(sanitizeWinAnsi("Łódź")).toBe("?ód?"); // Polish Ł / ź not in CP1252
    expect(sanitizeWinAnsi("привет")).toBe("??????"); // Cyrillic
    expect(sanitizeWinAnsi("emoji 🎉")).toBe("emoji ?");
  });

  it("preserves newlines and tabs", () => {
    expect(sanitizeWinAnsi("a\nb\tc")).toBe("a\nb\tc");
  });
});

const invoice = (o: Partial<InvoicePdfInput> = {}): InvoicePdfInput => ({
  type: "invoice",
  invoiceNumber: "26-001",
  issueDate: "2026-07-19",
  serviceDate: "2026-07-10",
  sellerName: "Vendora Test",
  sellerAddress: "Standstr. 5\n12345 Musterstadt",
  sellerEmail: "seller@example.com",
  sellerPhone: "0123456789",
  customerName: "Erika Mustermann",
  customerEmail: "erika@example.com",
  customerStreet: "Marktweg 1",
  customerZip: "10115",
  customerCity: "Berlin",
  customerCountry: "DE",
  items: [
    { name: "Kerze", quantity: 3, price: 500 },
    { name: "Seife", quantity: 2, price: 250 },
  ],
  subtotal: 2000,
  shippingCost: 495,
  total: 2495,
  taxNote: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
  notes: "Danke!",
  ...o,
});

describe("buildInvoicePdf", () => {
  it("produces a valid PDF byte stream", async () => {
    const bytes = await buildInvoicePdf(invoice());
    expect(bytes.length).toBeGreaterThan(200);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("does not throw on non-WinAnsi user input", async () => {
    const bytes = await buildInvoicePdf(
      invoice({
        customerName: "Łukasz 🎉",
        items: [{ name: "Ćevapčići привет", quantity: 1, price: 100 }],
        notes: "„Smart quotes“ — and an em-dash",
      })
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("renders a cancellation invoice with negative amounts", async () => {
    const bytes = await buildInvoicePdf(
      invoice({
        type: "cancellation",
        invoiceNumber: "26-002",
        items: [{ name: "Kerze", quantity: 3, price: -500 }],
        subtotal: -1500,
        shippingCost: 0,
        total: -1500,
      })
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("handles many items across a page break", async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      name: `Artikel ${i + 1}`,
      quantity: 1,
      price: 100,
    }));
    const bytes = await buildInvoicePdf(invoice({ items, subtotal: 6000, total: 6000 }));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

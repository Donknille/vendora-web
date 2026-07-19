import "server-only";
import { createA4Canvas, PdfCanvas, PDF_COLORS } from "./pdf";
import { formatAmountInput } from "@/lib/formatCurrency";

// Structural input for the invoice PDF — satisfied by storage's InvoiceResponse.
// The document is rendered deterministically from this immutable snapshot, so it
// reproduces byte-for-byte on every download (no stored PDF needed).
export interface InvoicePdfInput {
  type: string; // 'invoice' | 'cancellation'
  invoiceNumber: string;
  issueDate: string;
  serviceDate: string | null;
  sellerName: string;
  sellerAddress: string;
  sellerEmail: string;
  sellerPhone: string;
  customerName: string;
  customerEmail: string;
  customerStreet: string;
  customerZip: string;
  customerCity: string;
  customerCountry: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  taxNote: string;
  notes: string;
}

const eur = (cents: number) => `${formatAmountInput(cents)} EUR`;

// Item table column anchors (x). Pos/name are left-aligned; the numeric columns
// are right-aligned at these x positions.
const COL_POS = 50;
const COL_NAME = 78;
const COL_QTY = 360;
const COL_UNIT = 452;
const COL_AMOUNT = 545;

function drawItemHeader(c: PdfCanvas): void {
  c.text("Pos", COL_POS, 9, { bold: true, color: PDF_COLORS.muted });
  c.text("Bezeichnung", COL_NAME, 9, { bold: true, color: PDF_COLORS.muted });
  c.textRight("Menge", COL_QTY, 9, { bold: true, color: PDF_COLORS.muted });
  c.textRight("Einzelpreis", COL_UNIT, 9, { bold: true, color: PDF_COLORS.muted });
  c.textRight("Betrag", COL_AMOUNT, 9, { bold: true, color: PDF_COLORS.muted });
  c.down(6);
  c.hr();
  c.down(16);
}

export async function buildInvoicePdf(invoice: InvoicePdfInput): Promise<Uint8Array> {
  const c = await createA4Canvas(800);
  const isCancellation = invoice.type === "cancellation";

  // ── Header: seller (left) + document meta (right) ──
  c.text(invoice.sellerName || "Vendora", c.left, 20, { bold: true, color: PDF_COLORS.brand });
  c.textRight(isCancellation ? "STORNORECHNUNG" : "RECHNUNG", c.right, 20, { bold: true });
  c.down(22);

  const sellerLines = [
    ...invoice.sellerAddress.split("\n"),
    invoice.sellerEmail,
    invoice.sellerPhone ? `Tel. ${invoice.sellerPhone}` : "",
  ].filter((l) => l.trim() !== "");

  // Right-side meta rows, drawn alongside the seller address block.
  const meta: [string, string][] = [
    ["Rechnungsnr.", invoice.invoiceNumber],
    ["Rechnungsdatum", invoice.issueDate],
    ...(invoice.serviceDate ? ([["Leistungsdatum", invoice.serviceDate]] as [string, string][]) : []),
  ];

  const blockTop = c.y;
  sellerLines.forEach((line, i) => {
    c.y = blockTop - i * 12;
    c.text(line, c.left, 9, { color: PDF_COLORS.muted });
  });
  meta.forEach(([label, value], i) => {
    c.y = blockTop - i * 14;
    c.textRight(`${label}:`, c.right - 90, 10, { color: PDF_COLORS.muted });
    c.textRight(value, c.right, 10, { bold: true });
  });

  c.y = blockTop - Math.max(sellerLines.length * 12, meta.length * 14) - 14;
  c.hr(PDF_COLORS.brand, 1.5);
  c.down(26);

  // ── Recipient ──
  c.text("RECHNUNG AN", c.left, 9, { bold: true, color: PDF_COLORS.brand });
  c.down(16);
  c.text(invoice.customerName, c.left, 13, { bold: true });
  c.down(15);
  const recipientLines = [
    invoice.customerStreet,
    [invoice.customerZip, invoice.customerCity].filter(Boolean).join(" "),
    invoice.customerCountry,
    invoice.customerEmail,
  ].filter((l) => l.trim() !== "");
  for (const line of recipientLines) {
    c.text(line, c.left, 10, { color: PDF_COLORS.muted });
    c.down(13);
  }
  c.down(18);

  // ── Item table ──
  drawItemHeader(c);
  invoice.items.forEach((item, idx) => {
    if (c.y < 90) {
      c.newPage();
      drawItemHeader(c);
    }
    const lineTotal = item.price * item.quantity;
    c.text(String(idx + 1), COL_POS, 10);
    c.text(item.name, COL_NAME, 10);
    c.textRight(String(item.quantity), COL_QTY, 10);
    c.textRight(eur(item.price), COL_UNIT, 10);
    c.textRight(eur(lineTotal), COL_AMOUNT, 10);
    c.down(8);
    c.hr(PDF_COLORS.line, 0.5);
    c.down(14);
  });

  // ── Totals ──
  c.down(8);
  c.textRight("Zwischensumme", COL_UNIT, 10, { color: PDF_COLORS.muted });
  c.textRight(eur(invoice.subtotal), COL_AMOUNT, 10);
  c.down(16);
  if (invoice.shippingCost !== 0) {
    c.textRight("Versandkosten", COL_UNIT, 10, { color: PDF_COLORS.muted });
    c.textRight(eur(invoice.shippingCost), COL_AMOUNT, 10);
    c.down(16);
  }
  c.down(2);
  c.hr(PDF_COLORS.ink, 1);
  c.down(16);
  c.textRight("Gesamtbetrag", COL_UNIT, 13, { bold: true });
  c.textRight(eur(invoice.total), COL_AMOUNT, 13, { bold: true, color: PDF_COLORS.green });
  c.down(30);

  // ── Tax notice ──
  if (invoice.taxNote.trim() !== "") {
    for (const line of invoice.taxNote.split("\n")) {
      c.text(line, c.left, 9, { color: PDF_COLORS.muted });
      c.down(12);
    }
    c.down(10);
  }

  // ── Notes ──
  if (invoice.notes.trim() !== "") {
    c.text("Anmerkungen", c.left, 9, { bold: true, color: PDF_COLORS.muted });
    c.down(13);
    for (const line of invoice.notes.split("\n")) {
      c.text(line, c.left, 9, { color: PDF_COLORS.muted });
      c.down(12);
    }
  }

  return c.save();
}

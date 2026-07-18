import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EuerReport } from "@/lib/euerReport";
import { EUER_CATEGORY_META } from "@/lib/euer";
import { formatAmountInput } from "@/lib/formatCurrency";

export interface EuerExportMeta {
  companyName: string;
  isSmallBusiness: boolean;
  generatedOn: string; // YYYY-MM-DD
}

const KIND_LABEL_DE: Record<string, string> = {
  income_order: "Einnahme (Auftrag)",
  income_market: "Einnahme (Markt)",
  expense: "Ausgabe",
};

function csvCell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// One row per receipt plus a summary block. UTF-8 with BOM so Excel reads umlauts.
export function buildEuerCsv(report: EuerReport, meta: EuerExportMeta): string {
  const rows: string[] = [];
  rows.push(
    csvCell(
      `EÜR ${report.year} – ${meta.companyName}` +
        (meta.isSmallBusiness ? " (Kleinunternehmer § 19 UStG)" : ""),
    ),
  );
  rows.push(csvCell(`Erstellt am ${meta.generatedOn}`));
  rows.push("");
  rows.push(["Datum", "Typ", "Beschreibung", "Kategorie", "Betrag (EUR)"].join(";"));

  for (const line of report.lines) {
    const category = line.category ? EUER_CATEGORY_META[line.category].de : "";
    const amount = (line.kind === "expense" ? "-" : "") + formatAmountInput(line.amount);
    rows.push([line.date, KIND_LABEL_DE[line.kind], line.description, category, amount].map(csvCell).join(";"));
  }

  rows.push("");
  rows.push(["", "", "", "Einnahmen gesamt", formatAmountInput(report.incomeTotal)].map(csvCell).join(";"));
  rows.push(["", "", "", "Ausgaben gesamt", "-" + formatAmountInput(report.expenseTotal)].map(csvCell).join(";"));
  rows.push(["", "", "", "Überschuss", formatAmountInput(report.surplus)].map(csvCell).join(";"));

  return "﻿" + rows.join("\r\n") + "\r\n";
}

// Summary PDF (Gegenüberstellung). Uses only WinAnsi-safe glyphs (no user free
// text), so StandardFonts.Helvetica renders it without embedding a font.
export async function buildEuerPdf(report: EuerReport, meta: EuerExportMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const left = 50;
  const right = 545;
  const ink = rgb(0.12, 0.12, 0.14);
  const muted = rgb(0.42, 0.45, 0.5);
  const green = rgb(0.02, 0.47, 0.34);
  const red = rgb(0.86, 0.15, 0.15);
  let y = 800;

  const eur = (cents: number) => `${formatAmountInput(cents)} EUR`;
  const text = (s: string, x: number, size: number, f = font, color = ink) =>
    page.drawText(s, { x, y, size, font: f, color });
  const textRight = (s: string, x: number, size: number, f = font, color = ink) =>
    page.drawText(s, { x: x - f.widthOfTextAtSize(s, size), y, size, font: f, color });

  text(meta.companyName || "Vendora", left, 20, bold);
  y -= 26;
  text("Einnahmen-Überschuss-Rechnung", left, 15, bold);
  textRight(`Geschäftsjahr ${report.year}`, right, 12, font, muted);
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.5, color: rgb(0, 0.71, 0.65) });
  y -= 30;

  text("Einnahmen (nach Zufluss)", left, 12, bold);
  textRight(eur(report.incomeTotal), right, 12, bold, green);
  y -= 26;

  text("Ausgaben nach Kategorie", left, 12, bold);
  y -= 18;
  if (report.expensesByCategory.length === 0) {
    text("—", left + 10, 10, font, muted);
    y -= 16;
  } else {
    for (const row of report.expensesByCategory) {
      text(EUER_CATEGORY_META[row.category].de, left + 10, 10);
      textRight("-" + eur(row.amount), right, 10);
      y -= 16;
      if (y < 90) break;
    }
  }
  y -= 6;
  text("Ausgaben gesamt", left, 12, bold);
  textRight("-" + eur(report.expenseTotal), right, 12, bold, red);
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: rgb(0.85, 0.86, 0.88) });
  y -= 22;

  text("Überschuss / Gewinn", left, 14, bold);
  textRight(eur(report.surplus), right, 14, bold, report.surplus >= 0 ? green : red);
  y -= 40;

  if (meta.isSmallBusiness) {
    text("Kleinunternehmer nach § 19 UStG — es wird keine Umsatzsteuer ausgewiesen.", left, 9, font, muted);
    y -= 14;
  }
  text(`Erstellt am ${meta.generatedOn} mit Vendora. Ohne Gewähr, keine Steuerberatung.`, left, 9, font, muted);

  return doc.save();
}

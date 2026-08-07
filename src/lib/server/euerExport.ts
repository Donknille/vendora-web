import "server-only";
import { createA4Canvas, PDF_COLORS } from "./pdf";
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

// Ein vom Server erzeugter Geldbetrag: optionales Minus, Tausenderpunkte,
// zwei Nachkommastellen. Diese Zellen sind KEINE Nutzereingabe und muessen
// Zahlen bleiben.
const AMOUNT_CELL = /^-?\d{1,3}(\.\d{3})*,\d{2}$/;

function csvCell(value: string): string {
  // Formel-Schutz: Excel und LibreOffice werten eine Zelle, die mit = + - @
  // oder einem Steuerzeichen beginnt, beim Oeffnen als Formel aus. Dieser
  // Export ist genau dafuer gebaut, an die Steuerkanzlei weitergereicht zu
  // werden, und enthaelt freien Nutzertext (Belegbezeichnung, Firmenname).
  // Ein vorangestelltes Apostroph macht daraus wieder Text.
  //
  // Ausgabenbetraege beginnen aber selbst mit einem Minus. Ohne die Ausnahme
  // wuerde aus "-30,00" ein "'-30,00": in Excel eine TEXT-Zelle, die SUMME()
  // stillschweigend als 0 zaehlt. Die Betragsspalte waere gemischt -- Einnahmen
  // numerisch, Ausgaben Text -- und eine Summe darueber ergaebe einen zu hohen
  // Gewinn. In einem Steuerdokument ist das der schlimmere Fehler.
  const needsGuard = /^[=+\-@\t\r]/.test(value) && !AMOUNT_CELL.test(value);
  const guarded = needsGuard ? `'${value}` : value;
  return /[;"\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
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

// Summary PDF (Gegenüberstellung), rendered via the shared PdfCanvas primitives.
export async function buildEuerPdf(report: EuerReport, meta: EuerExportMeta): Promise<Uint8Array> {
  const c = await createA4Canvas(800);
  const eur = (cents: number) => `${formatAmountInput(cents)} EUR`;

  c.text(meta.companyName || "Vendora", c.left, 20, { bold: true });
  c.down(26);
  c.text("Einnahmen-Überschuss-Rechnung", c.left, 15, { bold: true });
  c.textRight(`Geschäftsjahr ${report.year}`, c.right, 12, { color: PDF_COLORS.muted });
  c.down(8);
  c.hr(PDF_COLORS.brand, 1.5);
  c.down(30);

  c.text("Einnahmen (nach Zufluss)", c.left, 12, { bold: true });
  c.textRight(eur(report.incomeTotal), c.right, 12, { bold: true, color: PDF_COLORS.green });
  c.down(26);

  c.text("Ausgaben nach Kategorie", c.left, 12, { bold: true });
  c.down(18);
  if (report.expensesByCategory.length === 0) {
    c.text("—", c.left + 10, 10, { color: PDF_COLORS.muted });
    c.down(16);
  } else {
    for (const row of report.expensesByCategory) {
      c.text(EUER_CATEGORY_META[row.category].de, c.left + 10, 10);
      c.textRight("-" + eur(row.amount), c.right, 10);
      c.down(16);
      if (c.y < 90) break;
    }
  }
  c.down(6);
  c.text("Ausgaben gesamt", c.left, 12, { bold: true });
  c.textRight("-" + eur(report.expenseTotal), c.right, 12, { bold: true, color: PDF_COLORS.red });
  c.down(10);
  c.hr(PDF_COLORS.line, 1);
  c.down(22);

  c.text("Überschuss / Gewinn", c.left, 14, { bold: true });
  c.textRight(eur(report.surplus), c.right, 14, {
    bold: true,
    color: report.surplus >= 0 ? PDF_COLORS.green : PDF_COLORS.red,
  });
  c.down(40);

  if (meta.isSmallBusiness) {
    c.text("Kleinunternehmer nach § 19 UStG — es wird keine Umsatzsteuer ausgewiesen.", c.left, 9, {
      color: PDF_COLORS.muted,
    });
    c.down(14);
  }
  c.text(`Erstellt am ${meta.generatedOn} mit Vendora. Ohne Gewähr, keine Steuerberatung.`, c.left, 9, {
    color: PDF_COLORS.muted,
  });

  return c.save();
}

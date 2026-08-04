import { describe, it, expect } from "vitest";
import { buildEuerCsv, buildEuerPdf, type EuerExportMeta } from "@/lib/server/euerExport";
import type { EuerReport } from "@/lib/euerReport";

const report: EuerReport = {
  year: 2025,
  incomeTotal: 21500,
  expenseTotal: 4500,
  surplus: 17000,
  incomeByMonth: new Array(12).fill(0),
  expenseByMonth: new Array(12).fill(0),
  expensesByCategory: [
    { category: "wareneinkauf_material", amount: 3000 },
    { category: "fahrtkosten", amount: 1500 },
  ],
  lines: [
    { date: "2025-02-01", kind: "expense", description: "Material XY", category: "wareneinkauf_material", amount: 3000 },
    { date: "2025-03-10", kind: "income_order", description: "25-001 · Kunde", category: null, amount: 5000 },
  ],
};

const meta: EuerExportMeta = { companyName: "Test GmbH", isSmallBusiness: true, generatedOn: "2026-07-18" };

describe("buildEuerCsv", () => {
  const csv = buildEuerCsv(report, meta);

  it("includes a title, receipt rows and a summary block", () => {
    expect(csv).toContain("EÜR 2025 – Test GmbH");
    expect(csv).toContain("Material XY");
    expect(csv).toContain("Wareneinkauf / Material");
    expect(csv).toContain("Einnahmen gesamt");
    expect(csv).toContain("Überschuss");
  });

  it("writes expenses as negative and income as positive", () => {
    expect(csv).toContain("-30,00"); // 3000 cents expense
    expect(csv).toContain("50,00"); // 5000 cents income
    expect(csv).toContain("170,00"); // surplus
  });
});

describe("buildEuerPdf", () => {
  it("produces a valid PDF byte stream", async () => {
    const bytes = await buildEuerPdf(report, meta);
    expect(bytes.length).toBeGreaterThan(200);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

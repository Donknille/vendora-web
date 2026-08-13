import { describe, it, expect } from "vitest";
import { readRoute } from "@/test-utils/sourceScan";

// Source guards in the style of appQuery.test.ts / adminDataBoundary.test.ts.
// The dashboard used to reimplement the booking rules: its own date parsing via
// new Date() (timezone drift), its own paid-status literals, market sales dated
// by insertion time instead of the market day. Three surfaces, three numbers for
// the same year. These guards keep the second implementation from growing back.
//
// Gelesen wird die Route als Einheit — `page.tsx` plus ein etwaiges eigenes
// `_components/`. Sonst genuegte es, die Seite in Abschnitte zu zerlegen, und
// die zweite Buchungslogik koennte in einer Unterkomponente zurueckwachsen,
// ohne dass hier je etwas rot wuerde.
describe("dashboard and /steuer share one booking implementation", () => {
  const DASHBOARD = "app/(app)/dashboard";
  const STEUER = "app/(app)/steuer";
  const read = readRoute;

  it("the dashboard has no private year/month parsing", () => {
    const source = read(DASHBOARD);
    expect(source).not.toMatch(/function\s+yearOf/);
    expect(source).not.toMatch(/function\s+monthKey/);
    expect(source).not.toMatch(/new Date\([^)]+\)\.getFullYear\(\)/);
  });

  it("the dashboard derives its figures from the EÜR report", () => {
    const source = read(DASHBOARD);
    expect(source).toContain("computeEuerReports");
    expect(source).toContain("aggregateEuerReports");
    expect(source).toContain("computeMarketRanking");
  });

  it("the dashboard uses isPaidLike instead of inline status literals", () => {
    const source = read(DASHBOARD);
    expect(source).toContain("isPaidLike");
    expect(source).not.toMatch(/"shipped"/);
    expect(source).not.toMatch(/"delivered"/);
  });

  it("both pages take their year list from the same helper", () => {
    for (const rel of [DASHBOARD, STEUER]) {
      expect(read(rel)).toContain("euerAvailableYears");
    }
    expect(read(STEUER)).not.toMatch(/function\s+yearOf/);
  });

  it("the dashboard no longer renders its own P&L document", () => {
    // It bypassed the Pro gate that /api/euer/export enforces.
    const source = read(DASHBOARD);
    expect(source).not.toContain("window.open");
    expect(source).not.toContain("<!DOCTYPE html>");
  });

  it("both routes actually carry code (an empty read would pass everything)", () => {
    // Selbsttest. Die Haelfte der Zusicherungen hier ist negativ formuliert —
    // gegen einen leeren String sind die alle gruen. Ohne diese Zeile waere
    // eine leergelaufene Lesung nicht von Erfolg zu unterscheiden.
    for (const route of [DASHBOARD, STEUER]) {
      expect(read(route).length, `${route} liefert keinen Quelltext`).toBeGreaterThan(1000);
    }
  });
});

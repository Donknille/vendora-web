import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = path.resolve(__dirname, "..", "..");
const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

// The gate itself is unit-tested in euer.test.ts. What cannot be checked there
// is the wiring — whether the writers actually pass a status — because
// syncMarketExpenses is module-private and there is no test database. These are
// source guards in the style of appQuery.test.ts.
describe("market cost writers pass the status through", () => {
  const storage = read("lib/server/storage.ts");

  /** The body of a call, from `fn(` to its matching close paren. */
  function callWindow(source: string, marker: string, from = 0): string {
    const start = source.indexOf(marker, from);
    expect(start, `${marker} not found`).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = start + marker.length - 1; i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")" && --depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`unbalanced call for ${marker}`);
  }

  it("syncMarketExpenses takes a MarketCostSource (which requires status)", () => {
    expect(storage).toContain("market: MarketCostSource");
  });

  it("its delete is scoped to the owner", () => {
    // CLAUDE.md: every query carries a user_id ownership check.
    const body = storage.slice(storage.indexOf("async function syncMarketExpenses"));
    expect(body.slice(0, body.indexOf("planMarketCostRows"))).toContain("eq(expenses.userId, userId)");
  });

  it("createMarket and updateMarket both hand over a status", () => {
    const first = callWindow(storage, "syncMarketExpenses(tx");
    const second = callWindow(storage, "syncMarketExpenses(tx", storage.indexOf(first) + first.length);
    expect(first).toMatch(/status:/);
    expect(second).toMatch(/status:/);
    expect(first).not.toBe(second);
  });

  it("the backup restore goes through the same gate", () => {
    const route = read("app/api/migrate/route.ts");
    expect(callWindow(route, "planMarketCostRows(")).toMatch(/status:/);
  });
});

// The migration re-derives the cost rows in plain SQL, so marketCosts.ts and
// 0015 hold the same rule in two languages. These keep them from drifting.
describe("migration 0015 mirrors marketCosts.ts", () => {
  const sql = readFileSync(path.join(ROOT, "drizzle", "0015_market_cost_status_gate.sql"), "utf8");

  it("books the same two statuses", () => {
    expect(sql).toContain("'confirmed', 'completed'");
  });

  it("writes the same descriptions, categories and sources", () => {
    expect(sql).toContain("Standgebühr – "); // U+2013, wie in marketCosts.ts
    expect(sql).toContain("Fahrtkosten – ");
    expect(sql).toContain("standgebuehren_raumkosten");
    expect(sql).toContain("'fahrtkosten'");
    expect(sql).toContain("market_fee");
    expect(sql).toContain("market_travel");
    expect(sql).toContain("200"); // dieselbe Kappung wie .slice(0, 200)
  });

  it("backfills past markets before re-deriving", () => {
    expect(sql.indexOf("SET \"status\" = 'completed'")).toBeLessThan(sql.indexOf("INSERT INTO"));
    expect(sql).toContain("--> statement-breakpoint");
  });

  it("is registered in the drizzle journal", () => {
    // Ohne Journal-Eintrag wendet drizzle-kit die Datei nie an — und niemand
    // merkt es, weil migrate trotzdem gruen durchlaeuft.
    const journal = readFileSync(path.join(ROOT, "drizzle", "meta", "_journal.json"), "utf8");
    expect(journal).toContain("0015_market_cost_status_gate");
  });
});

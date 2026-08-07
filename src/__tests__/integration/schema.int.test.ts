import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, type TestDb } from "@/test-utils/testDb";

/**
 * Rauchtest der Harness: laufen die versionierten Migrationen von 0000 bis zur
 * neuesten sauber durch? Das ist selbst schon eine Zusage — bisher konnte eine
 * kaputte Migration erst beim Deploy auffallen.
 */
describe("Migrationen gegen echtes Postgres", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 60_000);

  it("erzeugt alle Anwendungstabellen", async () => {
    const rows = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables where table_schema = 'public'
    `);
    const names = rows.rows.map((r) => r.table_name);

    for (const expected of [
      "users", "orders", "order_items", "customers", "invoices",
      "market_events", "market_sales", "expenses", "company_profiles",
      "euer_exports", "invoice_counters", "webhook_events", "admin_audit_log",
      "user", "session", "account", "verification",
    ]) {
      expect(names, `Tabelle ${expected} fehlt`).toContain(expected);
    }
  });

  it("hat deleted_at nicht mehr — Migration 0016 ist wirksam", async () => {
    const rows = await db.execute<{ column_name: string }>(sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'users'
    `);
    expect(rows.rows.map((r) => r.column_name)).not.toContain("deleted_at");
  });

  it("erzwingt die Idempotenz der Offline-Queue auf DB-Ebene", async () => {
    // Der Unique-Index ist die eigentliche Absicherung gegen Doppelbuchungen —
    // nicht der Anwendungscode. Er muss existieren.
    const rows = await db.execute<{ indexdef: string }>(sql`
      select indexdef from pg_indexes
      where tablename = 'market_sales' and indexdef ilike '%unique%'
    `);
    const defs = rows.rows.map((r) => r.indexdef.toLowerCase());
    expect(defs.some((d) => d.includes("user_id") && d.includes("client_id"))).toBe(true);
  });
});

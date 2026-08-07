// In-Memory-Postgres für Integrationstests.
//
// Bis hierher liefen alle Tests gegen Mocks: sie prüfen, ob eine Route ihre
// Storage-Funktion richtig aufruft, nicht ob die Query das Richtige tut. Genau
// dort sitzen aber die Zusagen, die dieses Produkt tragen muss — Ownership,
// Rechnungs-Immutabilität, Idempotenz der Offline-Queue, vollständige
// Kontolöschung. Die prüft man nur gegen echtes Postgres.
//
// PGlite ist echtes Postgres (WASM), braucht aber weder Docker noch Server. Die
// Datenbank entsteht aus DENSELBEN Migrationen wie Produktion (drizzle/), nicht
// aus einem separaten Test-Schema — sonst testet man ein Schema, das es nirgends
// gibt, und eine fehlerhafte Migration fällt niemandem auf.

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";
import * as schema from "@/lib/server/schema";
import * as authSchema from "@/lib/server/auth-schema";

export type TestDb = PgliteDatabase<typeof schema & typeof authSchema>;

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/** Frische Datenbank auf dem Migrationsstand des Repos. */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema: { ...schema, ...authSchema } });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as TestDb;
}

/**
 * Leert alle Anwendungstabellen zwischen Tests. TRUNCATE ... CASCADE statt
 * Neuaufbau: eine Migration von Grund auf dauert pro Test zu lange.
 */
export async function resetTestDb(db: TestDb): Promise<void> {
  await db.execute(sql`
    truncate table
      "invoices", "invoice_counters", "euer_exports", "expenses",
      "market_sales", "market_events", "order_items", "orders",
      "customers", "company_profiles", "webhook_events", "admin_audit_log",
      "session", "account", "verification", "users", "user"
    restart identity cascade
  `);
}

/**
 * Legt ein vollständiges Konto an: Better-Auth-Identität plus App-Profil mit
 * derselben id — so, wie es der Provisioning-Hook in Produktion tut.
 */
export async function seedUser(
  db: TestDb,
  id: string,
  email: string,
  overrides: Partial<typeof schema.users.$inferInsert> = {},
): Promise<string> {
  await db.insert(authSchema.user).values({
    id,
    name: email.split("@")[0],
    email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(schema.users).values({
    id,
    email,
    plan: "pro",
    subscriptionStatus: "active",
    subscriptionExpiresAt: new Date(Date.now() + 30 * 86_400_000),
    ...overrides,
  });
  return id;
}

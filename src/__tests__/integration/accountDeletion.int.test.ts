import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, resetTestDb, seedUser, type TestDb } from "@/test-utils/testDb";

/**
 * Kontolöschung über den echten Pfad (`deleteAccount`), gegen echtes Postgres.
 *
 * `storage.int.test.ts` prüft die Geschäftsdaten. Hier geht es um das, was
 * NEBEN den Geschäftsdaten hängen bleibt: Better Auths `verification`-Tabelle
 * hat keinen Fremdschlüssel auf `user` — Reset- und Bestätigungs-Token tragen
 * die E-Mail als `identifier` bzw. die User-ID als `value` und überlebten die
 * Löschung, samt der Adresse, die Art. 17 DSGVO beseitigen soll.
 */

const holder = vi.hoisted(() => ({ current: null as unknown as TestDb }));

vi.mock("@/lib/server/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) => {
        const real = holder.current as unknown as Record<string | symbol, unknown>;
        const value = real[prop];
        return typeof value === "function" ? value.bind(real) : value;
      },
    },
  ),
}));

const stripeCalls = vi.hoisted(() => ({ deletedCustomers: [] as string[] }));
vi.mock("@/lib/server/stripe", () => ({
  getStripe: () => ({
    customers: {
      del: async (id: string) => {
        stripeCalls.deletedCustomers.push(id);
        return { id, deleted: true };
      },
    },
  }),
}));

import { deleteAccount } from "@/lib/server/accountDeletion";
import { verification } from "@/lib/server/auth-schema";

const ANNA = "user-anna";
const BEN = "user-ben";

describe("Kontolöschung (Art. 17 DSGVO)", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    holder.current = db;
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb(db);
    stripeCalls.deletedCustomers.length = 0;
    await seedUser(db, ANNA, "anna@example.com", { stripeCustomerId: "cus_anna" });
    await seedUser(db, BEN, "ben@example.com");
  });

  it("räumt Verifizierungs- und Reset-Token des Kontos mit ab", async () => {
    // Mutation zum Rotfahren: das `tx.delete(verification)` in
    // accountDeletion.ts entfernen — die beiden Anna-Zeilen bleiben stehen.
    const expiresAt = new Date(Date.now() + 3_600_000);
    await db.insert(verification).values([
      { id: "v1", identifier: "anna@example.com", value: "token-email", expiresAt },
      { id: "v2", identifier: "reset-password:tok", value: ANNA, expiresAt },
      { id: "v3", identifier: "ben@example.com", value: "token-ben", expiresAt },
    ]);

    const result = await deleteAccount(ANNA);
    expect(result).toEqual({ ok: true });

    const { rows } = await db.execute<{ id: string }>(sql`select id from verification order by id`);
    expect(rows.map((r) => r.id)).toEqual(["v3"]);
  });

  it("entfernt Profil und Better-Auth-Identität und kündigt den Stripe-Kunden", async () => {
    const result = await deleteAccount(ANNA);
    expect(result).toEqual({ ok: true });
    expect(stripeCalls.deletedCustomers).toEqual(["cus_anna"]);

    const users = await db.execute<{ id: string }>(sql`select id from users order by id`);
    expect(users.rows.map((r) => r.id)).toEqual([BEN]);
    const auth = await db.execute<{ id: string }>(sql`select id from "user" order by id`);
    expect(auth.rows.map((r) => r.id)).toEqual([BEN]);
  });

  it("meldet ein unbekanntes Konto statt still zu bestehen", async () => {
    expect(await deleteAccount("niemand")).toEqual({ ok: false, reason: "not_found" });
  });
});

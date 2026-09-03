import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, resetTestDb, seedUser, type TestDb } from "@/test-utils/testDb";

/**
 * Admin-Datenzugriff gegen echtes Postgres.
 *
 * Zwei Regressionen:
 *  - Der Plan-Filter der Nutzerliste lief NACH der Paginierung über die
 *    bereits geschnittene Seite; `total` blieb ungefiltert und Treffer auf
 *    späteren Seiten waren unerreichbar.
 *  - `revoke_pro` schrieb nur die DB-Spalten. Das Stripe-Abo lief weiter, und
 *    die nächste Zahlung setzte das Konto per Webhook wieder auf Pro.
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

const stripeCalls = vi.hoisted(() => ({ cancelled: [] as string[], fail: false }));
vi.mock("@/lib/server/stripe", () => ({
  getStripe: () => ({
    subscriptions: {
      cancel: async (id: string) => {
        if (stripeCalls.fail) throw new Error("stripe down");
        stripeCalls.cancelled.push(id);
        return { id, status: "canceled" };
      },
    },
  }),
}));

import { applyAdminAction, listUsers } from "@/lib/server/adminData";
import { users } from "@/lib/server/schema";

const ADMIN = { userId: "user-admin", email: "admin@example.com" };
const DAY = 86_400_000;

describe("adminData gegen echtes Postgres", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    holder.current = db;
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb(db);
    stripeCalls.cancelled.length = 0;
    stripeCalls.fail = false;
    await seedUser(db, ADMIN.userId, ADMIN.email);
  });

  describe("listUsers mit Plan-Filter", () => {
    it("filtert vor der Paginierung und zählt nur die Treffer", async () => {
      // Mutation zum Rotfahren: den Plan-Filter wieder hinter `rows.map`
      // ziehen — Seite 1 enthält dann Free-Konten, `total` zählt alle.
      for (let i = 0; i < 3; i++) {
        await seedUser(db, `pro-${i}`, `pro${i}@example.com`);
      }
      for (let i = 0; i < 4; i++) {
        await seedUser(db, `free-${i}`, `free${i}@example.com`, {
          plan: "free",
          subscriptionStatus: "expired",
          subscriptionExpiresAt: null,
          trialEndsAt: new Date(Date.now() - DAY),
        });
      }
      await seedUser(db, "trial-1", "trial@example.com", {
        plan: "free",
        subscriptionStatus: "trial",
        subscriptionExpiresAt: null,
        trialEndsAt: new Date(Date.now() + 10 * DAY),
      });

      const page1 = await listUsers({ plan: "pro", pageSize: 2, page: 1 });
      expect(page1.total).toBe(4); // 3 pro-* plus das Admin-Konto (seedUser = pro)
      expect(page1.users).toHaveLength(2);
      expect(page1.users.every((u) => u.plan === "pro")).toBe(true);

      const page2 = await listUsers({ plan: "pro", pageSize: 2, page: 2 });
      expect(page2.users).toHaveLength(2);
      expect(page2.users.every((u) => u.plan === "pro")).toBe(true);

      const free = await listUsers({ plan: "free" });
      expect(free.total).toBe(4);
      expect(free.users.every((u) => u.plan === "free")).toBe(true);

      const trial = await listUsers({ plan: "trial" });
      expect(trial.total).toBe(1);
      expect(trial.users[0].id).toBe("trial-1");
    });

    it("stuft ein abgelaufenes Pro-Abo in SQL genauso ein wie getEffectivePlan", async () => {
      await seedUser(db, "lapsed", "lapsed@example.com", {
        plan: "pro",
        subscriptionExpiresAt: new Date(Date.now() - DAY),
        trialEndsAt: null,
      });
      const pro = await listUsers({ plan: "pro" });
      expect(pro.users.map((u) => u.id)).not.toContain("lapsed");
      const free = await listUsers({ plan: "free" });
      expect(free.users.map((u) => u.id)).toContain("lapsed");
    });
  });

  describe("revoke_pro", () => {
    it("kündigt das Stripe-Abo und löscht Ablauf und Abo-ID", async () => {
      // Mutation zum Rotfahren: den Stripe-Aufruf und die beiden `null`-Felder
      // aus dem revoke_pro-Zweig entfernen.
      await seedUser(db, "paying", "paying@example.com", { stripeSubscriptionId: "sub_123" });

      const result = await applyAdminAction(ADMIN, "paying", { action: "revoke_pro" });
      expect(result.ok).toBe(true);
      expect(stripeCalls.cancelled).toEqual(["sub_123"]);

      const [row] = await db.select().from(users).where(eq(users.id, "paying"));
      expect(row.plan).toBe("free");
      expect(row.subscriptionStatus).toBe("cancelled");
      expect(row.subscriptionExpiresAt).toBeNull();
      expect(row.stripeSubscriptionId).toBeNull();
    });

    it("lässt das Konto unangetastet, wenn Stripe die Kündigung verweigert", async () => {
      await seedUser(db, "paying", "paying@example.com", { stripeSubscriptionId: "sub_123" });
      stripeCalls.fail = true;

      const result = await applyAdminAction(ADMIN, "paying", { action: "revoke_pro" });
      expect(result).toEqual({ ok: false, reason: "stripe_failed" });

      const [row] = await db.select().from(users).where(eq(users.id, "paying"));
      expect(row.plan).toBe("pro");
      expect(row.stripeSubscriptionId).toBe("sub_123");
    });

    it("kommt ohne Stripe aus, wenn kein Abo hinterlegt ist (manuell vergebenes Pro)", async () => {
      await seedUser(db, "granted", "granted@example.com");
      const result = await applyAdminAction(ADMIN, "granted", { action: "revoke_pro" });
      expect(result.ok).toBe(true);
      expect(stripeCalls.cancelled).toEqual([]);
    });
  });
});

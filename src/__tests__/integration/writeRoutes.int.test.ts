import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createTestDb, resetTestDb, seedUser, type TestDb } from "@/test-utils/testDb";

/**
 * Die Schreibrouten ueber HTTP gegen echtes Postgres: Happy Path, Free-Gate
 * (403 PRO_REQUIRED), fremde Ressource (404), Storno-Route, EUeR-Freischaltung
 * und die Kontoloeschung als Route. Bisher hatten diese Pfade nur den
 * generischen 401-Vertrag.
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

const authState = { userId: "user-pro" as string | null };
vi.mock("@/lib/server/auth", () => ({
  getAuthUserId: async () => authState.userId,
}));

vi.mock("@/lib/server/stripe", () => ({
  getStripe: () => ({ customers: { del: async () => ({ deleted: true }) } }),
}));

import * as storage from "@/lib/server/storage";
import { POST as postOrder } from "@/app/api/orders/route";
import { POST as postMarket } from "@/app/api/markets/route";
import { POST as postExpense } from "@/app/api/expenses/route";
import { POST as cancelInvoice } from "@/app/api/invoices/[id]/cancel/route";
import { GET as euerExport } from "@/app/api/euer/export/route";
import { DELETE as deleteAccount } from "@/app/api/account/route";

const PRO = "user-pro";
const FREE = "user-free";
const DAY = 86_400_000;

const PROFILE = {
  name: "Annas Keramik",
  address: "Toepferweg 1, 12345 Musterstadt",
  email: "anna@example.com",
  phone: "",
  taxNote: "",
};

const ORDER = {
  customerName: "Kundin",
  customerStreet: "Weg 1",
  customerZip: "12345",
  customerCity: "Stadt",
  orderDate: "2026-08-01",
  items: [{ name: "Schale", quantity: 1, price: 2500 }],
};

function post(handler: (r: Request) => Promise<Response>, path: string, body: unknown) {
  return handler(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("Schreibrouten gegen echtes Postgres", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    holder.current = db;
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb(db);
    await seedUser(db, PRO, "pro@example.com");
    await seedUser(db, FREE, "free@example.com", {
      plan: "free",
      subscriptionStatus: "expired",
      subscriptionExpiresAt: null,
      trialEndsAt: new Date(Date.now() - DAY),
    });
    authState.userId = PRO;
  });

  describe("POST /api/orders, /api/markets, /api/expenses", () => {
    it("legt fuer ein Pro-Konto an (201) und speichert user-scoped", async () => {
      const res = await post(postOrder, "/api/orders", ORDER);
      expect(res.status).toBe(201);
      const order = await res.json();
      expect(order.total).toBe(2500);
      expect(await storage.getOrders(PRO)).toHaveLength(1);
      expect(await storage.getOrders(FREE)).toHaveLength(0);

      const m = await post(postMarket, "/api/markets", { name: "Markt", date: "2026-12-06", status: "confirmed", standFee: 1000 });
      expect(m.status).toBe(201);
      const e = await post(postExpense, "/api/expenses", {
        description: "Ton", amount: 4000, category: "wareneinkauf_material", expenseDate: "2026-08-01",
      });
      expect(e.status).toBe(201);
    });

    it("weist ein Free-Konto mit 403 PRO_REQUIRED ab, ohne etwas anzulegen", async () => {
      // Mutation zum Rotfahren: requireWriteAccess in orders/route.ts entfernen.
      authState.userId = FREE;
      for (const [handler, path, body] of [
        [postOrder, "/api/orders", ORDER],
        [postMarket, "/api/markets", { name: "Markt", date: "2026-12-06" }],
        [postExpense, "/api/expenses", { description: "Ton", amount: 1, category: "sonstiges", expenseDate: "2026-08-01" }],
      ] as const) {
        const res = await post(handler as (r: Request) => Promise<Response>, path, body);
        expect(res.status, path).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ code: "PRO_REQUIRED" });
      }
      expect(await storage.getOrders(FREE)).toHaveLength(0);
      expect(await storage.getMarkets(FREE)).toHaveLength(0);
      expect(await storage.getExpenses(FREE)).toHaveLength(0);
    });

    it("antwortet 400 mit Feldfehlern statt 500 auf unbekannten Status", async () => {
      const res = await post(postOrder, "/api/orders", { ...ORDER, status: "erledigt" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.errors.status).toBeDefined();
    });
  });

  describe("POST /api/invoices/[id]/cancel", () => {
    async function issued(userId: string) {
      await storage.upsertProfile(userId, PROFILE);
      const order = await storage.createOrder(userId, { ...ORDER, customerEmail: "", status: "open", notes: "" });
      const result = await storage.issueInvoice(userId, order.id);
      if (!result.ok) throw new Error(result.code);
      return result.invoice;
    }
    const call = (id: string) =>
      cancelInvoice(new Request(`http://localhost/api/invoices/${id}/cancel`, { method: "POST" }), {
        params: Promise.resolve({ id }),
      });

    it("storniert die eigene Rechnung und liefert beide Belege", async () => {
      const inv = await issued(PRO);
      const res = await call(inv.id);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.cancellation.total).toBe(-2500);
      expect(body.original.status).toBe("cancelled");
    });

    it("bleibt auch fuer ein Free-Konto offen (Korrektur ist Pflicht, kein Feature)", async () => {
      const inv = await issued(FREE);
      authState.userId = FREE;
      expect((await call(inv.id)).status).toBe(200);
    });

    it("fremde Rechnung: 404, zweiter Storno: 409 NOT_CANCELLABLE", async () => {
      const inv = await issued(FREE);
      // Mutation zum Rotfahren: den Ownership-Filter in cancelInvoice entfernen.
      expect((await call(inv.id)).status).toBe(404);

      authState.userId = FREE;
      expect((await call(inv.id)).status).toBe(200);
      const again = await call(inv.id);
      expect(again.status).toBe(409);
      await expect(again.json()).resolves.toMatchObject({ code: "NOT_CANCELLABLE" });
    });
  });

  describe("GET /api/euer/export", () => {
    const get = (year: number) =>
      euerExport(new Request(`http://localhost/api/euer/export?year=${year}&format=csv`));

    it("Pro exportiert und schaltet das Jahr frei", async () => {
      const res = await get(2026);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      expect(await storage.hasEuerExport(PRO, 2026)).toBe(true);
    });

    it("Free bekommt ein neues Jahr nicht, ein frueher erzeugtes weiterhin", async () => {
      // Mutation zum Rotfahren: canExportYear in der Route durch `true` ersetzen.
      authState.userId = FREE;
      const locked = await get(2026);
      expect(locked.status).toBe(403);
      await expect(locked.json()).resolves.toMatchObject({ code: "PRO_REQUIRED" });

      await storage.recordEuerExport(FREE, 2025);
      expect((await get(2025)).status).toBe(200);
      // Der Free-Export darf keine weitere Freischaltung erzeugen.
      expect(await storage.hasEuerExport(FREE, 2026)).toBe(false);
    });
  });

  describe("DELETE /api/account", () => {
    it("loescht das Konto ueber die Route und laesst andere Konten stehen", async () => {
      await storage.createOrder(PRO, { ...ORDER, customerEmail: "", status: "open", notes: "" });
      const res = await deleteAccount(new Request("http://localhost/api/account", { method: "DELETE" }));
      expect(res.status).toBe(200);
      expect(await storage.getUser(PRO)).toBeUndefined();
      expect(await storage.getUser(FREE)).toBeDefined();
    });

    it("antwortet 404, wenn es das Konto nicht (mehr) gibt", async () => {
      authState.userId = "niemand";
      const res = await deleteAccount(new Request("http://localhost/api/account", { method: "DELETE" }));
      expect(res.status).toBe(404);
    });
  });
});

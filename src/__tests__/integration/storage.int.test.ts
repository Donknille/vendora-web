import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createTestDb, resetTestDb, seedUser, type TestDb } from "@/test-utils/testDb";

/**
 * Integrationstests gegen echtes Postgres (PGlite) für die Zusagen, die dieses
 * Produkt tragen muss. Mocks können sie nicht prüfen: sie bestätigen nur, dass
 * eine Funktion aufgerufen wurde, nicht dass die Query das Richtige tut.
 *
 * Geprüft werden: Mandantentrennung, Rechnungs-Immutabilität nach GoBD,
 * Idempotenz der Offline-Queue und die Vollständigkeit der Kontolöschung.
 */

// Der Holder existiert vor den Modul-Mocks; die echte Verbindung entsteht erst
// in beforeAll. Der Proxy reicht jeden Zugriff an die dann fertige Instanz weiter.
const holder = vi.hoisted(() => ({ current: null as unknown as TestDb }));

vi.mock("@/lib/server/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_target, prop) => {
        const real = holder.current as unknown as Record<string | symbol, unknown>;
        const value = real[prop];
        return typeof value === "function" ? value.bind(real) : value;
      },
    },
  ),
}));

import * as storage from "@/lib/server/storage";

const ANNA = "user-anna";
const BEN = "user-ben";

const ORDER_INPUT = {
  customerName: "Kundin Klein",
  customerEmail: "kundin@example.com",
  customerStreet: "Marktweg 3",
  customerZip: "12345",
  customerCity: "Musterstadt",
  status: "open",
  notes: "",
  orderDate: "2026-08-01",
  items: [{ name: "Keramikschale", quantity: 2, price: 2500 }],
};

const PROFILE_INPUT = {
  name: "Annas Keramik",
  address: "Töpferweg 1, 12345 Musterstadt",
  email: "anna@example.com",
  phone: "",
  taxNote: "Gem. § 19 UStG wird keine Umsatzsteuer berechnet.",
  smallBusinessNote: "",
  isSmallBusiness: true,
  defaultShippingCost: 0,
};

describe("Storage gegen echtes Postgres", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    holder.current = db;
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb(db);
    await seedUser(db, ANNA, "anna@example.com");
    await seedUser(db, BEN, "ben@example.com");
  });

  // ── Mandantentrennung ────────────────────────────────────

  describe("Mandantentrennung", () => {
    it("gibt fremde Aufträge weder heraus noch löscht sie", async () => {
      const order = await storage.createOrder(ANNA, ORDER_INPUT);

      expect(await storage.getOrder(BEN, order.id)).toBeUndefined();
      expect(await storage.getOrders(BEN)).toHaveLength(0);

      // Löschen muss scheitern UND die Zeile stehen lassen.
      expect(await storage.deleteOrder(BEN, order.id)).toBe(false);
      expect(await storage.getOrder(ANNA, order.id)).toBeDefined();
    });

    it("gibt fremde Märkte und Verkäufe nicht heraus", async () => {
      const market = await storage.createMarket(ANNA, {
        name: "Weihnachtsmarkt",
        date: "2026-12-06",
        location: "Rathausplatz",
        standFee: 8000,
        travelCost: 2500,
        notes: "",
        status: "confirmed",
      });
      await storage.createMarketSale(ANNA, {
        marketId: market.id,
        description: "Schale",
        amount: 2500,
        quantity: 1,
      });

      expect(await storage.getMarket(BEN, market.id)).toBeUndefined();
      expect(await storage.getMarketSales(BEN, market.id)).toHaveLength(0);
      expect(await storage.deleteMarket(BEN, market.id)).toBe(false);
      expect(await storage.getMarket(ANNA, market.id)).toBeDefined();
    });

    it("hält Rechnungsnummern je Konto getrennt", async () => {
      await storage.upsertProfile(ANNA, PROFILE_INPUT);
      await storage.upsertProfile(BEN, { ...PROFILE_INPUT, name: "Bens Holzwerk" });

      const a = await storage.createOrder(ANNA, ORDER_INPUT);
      const b = await storage.createOrder(BEN, ORDER_INPUT);

      const invA = await storage.issueInvoice(ANNA, a.id);
      const invB = await storage.issueInvoice(BEN, b.id);

      expect(invA.ok && invB.ok).toBe(true);
      if (!invA.ok || !invB.ok) return;
      // Beide fangen bei ihrer eigenen 1 an — der Zähler ist user-scoped.
      expect(invA.invoice.invoiceNumber).toBe(invB.invoice.invoiceNumber);
      expect(await storage.getInvoices(BEN)).toHaveLength(1);
    });
  });

  // ── Rechnungs-Immutabilität (GoBD) ───────────────────────

  describe("Rechnungs-Immutabilität", () => {
    it("lässt eine ausgestellte Rechnung unverändert, wenn der Auftrag sich ändert", async () => {
      await storage.upsertProfile(ANNA, PROFILE_INPUT);
      const order = await storage.createOrder(ANNA, ORDER_INPUT);
      const issued = await storage.issueInvoice(ANNA, order.id);
      expect(issued.ok).toBe(true);
      if (!issued.ok) return;

      const before = await storage.getInvoice(ANNA, issued.invoice.id);

      await storage.updateOrder(ANNA, order.id, {
        ...ORDER_INPUT,
        customerName: "Ganz andere Kundin",
        items: [{ name: "Teures Einzelstück", quantity: 9, price: 99900 }],
      });

      const after = await storage.getInvoice(ANNA, issued.invoice.id);
      expect(after).toEqual(before);
      expect(after?.customerName).toBe(ORDER_INPUT.customerName);
      expect(after?.total).toBe(2 * 2500);
    });

    it("stellt keine zweite Rechnung zum selben Auftrag aus", async () => {
      await storage.upsertProfile(ANNA, PROFILE_INPUT);
      const order = await storage.createOrder(ANNA, ORDER_INPUT);
      expect((await storage.issueInvoice(ANNA, order.id)).ok).toBe(true);

      const second = await storage.issueInvoice(ANNA, order.id);
      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.code).toBe("already_issued");
      expect(await storage.getInvoices(ANNA)).toHaveLength(1);
    });

    it("verweigert die Rechnung ohne Firmenname und Anschrift (§ 14 Abs. 4 UStG)", async () => {
      const order = await storage.createOrder(ANNA, ORDER_INPUT);
      const result = await storage.issueInvoice(ANNA, order.id);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("profile_incomplete");
    });

    it("korrigiert nur per Storno: neue Nummer, negativer Betrag, Original bleibt", async () => {
      await storage.upsertProfile(ANNA, PROFILE_INPUT);
      const order = await storage.createOrder(ANNA, ORDER_INPUT);
      const issued = await storage.issueInvoice(ANNA, order.id);
      expect(issued.ok).toBe(true);
      if (!issued.ok) return;

      const cancelled = await storage.cancelInvoice(ANNA, issued.invoice.id);
      expect(cancelled.ok).toBe(true);
      if (!cancelled.ok) return;

      const storno = cancelled.cancellation;
      expect(storno.total).toBe(-issued.invoice.total);
      expect(storno.invoiceNumber).not.toBe(issued.invoice.invoiceNumber);

      // Das Original bleibt als Beleg erhalten, nur sein Status wandert.
      const original = await storage.getInvoice(ANNA, issued.invoice.id);
      expect(original).toBeDefined();
      expect(original?.total).toBe(issued.invoice.total);
      expect(original?.status).toBe("cancelled");
    });

    it("lässt fremde Rechnungen nicht stornieren", async () => {
      await storage.upsertProfile(ANNA, PROFILE_INPUT);
      const order = await storage.createOrder(ANNA, ORDER_INPUT);
      const issued = await storage.issueInvoice(ANNA, order.id);
      if (!issued.ok) return;

      const attempt = await storage.cancelInvoice(BEN, issued.invoice.id);
      expect(attempt.ok).toBe(false);
      expect((await storage.getInvoice(ANNA, issued.invoice.id))?.status).toBe("issued");
    });
  });

  // ── Offline-Queue ────────────────────────────────────────

  describe("Idempotenz der Offline-Verkäufe", () => {
    const sale = (clientId: string) => ({
      clientId,
      description: "Schale",
      amount: 2500,
      quantity: 1,
      paymentMethod: "cash" as const,
    });

    it("bucht denselben Verkauf auch nach mehrfachem Sync genau einmal", async () => {
      const market = await storage.createMarket(ANNA, {
        name: "Wochenmarkt", date: "2026-08-01", location: "", standFee: 0,
        travelCost: 0, notes: "", status: "confirmed",
      });
      const entries = [sale("11111111-1111-4111-8111-111111111111"), sale("22222222-2222-4222-8222-222222222222")];

      const first = await storage.upsertMarketSalesBatch(ANNA, market.id, entries);
      const second = await storage.upsertMarketSalesBatch(ANNA, market.id, entries);

      expect(first).toHaveLength(2);
      // Der zweite Sync liefert dieselben Zeilen zurück, legt aber keine neuen an.
      expect(second).toHaveLength(2);
      expect(second.map((r) => r.id).sort()).toEqual(first.map((r) => r.id).sort());
      expect(await storage.getMarketSales(ANNA, market.id)).toHaveLength(2);
    });

    it("verträgt denselben clientId doppelt innerhalb eines Batches", async () => {
      const market = await storage.createMarket(ANNA, {
        name: "Wochenmarkt", date: "2026-08-01", location: "", standFee: 0,
        travelCost: 0, notes: "", status: "confirmed",
      });
      const doppelt = sale("33333333-3333-4333-8333-333333333333");

      const rows = await storage.upsertMarketSalesBatch(ANNA, market.id, [doppelt, doppelt]);

      expect(rows).toHaveLength(1);
      expect(await storage.getMarketSales(ANNA, market.id)).toHaveLength(1);
    });

    it("trennt gleiche clientIds verschiedener Konten", async () => {
      const marketA = await storage.createMarket(ANNA, {
        name: "A", date: "2026-08-01", location: "", standFee: 0, travelCost: 0, notes: "", status: "confirmed",
      });
      const marketB = await storage.createMarket(BEN, {
        name: "B", date: "2026-08-01", location: "", standFee: 0, travelCost: 0, notes: "", status: "confirmed",
      });
      const collision = sale("44444444-4444-4444-8444-444444444444");

      await storage.upsertMarketSalesBatch(ANNA, marketA.id, [collision]);
      await storage.upsertMarketSalesBatch(BEN, marketB.id, [collision]);

      expect(await storage.getMarketSales(ANNA, marketA.id)).toHaveLength(1);
      expect(await storage.getMarketSales(BEN, marketB.id)).toHaveLength(1);
    });
  });

  // ── Marktkosten ──────────────────────────────────────────

  describe("Marktkosten als abgeleitete Ausgaben", () => {
    it("bucht Standgebühr und Fahrtkosten erst ab Zusage", async () => {
      const beworben = await storage.createMarket(ANNA, {
        name: "Beworben", date: "2026-09-01", location: "", standFee: 5000,
        travelCost: 2000, notes: "", status: "applied",
      });
      expect(await storage.getExpenses(ANNA)).toHaveLength(0);

      await storage.updateMarket(ANNA, beworben.id, {
        name: "Beworben", date: "2026-09-01", location: "", standFee: 5000,
        travelCost: 2000, notes: "", status: "confirmed",
      });

      const expenses = await storage.getExpenses(ANNA);
      expect(expenses.map((e) => e.source).sort()).toEqual(["market_fee", "market_travel"]);
      expect(expenses.reduce((sum, e) => sum + e.amount, 0)).toBe(7000);
    });

    it("nimmt die Kosten bei Absage wieder heraus", async () => {
      const markt = await storage.createMarket(ANNA, {
        name: "Fällt aus", date: "2026-09-01", location: "", standFee: 5000,
        travelCost: 2000, notes: "", status: "confirmed",
      });
      expect(await storage.getExpenses(ANNA)).toHaveLength(2);

      await storage.updateMarket(ANNA, markt.id, {
        name: "Fällt aus", date: "2026-09-01", location: "", standFee: 5000,
        travelCost: 2000, notes: "", status: "cancelled",
      });

      expect(await storage.getExpenses(ANNA)).toHaveLength(0);
    });

    it("schützt abgeleitete Ausgaben vor direktem Löschen", async () => {
      await storage.createMarket(ANNA, {
        name: "Markt", date: "2026-09-01", location: "", standFee: 5000,
        travelCost: 0, notes: "", status: "confirmed",
      });
      const [derived] = await storage.getExpenses(ANNA);

      const result = await storage.deleteExpense(ANNA, derived.id);
      expect(result).toBe("derived");
      expect(await storage.getExpenses(ANNA)).toHaveLength(1);
    });
  });

  // ── Kontolöschung ────────────────────────────────────────

  describe("Kontolöschung", () => {
    it("löscht alle Geschäftsdaten und lässt fremde unberührt", async () => {
      await storage.upsertProfile(ANNA, PROFILE_INPUT);
      await storage.createOrder(ANNA, ORDER_INPUT);
      const market = await storage.createMarket(ANNA, {
        name: "Markt", date: "2026-08-01", location: "", standFee: 1000,
        travelCost: 0, notes: "", status: "confirmed",
      });
      await storage.createMarketSale(ANNA, { marketId: market.id, description: "x", amount: 100, quantity: 1 });
      await storage.createExpense(ANNA, {
        description: "Ton", amount: 4000, category: "wareneinkauf_material", expenseDate: "2026-08-01",
      });
      await storage.createOrder(BEN, ORDER_INPUT);

      await storage.deleteAllUserData(ANNA);

      expect(await storage.getOrders(ANNA)).toHaveLength(0);
      expect(await storage.getMarkets(ANNA)).toHaveLength(0);
      expect(await storage.getExpenses(ANNA)).toHaveLength(0);
      expect(await storage.getAllMarketSales(ANNA)).toHaveLength(0);
      // Bens Daten sind nicht betroffen.
      expect(await storage.getOrders(BEN)).toHaveLength(1);
    });

    it("archiviert Rechnungen statt sie zu löschen (§ 147 AO)", async () => {
      await storage.upsertProfile(ANNA, PROFILE_INPUT);
      const order = await storage.createOrder(ANNA, ORDER_INPUT);
      const issued = await storage.issueInvoice(ANNA, order.id);
      expect(issued.ok).toBe(true);

      await storage.archiveUserInvoices(ANNA);
      await storage.deleteAllUserData(ANNA);

      // Für das Konto ist nichts mehr sichtbar …
      expect(await storage.getInvoices(ANNA)).toHaveLength(0);
      // … die Belege existieren aber weiter, entkoppelt und mit Frist.
      const { rows } = await db.execute<{ user_id: string | null; retention_until: string | null }>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import("drizzle-orm")).sql`select user_id, retention_until from invoices`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBeNull();
      expect(rows[0].retention_until).not.toBeNull();
    });
  });
});

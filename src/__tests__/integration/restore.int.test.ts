import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createTestDb, resetTestDb, seedUser, type TestDb } from "@/test-utils/testDb";

/**
 * Regression: Ein Restore darf die Rechnungsstellung nicht dauerhaft blockieren.
 *
 * Der Restore löscht die Rechnungen bewusst NICHT, setzte den Zähler aber blind
 * aus der Backup-Datei. Wer ein älteres Backup einspielte, bekam beim nächsten
 * „Rechnung erstellen" eine bereits vergebene Nummer: der Unique-Index schlug zu,
 * die Transaktion rollte samt Zählererhöhung zurück, und jeder weitere Versuch
 * lief in denselben Fehler — bis zum Jahreswechsel, ohne Ausweg in der Oberfläche.
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

const authState = { userId: "user-anna" as string | null };
vi.mock("@/lib/server/auth", () => ({
  getAuthUserId: async () => authState.userId,
}));

import * as storage from "@/lib/server/storage";
import { POST as restore } from "@/app/api/migrate/route";

const ANNA = "user-anna";

const PROFILE = {
  name: "Annas Keramik",
  address: "Töpferweg 1, 12345 Musterstadt",
  email: "anna@example.com",
  phone: "",
  taxNote: "",
};

const ORDER = {
  customerName: "Kundin",
  customerEmail: "",
  customerStreet: "Weg 1",
  customerZip: "12345",
  customerCity: "Stadt",
  status: "open",
  notes: "",
  orderDate: "2026-08-01",
  items: [{ name: "Schale", quantity: 1, price: 2500 }],
};

function callRestore(body: unknown) {
  return restore(
    new Request("http://localhost/api/migrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("Restore und Rechnungszähler", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    holder.current = db;
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb(db);
    await seedUser(db, ANNA, "anna@example.com");
    authState.userId = ANNA;
  });

  it("setzt den Zähler nicht unter bereits vergebene Rechnungsnummern zurück", async () => {
    await storage.upsertProfile(ANNA, PROFILE);

    // Drei Rechnungen ausstellen -> Zähler steht auf 3.
    for (let i = 0; i < 3; i++) {
      const order = await storage.createOrder(ANNA, ORDER);
      const issued = await storage.issueInvoice(ANNA, order.id);
      expect(issued.ok).toBe(true);
    }
    expect(await storage.getInvoiceCounter(ANNA)).toBe(3);

    // Ein älteres Backup mit Zählerstand 1 einspielen.
    const res = await callRestore({ schemaVersion: 2, invoiceCounter: 1, orders: [] });
    expect(res.status).toBe(200);

    // Der Zähler darf nicht zurückgefallen sein …
    expect(await storage.getInvoiceCounter(ANNA)).toBe(3);

    // … und die nächste Rechnung muss durchgehen statt am Unique-Index zu scheitern.
    await storage.upsertProfile(ANNA, PROFILE);
    const order = await storage.createOrder(ANNA, ORDER);
    const next = await storage.issueInvoice(ANNA, order.id);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.invoice.invoiceNumber.endsWith("-004")).toBe(true);
  });

  it("übernimmt einen höheren Zählerstand aus dem Backup", async () => {
    const res = await callRestore({ schemaVersion: 2, invoiceCounter: 42, orders: [] });
    expect(res.status).toBe(200);
    expect(await storage.getInvoiceCounter(ANNA)).toBe(42);
  });

  it("lässt einen Restore ohne Zählerangabe die vergebenen Nummern nicht vergessen", async () => {
    await storage.upsertProfile(ANNA, PROFILE);
    const order = await storage.createOrder(ANNA, ORDER);
    expect((await storage.issueInvoice(ANNA, order.id)).ok).toBe(true);

    const res = await callRestore({ schemaVersion: 2, orders: [] });
    expect(res.status).toBe(200);

    expect(await storage.getInvoiceCounter(ANNA)).toBe(1);
  });

  it("weist den Import ohne Pro-Zugang ab", async () => {
    await db
      .update((await import("@/lib/server/schema")).users)
      .set({ plan: "free", subscriptionExpiresAt: null, trialEndsAt: null })
      .where((await import("drizzle-orm")).eq((await import("@/lib/server/schema")).users.id, ANNA));

    const res = await callRestore({ schemaVersion: 2, orders: [] });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "PRO_REQUIRED" });
  });

  it("rechnet den Versand in das Auftragstotal ein", async () => {
    // Regression: Der Restore summierte nur die Positionen. Weil die EÜR
    // `order.total` bucht, fehlten nach jedem Restore die Versandkosten
    // jedes bezahlten Auftrags in den Einnahmen — ohne Fehlermeldung.
    const res = await callRestore({
      schemaVersion: 2,
      orders: [{ ...ORDER, status: "paid", paidAt: "2026-08-02", shippingCost: 490, total: 1 }],
    });
    expect(res.status).toBe(200);

    const [order] = await storage.getOrders(ANNA);
    expect(order.shippingCost).toBe(490);
    // 1 x 2500 + 490 Versand — nicht das (hier absichtlich falsche) Backup-Total.
    expect(order.total).toBe(2990);
  });

  it("übersetzt Werte aus alten Backups statt den Import abzubrechen", async () => {
    // "Bar", "Bezahlt", "31.12.2025": vorher lief jeder dieser Werte an den
    // CHECK der Datenbank bzw. in eine date-Spalte — und der GANZE Import
    // rollte mit "Import failed" zurück.
    const res = await callRestore({
      schemaVersion: 2,
      orders: [{ ...ORDER, status: "Bezahlt", paymentMethod: "Bar", orderDate: "31.12.2025", paidAt: "gestern" }],
      markets: [{ id: "m1", name: "Weihnachtsmarkt", date: "06.12.2025", status: "Zugesagt", standFee: 8000 }],
      expenses: [{ description: "Ton", amount: 4000, category: "wareneinkauf_material", expenseDate: "01.08.2025" }],
    });
    expect(res.status).toBe(200);

    const [order] = await storage.getOrders(ANNA);
    expect(order.status).toBe("paid");
    expect(order.paymentMethod).toBe("cash");
    expect(order.orderDate).toBe("2025-12-31");
    expect(order.paidAt).toBeNull();

    const [market] = await storage.getMarkets(ANNA);
    expect(market.status).toBe("confirmed");
    expect(market.date).toBe("2025-12-06");

    const expenses = await storage.getExpenses(ANNA);
    expect(expenses.find((e) => e.source === "manual")?.expenseDate).toBe("2025-08-01");
  });

  it("behält das Firmenprofil, wenn das Backup keines mitbringt", async () => {
    // Vorher löschte Schritt 1 das Profil immer, Schritt 6 legte nur eines an,
    // wenn das Backup den Schlüssel trug — ein Restore ohne `profile` ließ
    // die Nutzerin ohne Firmenname zurück, und die nächste Rechnung scheiterte.
    await storage.upsertProfile(ANNA, PROFILE);
    const res = await callRestore({ schemaVersion: 2, orders: [] });
    expect(res.status).toBe(200);
    expect((await storage.getProfile(ANNA)).name).toBe(PROFILE.name);

    // Bringt das Backup eines mit, ersetzt es das vorhandene.
    const res2 = await callRestore({ schemaVersion: 2, profile: { ...PROFILE, name: "Neu" } });
    expect(res2.status).toBe(200);
    expect((await storage.getProfile(ANNA)).name).toBe("Neu");
  });

  it("übernimmt Zahlart, Offline-Schlüssel und Zeitstempel der Marktverkäufe", async () => {
    const res = await callRestore({
      schemaVersion: 2,
      markets: [{ id: "m1", name: "Markt", date: "2026-08-01", applicationDeadline: "2026-07-01" }],
      marketSales: [
        { marketId: "m1", description: "Tasse", amount: 1500, quantity: 2, paymentMethod: "card", clientId: "c-1", createdAt: "2026-08-01T10:00:00.000Z" },
      ],
    });
    expect(res.status).toBe(200);
    const [market] = await storage.getMarkets(ANNA);
    expect(market.applicationDeadline).toBe("2026-07-01");
    const [sale] = await storage.getMarketSales(ANNA, market.id);
    expect(sale.paymentMethod).toBe("card");
    expect(sale.clientId).toBe("c-1");
    expect(sale.createdAt).toBe("2026-08-01T10:00:00.000Z");
  });

  it("verträgt einen Kategoriewert, der auf Object.prototype zeigt", async () => {
    // "constructor" traf früher die geerbte Funktion der Mapping-Tabelle, wurde
    // als Kategorie durchgereicht und liess den gesamten Import am
    // CHECK-Constraint scheitern — der Nutzer sah nur „Import failed".
    const res = await callRestore({
      schemaVersion: 2,
      expenses: [
        { description: "Ton", amount: 4000, category: "constructor", expenseDate: "2026-08-01" },
      ],
    });

    expect(res.status).toBe(200);
    const expenses = await storage.getExpenses(ANNA);
    expect(expenses).toHaveLength(1);
    expect(expenses[0].category).toBe("sonstiges");
  });
});

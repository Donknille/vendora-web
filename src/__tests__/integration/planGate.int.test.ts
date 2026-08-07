import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createTestDb, resetTestDb, seedUser, type TestDb } from "@/test-utils/testDb";

/**
 * Das Schreibgate für Free-Konten — und seine bewusste Ausnahme.
 *
 * „Free = Nur-Lese" heißt: nichts Neues anlegen. Es darf aber keine Falle
 * bauen: Standgebühr und Fahrtkosten eines Marktes werden nur bei „zugesagt"
 * oder „abgeschlossen" gebucht, und der Wechsel auf „abgesagt" ist der einzige
 * Weg, sie wieder loszuwerden (direkt löschen verweigert die Ausgaben-Route mit
 * 409). Ohne Ausnahme stünde ein abgesagter Markt dauerhaft als Kosten in der
 * EÜR — oder man müsste den ganzen Markt samt Verkäufen löschen.
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

const authState = { userId: "user-free" as string | null };
vi.mock("@/lib/server/auth", () => ({
  getAuthUserId: async () => authState.userId,
}));

import * as storage from "@/lib/server/storage";
import { PUT as putMarket } from "@/app/api/markets/[id]/route";
import { PUT as putOrder } from "@/app/api/orders/[id]/route";

const FREE = "user-free";

function call(
  handler: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>,
  id: string,
  body: unknown,
) {
  return handler(
    new Request(`http://localhost/api/x/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

const MARKET = {
  name: "Weihnachtsmarkt",
  date: "2026-12-06",
  location: "",
  standFee: 12000,
  travelCost: 4000,
  notes: "",
  status: "confirmed",
};

describe("Schreibgate für Free-Konten", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    holder.current = db;
  }, 60_000);

  beforeEach(async () => {
    await resetTestDb(db);
    // Konto ohne Trial und ohne Abo — effektiv "free".
    await seedUser(db, FREE, "free@example.com", {
      plan: "free",
      subscriptionStatus: "expired",
      subscriptionExpiresAt: null,
      trialEndsAt: null,
    });
    authState.userId = FREE;
  });

  it("lässt einen abgesagten Markt zu und nimmt die Kosten wieder heraus", async () => {
    const market = await storage.createMarket(FREE, MARKET);
    expect(await storage.getExpenses(FREE)).toHaveLength(2); // Stand + Fahrt

    // Genau so, wie das Bearbeitungsformular sendet: ALLE Felder, geändert ist
    // nur der Status. Ein Test mit { status } allein hätte die Ausnahme
    // bestätigt, die über die Oberfläche nie erreichbar gewesen wäre.
    // quickItems: [] gegen einen Markt, der ohne Schnellartikel angelegt wurde
    // (in der DB NULL) -- genau der Body des Bearbeitungsformulars.
    const res = await call(putMarket, market.id, {
      ...MARKET,
      quickItems: [],
      status: "cancelled",
    });

    expect(res.status).toBe(200);
    expect(await storage.getExpenses(FREE)).toHaveLength(0);
  });

  it("lässt ein Speichern ohne jede Änderung durch", async () => {
    const market = await storage.createMarket(FREE, MARKET);

    // Unveränderter Datensatz: nichts wird angelegt, also kein Grund zu sperren.
    const res = await call(putMarket, market.id, { ...MARKET });

    expect(res.status).toBe(200);
    expect(await storage.getExpenses(FREE)).toHaveLength(2);
  });

  it("blockiert eine inhaltliche Änderung am Markt", async () => {
    const market = await storage.createMarket(FREE, MARKET);

    const res = await call(putMarket, market.id, { ...MARKET, standFee: 99000 });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "PRO_REQUIRED" });
    const unchanged = await storage.getMarket(FREE, market.id);
    expect(unchanged?.standFee).toBe(MARKET.standFee);
  });

  it("lässt den Statuswechsel eines Auftrags zu, blockiert aber neue Positionen", async () => {
    const order = await storage.createOrder(FREE, {
      customerName: "Kundin",
      customerEmail: "",
      customerStreet: "Weg 1",
      customerZip: "12345",
      customerCity: "Stadt",
      status: "open",
      notes: "",
      orderDate: "2026-08-01",
      items: [{ name: "Schale", quantity: 1, price: 2500 }],
    });

    expect((await call(putOrder, order.id, { status: "paid" })).status).toBe(200);
    expect((await storage.getOrder(FREE, order.id))?.status).toBe("paid");

    // Auch mit vollem Formular-Body, bei dem sich nur der Status ändert: die
    // Positionen sind inhaltlich gleich und dürfen nicht als Änderung zählen.
    const full = await call(putOrder, order.id, {
      customerName: "Kundin",
      customerEmail: "",
      customerStreet: "Weg 1",
      customerZip: "12345",
      customerCity: "Stadt",
      notes: "",
      orderDate: "2026-08-01",
      items: [{ name: "Schale", quantity: 1, price: 2500 }],
      status: "shipped",
    });
    expect(full.status).toBe(200);
    expect((await storage.getOrder(FREE, order.id))?.status).toBe("shipped");

    const res = await call(putOrder, order.id, {
      items: [{ name: "Neu", quantity: 5, price: 9900 }],
    });
    expect(res.status).toBe(403);
    expect((await storage.getOrder(FREE, order.id))?.items).toHaveLength(1);
  });
});

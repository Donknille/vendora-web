import { describe, it, expect, vi, beforeEach } from "vitest";

// The batch route depends on auth + storage; mock both so the route's own
// per-entry validation and response assembly are what is under test (no DB).
const authState = { userId: "user1" as string | null };
const storageState = {
  market: { id: "m1", name: "Markt" } as { id: string; name: string } | undefined,
};

vi.mock("@/lib/server/auth", () => ({
  getAuthUserId: async () => authState.userId,
  requireActiveSubscription: async () => null,
}));

vi.mock("@/lib/server/storage", () => ({
  // requireWriteAccess() looks the user up; return an active PRO user so the
  // write gate passes and the batch assembly logic is what's under test.
  getUser: async () => ({
    plan: "pro",
    subscriptionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  }),
  getMarket: async () => storageState.market,
  // Emulates the real dedup-by-clientId + return-authoritative-rows contract.
  upsertMarketSalesBatch: async (
    userId: string,
    marketId: string,
    entries: { clientId: string; description: string; amount: number; quantity: number }[]
  ) => {
    const byId = new Map<string, unknown>();
    for (const e of entries) {
      if (!byId.has(e.clientId)) {
        byId.set(e.clientId, {
          id: "srv-" + e.clientId,
          userId,
          marketId,
          clientId: e.clientId,
          description: e.description,
          amount: e.amount,
          quantity: e.quantity,
          createdAt: new Date("2026-07-19T10:00:00.000Z").toISOString(),
        });
      }
    }
    return [...byId.values()];
  },
}));

import { POST, MAX_BATCH } from "@/app/api/markets/[id]/sales/batch/route";

function callBatch(entries: unknown) {
  const req = new Request("http://localhost/api/markets/m1/sales/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entries),
  });
  return POST(req, { params: Promise.resolve({ id: "m1" }) });
}

type Result =
  | { clientId: string; status: "ok"; row: { id: string } }
  | { clientId: string; status: "error"; message: string };

beforeEach(() => {
  authState.userId = "user1";
  storageState.market = { id: "m1", name: "Markt" };
});

describe("POST /api/markets/[id]/sales/batch", () => {
  it("one invalid entry does not abort the batch — the other 99 go through", async () => {
    const now = new Date().toISOString();
    const entries = Array.from({ length: 100 }, (_, i) => ({
      clientId: crypto.randomUUID(),
      description: i === 42 ? "" : `Item ${i}`, // empty description → invalid
      amount: 5,
      quantity: 1,
      createdAt: now,
    }));

    const res = await callBatch(entries);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Result[];
    expect(body).toHaveLength(100);
    expect(body.filter((r) => r.status === "ok")).toHaveLength(99);
    expect(body.filter((r) => r.status === "error")).toHaveLength(1);
    expect(body[42].status).toBe("error");
    expect(body[42].clientId).toBe(entries[42].clientId);
  });

  it("is idempotent-friendly: a duplicate clientId in one batch resolves both to the same row", async () => {
    const id = crypto.randomUUID();
    const entries = [
      { clientId: id, description: "Kerze", amount: 500, quantity: 1 },
      { clientId: id, description: "Kerze", amount: 500, quantity: 1 },
    ];
    const res = await callBatch(entries);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Result[];
    expect(body).toHaveLength(2);
    expect(body.every((r) => r.status === "ok")).toBe(true);
    expect((body[0] as { row: { id: string } }).row.id).toBe(
      (body[1] as { row: { id: string } }).row.id
    );
  });

  it(`rejects an oversized batch (>${MAX_BATCH}) up front`, async () => {
    const entries = Array.from({ length: MAX_BATCH + 1 }, () => ({
      clientId: crypto.randomUUID(),
      description: "x",
      amount: 1,
      quantity: 1,
    }));
    const res = await callBatch(entries);
    expect(res.status).toBe(400);
  });

  it("rejects an empty batch", async () => {
    const res = await callBatch([]);
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    authState.userId = null;
    const res = await callBatch([
      { clientId: crypto.randomUUID(), description: "x", amount: 1, quantity: 1 },
    ]);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the market does not belong to the user", async () => {
    storageState.market = undefined;
    const res = await callBatch([
      { clientId: crypto.randomUUID(), description: "x", amount: 1, quantity: 1 },
    ]);
    expect(res.status).toBe(404);
  });
});

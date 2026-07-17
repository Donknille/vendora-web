import { describe, it, expect, vi } from "vitest";

// The batch route depends on auth + storage; mock both so the route's own
// per-entry validation and response assembly are what is under test (no DB).
vi.mock("@/lib/server/auth", () => ({
  getAuthUserId: async () => "user1",
  requireActiveSubscription: async () => null,
}));

vi.mock("@/lib/server/storage", () => ({
  getMarket: async () => ({ id: "m1", name: "Markt" }),
  upsertMarketSalesBatch: async (
    userId: string,
    marketId: string,
    entries: { clientId: string; description: string; amount: number; quantity: number; createdAt: string }[]
  ) =>
    entries.map((e) => ({
      id: "srv-" + e.clientId,
      userId,
      marketId,
      clientId: e.clientId,
      description: e.description,
      amount: e.amount,
      quantity: e.quantity,
      createdAt: e.createdAt,
    })),
}));

import { POST } from "@/app/api/markets/[id]/sales/batch/route";

function callBatch(entries: unknown[]) {
  const req = new Request("http://localhost/api/markets/m1/sales/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entries),
  });
  return POST(req, { params: Promise.resolve({ id: "m1" }) });
}

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

    const body = (await res.json()) as {
      clientId: string;
      status: "ok" | "error";
      row?: unknown;
      message?: string;
    }[];

    expect(body).toHaveLength(100);
    expect(body.filter((r) => r.status === "ok")).toHaveLength(99);
    expect(body.filter((r) => r.status === "error")).toHaveLength(1);

    // The bad one is reported as an error, keyed by its clientId, with the rest ok.
    expect(body[42].status).toBe("error");
    expect(body[42].clientId).toBe(entries[42].clientId);
    expect(body.filter((r) => r.status === "ok").every((r) => r.row)).toBe(true);
  });

  it("rejects an oversized batch (>100) up front", async () => {
    const now = new Date().toISOString();
    const entries = Array.from({ length: 101 }, () => ({
      clientId: crypto.randomUUID(),
      description: "x",
      amount: 1,
      quantity: 1,
      createdAt: now,
    }));
    const res = await callBatch(entries);
    expect(res.status).toBe(400);
  });
});

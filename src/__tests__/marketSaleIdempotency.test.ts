import { describe, it, expect, beforeEach, vi } from "vitest";

// A faithful in-memory model of the (user_id, client_id) unique upsert, so the
// idempotency wiring in storage.ts (V1) can be exercised without a live
// Postgres. The mock enforces the conflict target too: if the code upserted on
// the wrong key, the test would fail.
const rows = new Map<string, Record<string, unknown>>();
let idCounter = 0;

vi.mock("@/lib/server/db", () => {
  function makeBuilder() {
    let vals: Record<string, unknown>[] = [];
    const builder = {
      values(v: Record<string, unknown> | Record<string, unknown>[]) {
        vals = Array.isArray(v) ? v : [v];
        return builder;
      },
      onConflictDoUpdate(cfg: { target: { name: string }[] }) {
        const names = (cfg.target ?? []).map((c) => c.name).join(",");
        if (names !== "user_id,client_id") {
          throw new Error(`unexpected conflict target: ${names}`);
        }
        return builder;
      },
      returning() {
        return Promise.resolve(
          vals.map((v) => {
            const key = `${v.userId}::${v.clientId}`;
            let row = rows.get(key);
            let inserted: boolean;
            if (row) {
              inserted = false; // replay → existing row, no-op update
            } else {
              row = {
                id: "srv-" + idCounter++,
                userId: v.userId,
                marketId: v.marketId,
                clientId: v.clientId,
                description: v.description,
                amount: v.amount,
                quantity: v.quantity,
                createdAt: v.createdAt,
                receivedAt: new Date("2026-07-17T10:00:00.000Z"),
              };
              rows.set(key, row);
              inserted = true;
            }
            return { ...row, inserted };
          })
        );
      },
    };
    return builder;
  }
  return { db: { insert: () => makeBuilder() } };
});

import { upsertMarketSale } from "@/lib/server/storage";

const CLIENT_ID = "3f1e0a5c-1c2b-4a6d-8e9f-0a1b2c3d4e5f";
const base = {
  description: "Ring",
  amount: 12.5,
  quantity: 1,
  createdAt: "2026-07-17T10:00:00.000Z",
};

beforeEach(() => {
  rows.clear();
  idCounter = 0;
});

describe("market sale idempotency (V1)", () => {
  it("the same clientId sent twice yields exactly one row", async () => {
    const first = await upsertMarketSale("userA", "m1", { clientId: CLIENT_ID, ...base });
    const second = await upsertMarketSale("userA", "m1", { clientId: CLIENT_ID, ...base });

    expect(first.inserted).toBe(true); // 201 — first insert
    expect(second.inserted).toBe(false); // 200 — replay
    expect(second.row.id).toBe(first.row.id); // same row returned
    expect(rows.size).toBe(1);
  });

  it("two different users with the same clientId yield two rows", async () => {
    const a = await upsertMarketSale("userA", "m1", { clientId: CLIENT_ID, ...base });
    const b = await upsertMarketSale("userB", "m1", { clientId: CLIENT_ID, ...base });

    expect(a.inserted).toBe(true);
    expect(b.inserted).toBe(true);
    expect(a.row.id).not.toBe(b.row.id);
    expect(rows.size).toBe(2);
  });
});

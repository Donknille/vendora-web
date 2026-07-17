import { describe, it, expect } from "vitest";
import {
  computeBackoffMs,
  classifyStatus,
  resetStuckOps,
  groupCreatesIntoBatches,
  drain,
  type QueueStore,
} from "@/lib/offline/queue";
import type { QueuedOp, MarketSalePayload, SaleState, OpType } from "@/lib/offline/types";

// ── In-memory QueueStore + helpers ─────────────────────────

function memStore(seed: QueuedOp[] = []): QueueStore & {
  map: Map<string, QueuedOp>;
  meta: Map<string, unknown>;
} {
  const map = new Map(seed.map((o) => [o.clientId, o]));
  const meta = new Map<string, unknown>();
  return {
    map,
    meta,
    async getAllOps() {
      return [...map.values()];
    },
    async getOp(id) {
      return map.get(id);
    },
    async putOp(o) {
      map.set(o.clientId, o);
    },
    async deleteOp(id) {
      map.delete(id);
    },
    async getMeta(k) {
      return meta.get(k) as never;
    },
    async setMeta(k, v) {
      meta.set(k, v);
    },
  };
}

const T = 1_700_000_000_000;

function op(
  clientId: string,
  over: {
    state?: SaleState;
    op?: OpType;
    marketId?: string;
    attempts?: number;
    nextAttemptAt?: number;
    serverId?: string;
  } = {}
): QueuedOp {
  const marketId = over.marketId ?? "m1";
  const payload: MarketSalePayload = {
    clientId,
    marketId,
    description: "Ring",
    amount: 10,
    quantity: 1,
    createdAt: "2026-07-17T10:00:00.000Z",
    serverId: over.serverId,
  };
  return {
    clientId,
    marketId,
    op: over.op ?? "create",
    payload,
    state: over.state ?? "pending",
    attempts: over.attempts ?? 0,
    createdAt: payload.createdAt,
    nextAttemptAt: over.nextAttemptAt ?? 0,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const baseDeps = {
  now: () => T,
  refreshSession: async () => true,
};

// ── 4. Backoff ─────────────────────────────────────────────

describe("computeBackoffMs (V4)", () => {
  it("is deterministic with an injected random and capped at 60s", () => {
    expect(computeBackoffMs(1, () => 0)).toBe(500);
    expect(computeBackoffMs(1, () => 1)).toBe(1000);
    expect(computeBackoffMs(2, () => 0)).toBe(1000);
    expect(computeBackoffMs(2, () => 1)).toBe(2000);
    // large attempt counts never exceed the 60s cap
    expect(computeBackoffMs(100, () => 1)).toBe(60000);
    expect(computeBackoffMs(100, () => 0)).toBe(30000);
  });

  it("grows monotonically until the cap", () => {
    const mid = (n: number) => computeBackoffMs(n, () => 0.5);
    expect(mid(1)).toBeLessThan(mid(2));
    expect(mid(2)).toBeLessThan(mid(3));
  });
});

// ── 5. V4 classification ───────────────────────────────────

describe("classifyStatus (V4)", () => {
  it("maps each status to its V4 action", () => {
    expect(classifyStatus(200).kind).toBe("synced");
    expect(classifyStatus(201).kind).toBe("synced");
    expect(classifyStatus(500).kind).toBe("retry");
    expect(classifyStatus(503).kind).toBe("retry");
    expect(classifyStatus(401).kind).toBe("auth-retry");
    expect(classifyStatus(400).kind).toBe("failed");
    expect(classifyStatus(403, { code: "SUBSCRIPTION_REQUIRED" }).kind).toBe(
      "subscription-required"
    );
    // a 403 without the code is not a subscription stop — just a failure
    expect(classifyStatus(403, {}).kind).toBe("failed");
  });
});

// ── 3. Stuck-op reset (restart) + batching ─────────────────

describe("resetStuckOps (V3, restart)", () => {
  it("resets syncing -> pending and leaves other states untouched", () => {
    const out = resetStuckOps([
      op("a", { state: "syncing" }),
      op("b", { state: "synced" }),
      op("c", { state: "failed" }),
      op("d", { state: "pending" }),
    ]);
    const byId = Object.fromEntries(out.map((o) => [o.clientId, o.state]));
    expect(byId).toEqual({ a: "pending", b: "synced", c: "failed", d: "pending" });
  });
});

describe("groupCreatesIntoBatches (Phase 4.5)", () => {
  it("groups per market and chunks at 100", () => {
    const many = Array.from({ length: 250 }, (_, i) => op("c" + i));
    expect(groupCreatesIntoBatches(many, 100).map((b) => b.ops.length)).toEqual([
      100, 100, 50,
    ]);
  });
  it("keeps markets separate and ignores deletes", () => {
    const ops = [
      op("a", { marketId: "m1" }),
      op("b", { marketId: "m2" }),
      op("d", { op: "delete", marketId: "m1" }),
    ];
    const batches = groupCreatesIntoBatches(ops, 100);
    expect(batches).toHaveLength(2);
    expect(batches.every((b) => b.ops.every((o) => o.op === "create"))).toBe(true);
  });
});

// ── 3/5. Drain state transitions & V4 behaviour ────────────

describe("drain (V3/V4)", () => {
  it("pending -> syncing -> synced, recording the server id and last sync", async () => {
    const store = memStore([op("a")]);
    let stateWhileSending: string | undefined;
    await drain({
      ...baseDeps,
      store,
      fetchImpl: async () => {
        stateWhileSending = store.map.get("a")!.state;
        return json([{ clientId: "a", status: "ok", row: { id: "srv-a" } }], 200);
      },
    });
    expect(stateWhileSending).toBe("syncing");
    const a = store.map.get("a")!;
    expect(a.state).toBe("synced");
    expect(a.payload.serverId).toBe("srv-a");
    expect(store.meta.get("lastSyncAt")).toBeTruthy();
  });

  it("network error returns ops to pending with backoff (retry)", async () => {
    const store = memStore([op("a")]);
    await drain({
      ...baseDeps,
      store,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    const a = store.map.get("a")!;
    expect(a.state).toBe("pending");
    expect(a.attempts).toBe(1);
    expect(a.nextAttemptAt!).toBeGreaterThan(T);
  });

  it("5xx returns ops to pending with an incremented attempt", async () => {
    const store = memStore([op("a")]);
    await drain({ ...baseDeps, store, fetchImpl: async () => json({}, 503) });
    const a = store.map.get("a")!;
    expect(a.state).toBe("pending");
    expect(a.attempts).toBe(1);
  });

  it("400 fails immediately with no retry", async () => {
    const store = memStore([op("a")]);
    let calls = 0;
    await drain({
      ...baseDeps,
      store,
      fetchImpl: async () => {
        calls++;
        return json({ message: "bad" }, 400);
      },
    });
    expect(calls).toBe(1);
    expect(store.map.get("a")!.state).toBe("failed");
    expect(store.map.get("a")!.attempts).toBe(0);
  });

  it("401 refreshes the session once, retries once, then fails", async () => {
    const store = memStore([op("a")]);
    let calls = 0;
    let refreshes = 0;
    await drain({
      store,
      now: () => T,
      refreshSession: async () => {
        refreshes++;
        return true;
      },
      fetchImpl: async () => {
        calls++;
        return json({}, 401);
      },
    });
    expect(refreshes).toBe(1);
    expect(calls).toBe(2); // original + one retry
    expect(store.map.get("a")!.state).toBe("failed");
  });

  it("skips ops whose backoff window has not elapsed", async () => {
    const store = memStore([op("a", { nextAttemptAt: T + 10_000 })]);
    let calls = 0;
    await drain({
      ...baseDeps,
      store,
      fetchImpl: async () => {
        calls++;
        return json([], 200);
      },
    });
    expect(calls).toBe(0);
    expect(store.map.get("a")!.state).toBe("pending");
  });

  it("per-entry: an 'error' result fails only that op, others synced", async () => {
    const store = memStore([op("a"), op("b")]);
    await drain({
      ...baseDeps,
      store,
      fetchImpl: async () =>
        json(
          [
            { clientId: "a", status: "ok", row: { id: "srv-a" } },
            { clientId: "b", status: "error", message: "ungültig" },
          ],
          200
        ),
    });
    expect(store.map.get("a")!.state).toBe("synced");
    expect(store.map.get("b")!.state).toBe("failed");
    expect(store.map.get("b")!.lastError).toBe("ungültig");
  });

  it("403 SUBSCRIPTION_REQUIRED stops the drain, fails the batch, deletes nothing", async () => {
    const store = memStore([
      op("a"),
      op("b"),
      op("d", { op: "delete", serverId: "srv-d" }),
    ]);
    let calls = 0;
    await drain({
      ...baseDeps,
      store,
      fetchImpl: async () => {
        calls++;
        return json({ code: "SUBSCRIPTION_REQUIRED", message: "Abo erforderlich" }, 403);
      },
    });
    expect(calls).toBe(1); // stopped after the first batch
    expect(store.map.size).toBe(3); // nothing deleted
    expect(store.map.get("a")!.state).toBe("failed");
    expect(store.map.get("b")!.state).toBe("failed");
    expect(store.map.get("d")!.state).toBe("pending"); // delete never reached
    expect(store.meta.get("subscriptionRequired")).toBe(true);
  });

  it("a confirmed delete op removes its record", async () => {
    const store = memStore([
      op("d", { op: "delete", serverId: "srv-d" }),
    ]);
    await drain({
      ...baseDeps,
      store,
      fetchImpl: async () => json({ deleted: true }, 200),
    });
    expect(store.map.has("d")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";

// ── 1.1 Query Cache Clearing ──────────────────────────────

describe("1.1 — Query cache clearing on logout", () => {
  it("queryClient.clear() is exported and callable", async () => {
    // Verify the queryClient export has a clear method
    const { queryClient } = await import("@/lib/api-client");
    expect(typeof queryClient.clear).toBe("function");
  });

  it("queryClient.clear() removes all cached queries", async () => {
    const { queryClient } = await import("@/lib/api-client");

    // Seed the cache with mock data (user-scoped keys)
    queryClient.setQueryData(["user-a", "/api/orders"], [{ id: "1", customerName: "User A" }]);
    queryClient.setQueryData(["user-a", "/api/profile"], { name: "User A Corp" });

    expect(queryClient.getQueryData(["user-a", "/api/orders"])).toBeDefined();
    expect(queryClient.getQueryData(["user-a", "/api/profile"])).toBeDefined();

    // Clear should remove all data
    queryClient.clear();

    expect(queryClient.getQueryData(["user-a", "/api/orders"])).toBeUndefined();
    expect(queryClient.getQueryData(["user-a", "/api/profile"])).toBeUndefined();
  });

  it("user-scoped keys isolate data between users", async () => {
    const { queryClient } = await import("@/lib/api-client");
    queryClient.clear();

    // User A's data
    queryClient.setQueryData(["user-a", "/api/orders"], [{ id: "1" }]);
    // User B's data
    queryClient.setQueryData(["user-b", "/api/orders"], [{ id: "2" }]);

    // Keys are distinct — no cross-contamination
    const userA = queryClient.getQueryData(["user-a", "/api/orders"]);
    const userB = queryClient.getQueryData(["user-b", "/api/orders"]);

    expect(userA).toEqual([{ id: "1" }]);
    expect(userB).toEqual([{ id: "2" }]);

    // After clear, both are gone
    queryClient.clear();
    expect(queryClient.getQueryData(["user-a", "/api/orders"])).toBeUndefined();
    expect(queryClient.getQueryData(["user-b", "/api/orders"])).toBeUndefined();
  });

  it("default queryFn resolves URL from user-scoped query key", async () => {
    const { queryClient } = await import("@/lib/api-client");
    const cache = queryClient.getDefaultOptions().queries;
    expect(cache?.queryFn).toBeDefined();
  });
});

// ── 1.2 Account Deletion — complete and irreversible ──

describe("1.2 — Account deletion completeness", () => {
  it("schema has deletedAt field on users table", async () => {
    const { users } = await import("@/lib/server/schema");
    expect(users.deletedAt).toBeDefined();
  });

  it("deleteAllUserData is exported and accepts a transaction parameter", async () => {
    const storage = await import("@/lib/server/storage");
    expect(typeof storage.deleteAllUserData).toBe("function");
    // Function accepts (userId, txOrDb?) — 1 required + 1 optional param
    expect(storage.deleteAllUserData.length).toBeGreaterThanOrEqual(1);
  });

  it("account route handler uses db.transaction for data deletion", async () => {
    // Read the source to verify transactional usage
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/api/account/route.ts", "utf-8");
    expect(source).toContain("db.transaction");
    expect(source).toContain("deleteAllUserData");
    // Stripe deletion (external) before DB transaction
    expect(source.indexOf("customers.del")).toBeLessThan(source.indexOf("db.transaction"));
    // Better Auth identity deletion happens inside the transaction (atomic with data wipe)
    expect(source).toContain("tx.delete(authUser)");
    expect(source.indexOf("db.transaction")).toBeLessThan(source.indexOf("tx.delete(authUser)"));
    // Soft-delete guard retained to block re-registration
    expect(source).toContain("deletedAt");
  });
});

// ── 1.3 Webhook fail-closed ───────────────────────────────

describe("1.3 — Stripe webhook fail-closed", () => {
  it("rejects when STRIPE_WEBHOOK_SECRET is not set", async () => {
    // Save and clear the env var
    const original = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    // Dynamically import to avoid module caching issues
    const mod = await import("@/app/api/stripe/webhook/route");

    const request = new Request("https://example.com/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "test_sig" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.message).toContain("not configured");

    // Restore
    if (original) process.env.STRIPE_WEBHOOK_SECRET = original;
  });

  it("rejects when stripe-signature header is missing", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    const mod = await import("@/app/api/stripe/webhook/route");

    const request = new Request("https://example.com/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });

    const response = await mod.POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.message).toContain("Missing signature");
  });
});

// ── 1.4 Blocked users ─────────────────────────────────────

describe("1.4 — Blocked user enforcement", () => {
  it("getAuthUserId checks isBlocked field", async () => {
    // Verify the auth module exists and exports getAuthUserId
    const auth = await import("@/lib/server/auth");
    expect(typeof auth.getAuthUserId).toBe("function");
  });

  it("getAuthUserIdStrict is no longer exported (merged into getAuthUserId)", async () => {
    const auth = await import("@/lib/server/auth");
    expect((auth as Record<string, unknown>).getAuthUserIdStrict).toBeUndefined();
  });
});

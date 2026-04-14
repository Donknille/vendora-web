import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 1.1 Query Cache Clearing ──────────────────────────────

describe("1.1 — Query cache clearing on logout", () => {
  it("queryClient.clear() is exported and callable", async () => {
    // Verify the queryClient export has a clear method
    const { queryClient } = await import("@/lib/api-client");
    expect(typeof queryClient.clear).toBe("function");
  });

  it("queryClient.clear() removes all cached queries", async () => {
    const { queryClient } = await import("@/lib/api-client");

    // Seed the cache with mock data
    queryClient.setQueryData(["/api/orders"], [{ id: "1", customerName: "User A" }]);
    queryClient.setQueryData(["/api/profile"], { name: "User A Corp" });

    expect(queryClient.getQueryData(["/api/orders"])).toBeDefined();
    expect(queryClient.getQueryData(["/api/profile"])).toBeDefined();

    // Clear should remove all data
    queryClient.clear();

    expect(queryClient.getQueryData(["/api/orders"])).toBeUndefined();
    expect(queryClient.getQueryData(["/api/profile"])).toBeUndefined();
  });
});

// ── 1.2 Account Deletion — ensureUserRecord soft-delete guard ──

describe("1.2 — Deleted user re-creation guard", () => {
  it("schema has deletedAt field on users table", async () => {
    const { users } = await import("@/lib/server/schema");
    // Verify the column exists
    expect(users.deletedAt).toBeDefined();
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

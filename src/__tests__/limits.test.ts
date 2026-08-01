import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the storage layer so we exercise the limit logic without a DB.
const state = {
  user: { plan: "free", subscriptionExpiresAt: null } as {
    plan: string;
    subscriptionExpiresAt: string | Date | null;
  } | undefined,
  markets: 0,
  invoices: 0,
};

vi.mock("@/lib/server/storage", () => ({
  getUser: async () => state.user,
  countMarketsInMonth: async () => state.markets,
  countInvoicesInMonth: async () => state.invoices,
}));

import {
  requireMarketQuota,
  requireInvoiceQuota,
  requireYearExport,
} from "@/lib/server/limits";

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();

beforeEach(() => {
  state.user = { plan: "free", subscriptionExpiresAt: null };
  state.markets = 0;
  state.invoices = 0;
});

describe("requireMarketQuota", () => {
  it("passes a free user below the limit", async () => {
    state.markets = 1;
    expect(await requireMarketQuota("u1", "2026-08-10")).toBeNull();
  });

  it("blocks a free user at the limit with a 403 + code", async () => {
    state.markets = 2;
    const res = await requireMarketQuota("u1", "2026-08-10");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.code).toBe("MARKET_LIMIT_REACHED");
  });

  it("never blocks a pro user", async () => {
    state.user = { plan: "pro", subscriptionExpiresAt: FUTURE };
    state.markets = 99;
    expect(await requireMarketQuota("u1", "2026-08-10")).toBeNull();
  });
});

describe("requireInvoiceQuota", () => {
  it("blocks a free user at the invoice limit", async () => {
    state.invoices = 5;
    const res = await requireInvoiceQuota("u1");
    expect(res!.status).toBe(403);
    expect((await res!.json()).code).toBe("INVOICE_LIMIT_REACHED");
  });

  it("passes a pro user", async () => {
    state.user = { plan: "pro", subscriptionExpiresAt: FUTURE };
    state.invoices = 500;
    expect(await requireInvoiceQuota("u1")).toBeNull();
  });
});

describe("requireYearExport", () => {
  it("blocks a free user", async () => {
    const res = await requireYearExport("u1", 2026);
    expect(res!.status).toBe(403);
    expect((await res!.json()).code).toBe("EXPORT_REQUIRES_UPGRADE");
  });

  it("passes a pro user", async () => {
    state.user = { plan: "pro", subscriptionExpiresAt: FUTURE };
    expect(await requireYearExport("u1", 2026)).toBeNull();
  });
});

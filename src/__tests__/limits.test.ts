import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the storage layer so we exercise the gate without a DB.
const state = {
  user: undefined as
    | { plan: string; subscriptionExpiresAt: string | Date | null }
    | undefined,
};

vi.mock("@/lib/server/storage", () => ({
  getUser: async () => state.user,
}));

import { requireWriteAccess } from "@/lib/server/limits";

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

beforeEach(() => {
  state.user = { plan: "free", subscriptionExpiresAt: null };
});

describe("requireWriteAccess", () => {
  it("blocks a FREE (read-only) user with 403 PRO_REQUIRED", async () => {
    state.user = { plan: "free", subscriptionExpiresAt: null };
    const res = await requireWriteAccess("u1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect((await res!.json()).code).toBe("PRO_REQUIRED");
  });

  it("blocks a user whose PRO subscription has lapsed", async () => {
    state.user = { plan: "pro", subscriptionExpiresAt: PAST };
    const res = await requireWriteAccess("u1");
    expect(res!.status).toBe(403);
  });

  it("allows an active PRO user", async () => {
    state.user = { plan: "pro", subscriptionExpiresAt: FUTURE };
    expect(await requireWriteAccess("u1")).toBeNull();
  });

  it("returns 404 for an unknown user", async () => {
    state.user = undefined;
    const res = await requireWriteAccess("nope");
    expect(res!.status).toBe(404);
  });
});

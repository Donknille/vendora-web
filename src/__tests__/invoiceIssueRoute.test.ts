import { describe, it, expect, vi, beforeEach } from "vitest";

// Auth + storage are mocked (no DB); under test is how the route maps the
// storage outcomes onto status codes — above all that an incomplete company
// profile is refused instead of producing an invoice without a sender.
const authState = { userId: "user1" as string | null };
const storageState = {
  result: { ok: true, invoice: { id: "inv1", invoiceNumber: "26-001" } } as unknown,
};

vi.mock("@/lib/server/auth", () => ({
  getAuthUserId: async () => authState.userId,
  requireActiveSubscription: async () => null,
}));

vi.mock("@/lib/server/limits", () => ({
  requireWriteAccess: async () => null,
}));

vi.mock("@/lib/server/storage", () => ({
  issueInvoice: async () => storageState.result,
  getInvoices: async () => [],
}));

import { POST } from "@/app/api/invoices/route";

function callIssue(body: unknown = { orderId: "o1" }) {
  const req = new Request("http://localhost/api/invoices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

describe("POST /api/invoices", () => {
  beforeEach(() => {
    authState.userId = "user1";
    storageState.result = { ok: true, invoice: { id: "inv1", invoiceNumber: "26-001" } };
  });

  it("issues an invoice for a complete profile", async () => {
    const res = await callIssue();
    expect(res.status).toBe(201);
  });

  it("refuses an invoice without name and address (§ 14 Abs. 4 UStG)", async () => {
    storageState.result = { ok: false, code: "profile_incomplete" };
    const res = await callIssue();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: "PROFILE_INCOMPLETE" });
  });

  it("still reports an already issued invoice separately", async () => {
    storageState.result = { ok: false, code: "already_issued" };
    const res = await callIssue();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: "ALREADY_ISSUED" });
  });

  it("answers 404 for an unknown order", async () => {
    storageState.result = { ok: false, code: "order_not_found" };
    expect((await callIssue()).status).toBe(404);
  });

  it("answers 400 without an orderId and 401 without a session", async () => {
    expect((await callIssue({})).status).toBe(400);
    authState.userId = null;
    expect((await callIssue()).status).toBe(401);
  });
});

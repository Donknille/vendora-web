import { describe, it, expect, vi, beforeEach } from "vitest";

// Auth + storage are mocked (no DB); what is under test is how the route maps
// the three storage outcomes onto status codes — in particular that a derived
// market cost row answers 409 instead of silently disappearing.
const authState = { userId: "user1" as string | null };
const storageState = { result: "deleted" as "deleted" | "not_found" | "derived" };

vi.mock("@/lib/server/auth", () => ({
  getAuthUserId: async () => authState.userId,
  requireActiveSubscription: async () => null,
}));

vi.mock("@/lib/server/storage", () => ({
  deleteExpense: async () => storageState.result,
}));

import { DELETE } from "@/app/api/expenses/[id]/route";

function callDelete(id = "e1") {
  const req = new Request(`http://localhost/api/expenses/${id}`, { method: "DELETE" });
  return DELETE(req, { params: Promise.resolve({ id }) });
}

describe("DELETE /api/expenses/[id]", () => {
  beforeEach(() => {
    authState.userId = "user1";
    storageState.result = "deleted";
  });

  it("deletes a manual expense", async () => {
    const res = await callDelete();
    expect(res.status).toBe(200);
  });

  it("answers 404 for an unknown id", async () => {
    storageState.result = "not_found";
    const res = await callDelete();
    expect(res.status).toBe(404);
  });

  it("answers 409 for a derived market cost row", async () => {
    storageState.result = "derived";
    const res = await callDelete();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: "DERIVED_EXPENSE" });
  });

  it("answers 401 without a session", async () => {
    authState.userId = null;
    const res = await callDelete();
    expect(res.status).toBe(401);
  });
});

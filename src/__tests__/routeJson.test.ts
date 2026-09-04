import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/server/auth", () => ({ getAuthUserId: async () => "user-1" }));

import { withAuth, withRoute } from "@/lib/server/route";

/**
 * Kaputtes JSON ist ein Eingabefehler. `request.json()` wirft einen
 * SyntaxError; der landete im generischen Fang und wurde als 500
 * protokolliert und beantwortet. Mutation zum Rotfahren: den
 * `instanceof SyntaxError`-Zweig in route.ts entfernen.
 */
describe("withRoute und kaputtes JSON", () => {
  const handler = withRoute("POST /api/test", async ({ request }) => {
    const body = await request.json();
    return Response.json({ ok: true, body });
  });

  it("antwortet 400 mit Code, nicht 500", async () => {
    const res = await handler(
      new Request("http://localhost/api/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ nicht json",
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "INVALID_JSON" });
  });

  it("laesst gueltiges JSON unveraendert durch", async () => {
    const res = await handler(
      new Request("http://localhost/api/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ a: 1 }),
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, body: { a: 1 } });
  });

  it("gilt auch hinter der Anmeldepruefung", async () => {
    const authed = withAuth("POST /api/test", async ({ request }) => {
      await request.json();
      return Response.json({ ok: true });
    });
    const res = await authed(
      new Request("http://localhost/api/test", { method: "POST", body: "[" })
    );
    expect(res.status).toBe(400);
  });

  it("meldet andere Fehler weiterhin als 500", async () => {
    const broken = withRoute("GET /api/test", async () => {
      throw new Error("db down");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await broken(new Request("http://localhost/api/test"));
    errorSpy.mockRestore();
    expect(res.status).toBe(500);
  });
});

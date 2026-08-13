import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { collectSourceFiles, rel, SRC } from "@/test-utils/sourceScan";

/**
 * Vertragstests ueber alle API-Routen (Refactoring-Plan 0.6).
 *
 * Phase 2.1 zieht das Geruest aus 36 Routen in einen gemeinsamen
 * withAuth-Helfer: 38 Mal derselbe 401-Block, 37 Mal derselbe 500-Fang. Der
 * Umbau ist genau dann verhaltensneutral, wenn Statuscode UND Meldungstext
 * gleich bleiben — der Text wird im Client uebersetzt (apiError.ts) und von
 * den Security-Guards geprueft.
 *
 * Deshalb steht hier nicht "irgendein Fehlercode", sondern wortwoertlich
 * `{ message: "Unauthorized" }` bei Status 401. Muss dieser Test beim Umbau
 * angepasst werden, ist der Umbau nicht verhaltensneutral gewesen.
 *
 * Die Routen werden gescannt, nicht aufgezaehlt: eine neue Route ist damit
 * automatisch mitgeprueft, statt jahrelang durchzurutschen.
 */

vi.mock("@/lib/server/auth", () => ({
  // Kein Session-Cookie: der Fall, den jede Route abfangen muss.
  getAuthUserId: async () => null,
}));

// Nie erreicht, solange die Routen zuerst die Anmeldung pruefen. Genau das ist
// die Aussage: greift eine Route vor dem Gate auf die Datenbank zu, wirft sie
// hier und faellt mit 500 statt 401 auf.
vi.mock("@/lib/server/storage", () => ({}));

const API_DIR = path.join(SRC, "app", "api");

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * Routen, die bewusst nicht ueber die Session gehen. Jede mit Grund — eine
 * Ausnahme ohne Begruendung ist ein Loch.
 */
const NOT_SESSION_AUTHENTICATED: Record<string, string> = {
  "src/app/api/auth/[...all]/route.ts": "Better Auths eigener Handler — er stellt die Sitzung erst aus.",
  "src/app/api/stripe/webhook/route.ts": "Signaturgeprueft (constructEvent), kommt von Stripe ohne Cookie.",
  "src/app/api/cron/retention/route.ts": "Vercel Cron, geschuetzt ueber CRON_SECRET im Authorization-Header.",
  "src/app/api/admin/check/route.ts":
    "Antwortet bewusst 200 mit isAdmin:false statt 401 — die Sidebar entscheidet " +
    "daran, ob der Admin-Link erscheint, und ein 401 waere dort ein Fehlerfall. " +
    "Eigener Test unten haelt fest, dass sie dabei nichts preisgibt.",
};

function routeUrl(file: string): string {
  const rest = rel(file).replace(/^src\/app/, "").replace(/\/route\.ts$/, "");
  // Platzhaltersegmente durch etwas Konkretes ersetzen.
  return `http://localhost${rest.replace(/\[\.\.\.[^\]]+\]/g, "x").replace(/\[[^\]]+\]/g, "x")}`;
}

const routeFiles = collectSourceFiles(API_DIR).filter((f) => f.endsWith("route.ts"));

describe("API-Vertrag: jede Route weist ohne Sitzung ab", () => {
  it("findet ueberhaupt Routen", () => {
    // Selbsttest: ein leergelaufener Scan waere sonst ein stiller Erfolg.
    expect(routeFiles.length).toBeGreaterThanOrEqual(30);
  });

  const gated = routeFiles.filter((f) => !(rel(f) in NOT_SESSION_AUTHENTICATED));

  it.each(gated.map((f) => [rel(f), f]))("%s", async (label, file) => {
    const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;

    const handlers = HTTP_METHODS.filter((m) => typeof mod[m] === "function");
    expect(handlers.length, `${label} exportiert keinen HTTP-Handler`).toBeGreaterThan(0);

    for (const method of handlers) {
      const handler = mod[method] as (
        req: Request,
        ctx: { params: Promise<Record<string, string>> }
      ) => Promise<Response>;

      const init: RequestInit = { method };
      if (method !== "GET" && method !== "DELETE") {
        init.body = JSON.stringify({});
        init.headers = { "Content-Type": "application/json" };
      }

      const res = await handler(new Request(routeUrl(file), init), {
        params: Promise.resolve({ id: "x", all: "x" }),
      });

      expect(res.status, `${label} ${method} ohne Sitzung`).toBe(401);
      await expect(res.json(), `${label} ${method} Meldung`).resolves.toEqual({
        message: "Unauthorized",
      });
    }
  });
});

describe("/api/admin/check — die eine Route, die ohne Sitzung 200 antwortet", () => {
  it("verraet ohne Sitzung nichts ausser isAdmin:false", async () => {
    // Der Vertragstest oben hat diese Abweichung gefunden; sie ist gewollt,
    // war aber nirgends festgehalten. Gewollt ist sie nur, solange die Antwort
    // genau ein Feld traegt: eine spaeter ergaenzte E-Mail oder Kennung waere
    // hier eine Preisgabe an jede beliebige anonyme Anfrage.
    const { GET } = await import("@/app/api/admin/check/route");
    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isAdmin: false });
  });
});

describe("API-Vertrag: die Ausnahmen sind vollzaehlig und begruendet", () => {
  it("jede Ausnahme zeigt auf eine existierende Route", () => {
    // Sonst bleibt ein Eintrag stehen, dessen Route laengst umgezogen ist —
    // und deren Nachfolgerin waere ungeprueft.
    const vorhanden = new Set(routeFiles.map(rel));
    for (const [pfad, grund] of Object.entries(NOT_SESSION_AUTHENTICATED)) {
      expect(vorhanden.has(pfad), `${pfad} existiert nicht mehr`).toBe(true);
      expect(grund.length, `${pfad} ohne Begruendung`).toBeGreaterThan(20);
    }
  });
});

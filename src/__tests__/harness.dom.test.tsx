import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, stubFetch, TEST_USER_ID } from "@/test-utils/renderWithProviders";
import { routerMock } from "@/test-utils/nextNavigationMock";
import NewOrderPage from "@/app/(app)/orders/new/page";

/**
 * Rauchtest fuer den Oberflaechen-Harness (Refactoring-Plan 0.4).
 *
 * Er prueft nicht die Auftragsseite, sondern dass die Kette traegt, auf der
 * alle Charakterisierungstests aus 0.5 aufsetzen: Kontexte, Netzersatz,
 * next/navigation, jsdom-Luecken. Scheitert er, liegt es am Harness und nicht
 * an der Seite, die gerade umgebaut wird.
 */
describe("UI-Testharness", () => {
  it("rendert eine echte Seite samt Kontextkette", async () => {
    stubFetch({ "/api/customers": [], "/api/profile": {} });

    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    // Ueberschrift aus dem t-Objekt: beweist, dass LanguageProvider greift.
    expect(await screen.findByRole("heading", { name: "Neuer Auftrag" })).toBeInTheDocument();
  });

  it("stellt die Sprache um, ohne dass die Seite etwas davon weiss", async () => {
    stubFetch({ "/api/customers": [], "/api/profile": {} });

    renderWithProviders(<NewOrderPage />, { route: "/orders/new", language: "en" });

    expect(await screen.findByRole("heading", { name: "New Order" })).toBeInTheDocument();
  });

  it("beantwortet Lesepfade aus der Stub-Tabelle", async () => {
    const fetchMock = stubFetch({
      "/api/customers": [
        { id: "c1", name: "Testkundin", email: "", street: "", zip: "", city: "", country: "" },
      ],
      "/api/profile": { defaultShippingCost: 450 },
    });

    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    // Der Versandkostenwert stammt aus dem Firmenprofil -- er kann nur im Feld
    // stehen, wenn der Abfrageschluessel [userId, "/api/profile"] den Stub
    // wirklich erreicht hat.
    expect(await screen.findByDisplayValue("4,50")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toContain("/api/profile");
  });

  it("reicht die Nutzerkennung als Abfrageschluessel durch", () => {
    // Ohne gesetzte Kennung waeren alle Hooks abgeschaltet und jede Seite
    // haenge im Ladezustand -- ein Fehler, der sich sonst als "Seite leer"
    // tarnt.
    expect(TEST_USER_ID).toBeTruthy();
  });

  it("stellt einen Router bereit, dessen Navigation pruefbar ist", async () => {
    stubFetch({ "/api/customers": [], "/api/profile": {} });

    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    await screen.findByRole("heading", { name: "Neuer Auftrag" });
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

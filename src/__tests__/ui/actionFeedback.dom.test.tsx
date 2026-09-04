import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { routerMock } from "@/test-utils/nextNavigationMock";
import {
  expensesFixture,
  marketFixture,
  marketSalesFixture,
  orderFixture,
  profileFixture,
  subscriptionFixture,
} from "@/test-utils/fixtures";
import ExpensesPage from "@/app/(app)/expenses/page";
import OrderDetailPage from "@/app/(app)/orders/[id]/page";
import MarketDetailPage from "@/app/(app)/markets/[id]/page";

/**
 * Was eine Aktion zurueckmeldet.
 *
 * Zwei Regeln, beide hier festgehalten:
 *
 * 1. Der Fehler einer bestaetigten Aktion erscheint im Dialog, uebersetzt.
 *    Die Server-Meldung ("Expense not found") wird nicht durchgereicht.
 * 2. Der Erfolg einer Aktion, die anschliessend die Seite wechselt, erscheint
 *    als Toast. Sonst ist am Ziel nicht zu erkennen, ob etwas passiert ist.
 *
 * Anders als die Charakterisierungstests daneben bedienen diese Faelle die
 * Seite wirklich — Knopf, Dialog, Antwort — statt nur den ersten Render
 * festzuhalten.
 */

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Wie `stubFetch`, aber mit einem Vorrang fuer schreibende Aufrufe: die
 * Tabelle kennt nur Pfade, ein DELETE und ein GET auf `/api/expenses/…`
 * liessen sich damit nicht unterscheiden.
 */
function stubFetchWith(routes: Record<string, unknown>, handler: Handler) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const custom = handler(url, init);
    if (custom) return custom;

    const key = Object.keys(routes).find((r) => url.startsWith(r));
    if (key === undefined) return json({ message: `Kein Stub fuer ${url}` }, 404);
    return json(routes[key], 200);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

const BASE = {
  "/api/profile": profileFixture,
  "/api/subscription": subscriptionFixture,
};

describe("Ausgabe löschen — Fehler", () => {
  const ROUTES = {
    ...BASE,
    "/api/expenses": expensesFixture,
    "/api/markets": [marketFixture],
  };

  /**
   * Der Fall aus dem Betrieb: auf dem Markt bricht die Verbindung weg oder ein
   * zweites Geraet hat die Zeile schon geloescht. Der Server antwortet 404
   * "Expense not found" — englisch und nichtssagend.
   *
   * Mutation zum Rotfahren: `errorFallback` am ConfirmDialog in
   * expenses/page.tsx entfernen; dann steht dort der allgemeine Satz.
   * Zusaetzlich in ConfirmDialog.tsx auf `err.message` zurueckbauen; dann
   * steht dort "Expense not found".
   */
  it("zeigt den übersetzten Satz im Dialog, nicht die Server-Meldung", async () => {
    const user = userEvent.setup();
    stubFetchWith(ROUTES, (url, init) =>
      init?.method === "DELETE" && url.startsWith("/api/expenses/")
        ? json({ message: "Expense not found" }, 404)
        : undefined,
    );

    renderWithProviders(<ExpensesPage />, { route: "/expenses" });
    await screen.findByText("Ton, 25 kg");

    await user.click(screen.getByRole("button", { name: "Ausgabe löschen" }));
    await user.click(screen.getByRole("button", { name: "Löschen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ausgabe konnte nicht gelöscht werden.",
    );
    expect(screen.queryByText(/Expense not found/)).not.toBeInTheDocument();
    // Der Dialog bleibt offen: die Ausgabe ist nicht weg, ein zweiter Versuch
    // ist einen Klick entfernt.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("Auftrag löschen — Rückmeldung nach dem Seitenwechsel", () => {
  const ROUTES = {
    ...BASE,
    "/api/orders": [orderFixture],
    "/api/invoices": [],
  };

  /**
   * Mutation zum Rotfahren: `showSuccess(t.orders.deleted)` in `handleDelete`
   * entfernen.
   */
  it("meldet das Löschen auf dem Weg zurück zur Liste", async () => {
    const user = userEvent.setup();
    stubFetchWith(ROUTES, (url, init) =>
      init?.method === "DELETE" && url.startsWith("/api/orders/")
        ? json({ message: "Order deleted" }, 200)
        : undefined,
    );

    renderWithProviders(<OrderDetailPage />, {
      route: `/orders/${orderFixture.id}`,
      params: { id: orderFixture.id },
    });
    await screen.findByRole("heading", { name: "Auftragsdetails" });

    await user.click(screen.getByRole("button", { name: "Auftrag löschen" }));
    await user.click(screen.getByRole("button", { name: "Löschen" }));

    expect(await screen.findByText("Auftrag gelöscht.")).toBeInTheDocument();
    expect(routerMock.push).toHaveBeenCalledWith("/orders");
  });
});

describe("Marktdetail — Rückmeldung nach dem Seitenwechsel", () => {
  const ROUTES = {
    ...BASE,
    "/api/markets/market-1/sales": marketSalesFixture,
    "/api/market-sales": marketSalesFixture,
    "/api/markets": [marketFixture],
  };

  const render = () =>
    renderWithProviders(<MarketDetailPage />, {
      route: "/markets/market-1",
      params: { id: "market-1" },
    });

  /**
   * Kopieren fuehrt in das Formular der KOPIE. Ohne Meldung sieht das aus, als
   * haette man den urspruenglichen Markt zum Bearbeiten geoeffnet — der
   * Woerterbucheintrag `markets.copied` lag dafuer seit jeher bereit, nur ohne
   * Aufrufer.
   *
   * Mutation zum Rotfahren: `showSuccess(t.markets.copied)` in `handleCopy`
   * entfernen.
   */
  it("meldet das Kopieren, weil danach das Formular der Kopie offen ist", async () => {
    const user = userEvent.setup();
    stubFetchWith(ROUTES, (url, init) =>
      init?.method === "POST" && url.endsWith("/copy")
        ? json({ ...marketFixture, id: "market-2" }, 200)
        : undefined,
    );

    render();
    await screen.findByRole("heading", { name: "Marktdetails" });

    await user.click(screen.getByRole("button", { name: "Markt kopieren" }));

    expect(await screen.findByText("Markt wurde kopiert")).toBeInTheDocument();
    expect(routerMock.push).toHaveBeenCalledWith("/markets/market-2/edit");
  });

  /**
   * Mutation zum Rotfahren: `showSuccess(t.markets.deleted)` in
   * `handleDeleteMarket` entfernen.
   */
  it("meldet das Löschen auf dem Weg zurück zur Liste", async () => {
    const user = userEvent.setup();
    stubFetchWith(ROUTES, (url, init) =>
      init?.method === "DELETE" && url.startsWith("/api/markets/market-1")
        ? json({ message: "Market deleted" }, 200)
        : undefined,
    );

    render();
    await screen.findByRole("heading", { name: "Marktdetails" });

    await user.click(screen.getAllByRole("button", { name: "Markt löschen" })[0]);
    await user.click(screen.getByRole("button", { name: "Löschen" }));

    expect(await screen.findByText("Markt gelöscht.")).toBeInTheDocument();
    expect(routerMock.push).toHaveBeenCalledWith("/markets");
  });

  /**
   * Die Kehrseite: scheitert das Löschen, gibt es KEINE Erfolgsmeldung — und
   * der Fehler steht auf der Seite.
   *
   * Mutation zum Rotfahren: `showSuccess` in `handleDeleteMarket` vor den
   * `await`-Aufruf ziehen.
   */
  it("meldet keinen Erfolg, wenn das Löschen scheitert", async () => {
    const user = userEvent.setup();
    stubFetchWith(ROUTES, (url, init) =>
      init?.method === "DELETE" && url.startsWith("/api/markets/market-1")
        ? json({ message: "Market not found" }, 404)
        : undefined,
    );

    render();
    await screen.findByRole("heading", { name: "Marktdetails" });

    await user.click(screen.getAllByRole("button", { name: "Markt löschen" })[0]);
    await user.click(screen.getByRole("button", { name: "Löschen" }));

    expect(await screen.findByText("Markt konnte nicht gelöscht werden.")).toBeInTheDocument();
    expect(screen.queryByText("Markt gelöscht.")).not.toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

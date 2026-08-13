import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, stubFetch } from "@/test-utils/renderWithProviders";
import {
  FIXED_NOW,
  expensesFixture,
  marketFixture,
  marketSalesFixture,
  orderFixture,
  paidOrderFixture,
  profileFixture,
  subscriptionFixture,
} from "@/test-utils/fixtures";
import DashboardPage from "@/app/(app)/dashboard/page";
import OrdersPage from "@/app/(app)/orders/page";
import MarketsPage from "@/app/(app)/markets/page";
import ExpensesPage from "@/app/(app)/expenses/page";

/**
 * Charakterisierungstests fuer die Uebersichtsseiten (Refactoring-Plan 0.5).
 *
 * Alle vier stehen in Phase 4.5 zur Zerlegung an. Neben dem Normalfall wird
 * hier jeweils der Leer- und der Fehlerzustand festgehalten — genau die
 * Unterscheidung, um die es in useAppQuery geht und die schon einmal verloren
 * ging ("Noch keine Ausgaben" ueber sechs echten Ausgaben).
 */

const DASHBOARD_PAYLOAD = {
  orders: [paidOrderFixture],
  expenses: expensesFixture,
  markets: [marketFixture],
  marketSales: marketSalesFixture,
};

const EMPTY_PAYLOAD = { orders: [], expenses: [], markets: [], marketSales: [] };

const BASE_ROUTES = {
  "/api/profile": profileFixture,
  "/api/subscription": subscriptionFixture,
  "/api/euer/unlocks": { years: [] },
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("dashboard", () => {
  it("rendert die Kennzahlen unveraendert", async () => {
    stubFetch({ ...BASE_ROUTES, "/api/dashboard": DASHBOARD_PAYLOAD });
    const { container } = renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    // Umsatz = bezahlter Auftrag (34,50) + Marktverkaeufe (2x15,00 + 22,00).
    // Der Betrag steht in der Kennzahlenkachel und noch einmal in der
    // Monatstabelle — beides ist gewollt, deshalb nur "kommt vor".
    expect(await screen.findAllByText("€86,50")).not.toHaveLength(0);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("zeigt den Leerzustand, wenn nichts gebucht ist", async () => {
    stubFetch({ ...BASE_ROUTES, "/api/dashboard": EMPTY_PAYLOAD });
    renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    expect(await screen.findAllByText("€0,00")).not.toHaveLength(0);
  });

  it("unterscheidet einen gescheiterten Abruf vom leeren Ergebnis", async () => {
    // Kein Stub fuer /api/dashboard -> 404 -> isError. Der Leerzustand waere
    // hier die falsche Antwort: er behauptet, es gaebe nichts zu sehen.
    stubFetch(BASE_ROUTES);
    renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    expect(await screen.findByRole("button", { name: /erneut|nochmal|retry/i })).toBeInTheDocument();
  });
});

describe("orders — Liste", () => {
  it("rendert die Auftragsliste unveraendert", async () => {
    stubFetch({ ...BASE_ROUTES, "/api/orders": [orderFixture, paidOrderFixture] });
    const { container } = renderWithProviders(<OrdersPage />, { route: "/orders" });

    expect(await screen.findAllByText("Anna Beispiel")).toHaveLength(2);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("zeigt den Leerzustand ohne Auftraege", async () => {
    stubFetch({ ...BASE_ROUTES, "/api/orders": [] });
    renderWithProviders(<OrdersPage />, { route: "/orders" });

    expect(await screen.findByText("Noch keine Aufträge")).toBeInTheDocument();
  });

  it("unterscheidet einen gescheiterten Abruf vom leeren Ergebnis", async () => {
    stubFetch(BASE_ROUTES);
    renderWithProviders(<OrdersPage />, { route: "/orders" });

    expect(await screen.findByRole("button", { name: /erneut|nochmal|retry/i })).toBeInTheDocument();
    expect(screen.queryByText("Noch keine Aufträge")).not.toBeInTheDocument();
  });
});

describe("markets — Liste", () => {
  it("rendert die Marktliste unveraendert", async () => {
    stubFetch({
      ...BASE_ROUTES,
      "/api/markets": [marketFixture],
      "/api/market-sales": marketSalesFixture,
    });
    const { container } = renderWithProviders(<MarketsPage />, { route: "/markets" });

    expect(await screen.findByText("Frühlingsmarkt")).toBeInTheDocument();
    expect(container.firstChild).toMatchSnapshot();
  });

  it("unterscheidet einen gescheiterten Abruf vom leeren Ergebnis", async () => {
    stubFetch(BASE_ROUTES);
    renderWithProviders(<MarketsPage />, { route: "/markets" });

    expect(await screen.findByRole("button", { name: /erneut|nochmal|retry/i })).toBeInTheDocument();
  });
});

describe("expenses — Liste", () => {
  it("rendert Ausgaben inklusive abgeleiteter Marktkosten", async () => {
    stubFetch({
      ...BASE_ROUTES,
      "/api/expenses": expensesFixture,
      "/api/markets": [marketFixture],
    });
    const { container } = renderWithProviders(<ExpensesPage />, { route: "/expenses" });

    // Die abgeleitete Zeile ist sichtbar, aber nur am Markt aenderbar — die
    // Regel aus marketCosts.ts, hier an der Oberflaeche festgehalten.
    expect(await screen.findByText("Ton, 25 kg")).toBeInTheDocument();
    expect(screen.getAllByText(/Standgebühr/)).not.toHaveLength(0);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("unterscheidet einen gescheiterten Abruf vom leeren Ergebnis", async () => {
    stubFetch({ ...BASE_ROUTES, "/api/markets": [] });
    renderWithProviders(<ExpensesPage />, { route: "/expenses" });

    expect(await screen.findByRole("button", { name: /erneut|nochmal|retry/i })).toBeInTheDocument();
  });
});

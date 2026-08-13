import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, stubFetch } from "@/test-utils/renderWithProviders";
import {
  FIXED_NOW,
  marketFixture,
  marketSalesFixture,
  profileFixture,
  subscriptionFixture,
} from "@/test-utils/fixtures";
import MarketDetailPage from "@/app/(app)/markets/[id]/page";
import KassePage from "@/app/(app)/markets/[id]/kasse/page";
import SettingsPage from "@/app/(app)/settings/page";

/**
 * Charakterisierungstests fuer die drei groessten Einzelseiten
 * (Refactoring-Plan 0.5): Marktdetail (577 Z.), Kasse (421 Z.) und
 * Einstellungen (740 Z.). Alle drei zerlegt Phase 4.4/4.5 in Abschnitte.
 */

const MARKET_ROUTES = {
  "/api/markets/market-1/sales": marketSalesFixture,
  "/api/market-sales": marketSalesFixture,
  "/api/markets": [marketFixture],
  "/api/profile": profileFixture,
  "/api/subscription": subscriptionFixture,
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("markets/[id] — Marktdetail", () => {
  const renderDetail = () =>
    renderWithProviders(<MarketDetailPage />, {
      route: "/markets/market-1",
      params: { id: "market-1" },
    });

  it("rendert die Detailseite unveraendert", async () => {
    stubFetch(MARKET_ROUTES);
    const { container } = renderDetail();

    await screen.findByRole("heading", { name: "Marktdetails" });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("weist Umsatz, Kosten und Gewinn aus", async () => {
    stubFetch(MARKET_ROUTES);
    renderDetail();

    await screen.findByRole("heading", { name: "Marktdetails" });
    // Umsatz 2x15,00 + 1x22,00 = 52,00. Kosten 45,00 + 12,00 = 57,00.
    // Gewinn also -5,00 — ein Minus ist hier ein gueltiges Ergebnis und darf
    // beim Umbau nicht zu 0,00 werden.
    expect(screen.getAllByText("€52,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("€45,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("€12,00").length).toBeGreaterThan(0);
    // formatCurrency setzt das Minus hinter das Waehrungszeichen: "€-5,00".
    // Sieht ungewohnt aus, ist aber der Bestand — festhalten, nicht angleichen.
    expect(screen.getAllByText("€-5,00").length).toBeGreaterThan(0);
  });

  it("listet die erfassten Verkaeufe", async () => {
    stubFetch(MARKET_ROUTES);
    renderDetail();

    await screen.findByRole("heading", { name: "Marktdetails" });
    expect(screen.getAllByText(/Tasse/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Schale/).length).toBeGreaterThan(0);
  });

  it("unterscheidet einen gescheiterten Abruf vom leeren Ergebnis", async () => {
    stubFetch({ "/api/subscription": subscriptionFixture });
    renderDetail();

    expect(await screen.findByRole("button", { name: /erneut|nochmal|retry/i })).toBeInTheDocument();
  });
});

describe("markets/[id]/kasse — Kassenmodus", () => {
  it("rendert die Kasse unveraendert", async () => {
    stubFetch(MARKET_ROUTES);
    const { container } = renderWithProviders(<KassePage />, {
      route: "/markets/market-1/kasse",
      params: { id: "market-1" },
    });

    await screen.findByRole("heading", { name: "Frühlingsmarkt" });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("bietet je hinterlegtem Schnellartikel eine Taste", async () => {
    stubFetch(MARKET_ROUTES);
    renderWithProviders(<KassePage />, {
      route: "/markets/market-1/kasse",
      params: { id: "market-1" },
    });

    await screen.findByRole("heading", { name: "Frühlingsmarkt" });
    expect(screen.getAllByText("Tasse").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Schale").length).toBeGreaterThan(0);
  });
});

describe("settings — Einstellungen", () => {
  const renderSettings = () =>
    renderWithProviders(<SettingsPage />, { route: "/settings" });

  it("rendert alle Abschnitte unveraendert", async () => {
    stubFetch({ "/api/profile": profileFixture, "/api/subscription": subscriptionFixture });
    const { container } = renderSettings();

    await screen.findByRole("heading", { name: "Einstellungen" });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("uebernimmt das Firmenprofil in das Formular", async () => {
    stubFetch({ "/api/profile": profileFixture, "/api/subscription": subscriptionFixture });
    renderSettings();

    await screen.findByRole("heading", { name: "Einstellungen" });
    expect(await screen.findByDisplayValue("Keramik Krug")).toBeInTheDocument();
    expect(screen.getByDisplayValue("hallo@keramik-krug.de")).toBeInTheDocument();
    // Standard-Versandkosten 450 Cent als Euro-Eingabe.
    expect(screen.getByDisplayValue("4,50")).toBeInTheDocument();
  });

  it("zeigt Firmenprofil, Darstellung, Sprache, Daten und Datenschutz", async () => {
    stubFetch({ "/api/profile": profileFixture, "/api/subscription": subscriptionFixture });
    renderSettings();

    await screen.findByRole("heading", { name: "Einstellungen" });
    for (const abschnitt of ["Firmenprofil", "Darstellung", "Sprache", "Daten & Sicherung", "Datenschutz"]) {
      expect(screen.getAllByText(abschnitt).length, abschnitt).toBeGreaterThan(0);
    }
  });

  it("laedt den Backup-Export als Datei herunter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubFetch({
      "/api/profile": profileFixture,
      "/api/subscription": subscriptionFixture,
      "/api/export": { orders: [], markets: [] },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderSettings();
    await screen.findByRole("heading", { name: "Einstellungen" });
    await user.click(screen.getByRole("button", { name: /Backup exportieren/i }));

    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});

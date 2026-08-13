import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, stubFetch } from "@/test-utils/renderWithProviders";
import { FIXED_NOW, marketFixture } from "@/test-utils/fixtures";
import NewMarketPage from "@/app/(app)/markets/new/page";
import EditMarketPage from "@/app/(app)/markets/[id]/edit/page";

/**
 * Charakterisierungstests fuer die beiden Marktformulare
 * (Refactoring-Plan 0.5).
 *
 * 160 von 300 Zeilen in markets/new stehen so auch in markets/[id]/edit;
 * Phase 4.3 zieht daraus ein gemeinsames MarketForm.
 *
 * Nebenbei halten die Snapshots eine Abweichung fest, die im Plan als Risiko R2
 * steht: die Bearbeiten-Seite benutzt bereits `inputClass` aus styles.ts
 * (rounded-xl, bg-input), die Neu-Seite dieselben Felder als Inline-Klassen
 * (rounded-lg, bg-surface). Die beiden sehen also heute unterschiedlich aus.
 * Das anzugleichen waere eine sichtbare Aenderung und gehoert nicht in ein
 * verhaltensneutrales Refactoring — bis dahin ist der Unterschied hier
 * dokumentiert statt vergessen.
 */

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FIXED_NOW);
  stubFetch({ "/api/markets": [marketFixture] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("markets/new — Markt anlegen", () => {
  it("rendert das leere Formular unveraendert", async () => {
    const { container } = renderWithProviders(<NewMarketPage />, { route: "/markets/new" });

    await screen.findByRole("heading", { name: "Neuer Markt" });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("setzt das Marktdatum auf heute", async () => {
    renderWithProviders(<NewMarketPage />, { route: "/markets/new" });

    await screen.findByRole("heading", { name: "Neuer Markt" });
    expect(screen.getByDisplayValue("2026-03-15")).toBeInTheDocument();
  });

  it("startet ohne Schnellverkaufs-Artikel", async () => {
    renderWithProviders(<NewMarketPage />, { route: "/markets/new" });

    await screen.findByRole("heading", { name: "Neuer Markt" });
    expect(screen.queryByPlaceholderText("Artikelname")).not.toBeInTheDocument();
  });

  it("nimmt Schnellverkaufs-Artikel auf", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NewMarketPage />, { route: "/markets/new" });

    await screen.findByRole("heading", { name: "Neuer Markt" });
    await user.click(screen.getAllByRole("button", { name: "Artikel hinzufügen" })[0]);

    expect(screen.getByPlaceholderText("Artikelname")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0,00 €")).toBeInTheDocument();
  });

  it("laesst sich ohne Marktnamen nicht abschicken", async () => {
    renderWithProviders(<NewMarketPage />, { route: "/markets/new" });

    await screen.findByRole("heading", { name: "Neuer Markt" });
    const submit = screen.getByRole("button", { name: "Markt erstellen" });
    expect(submit).toBeDisabled();
  });

  it("gibt den Knopf frei, sobald ein Name dasteht", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NewMarketPage />, { route: "/markets/new" });

    await screen.findByRole("heading", { name: "Neuer Markt" });
    await user.type(screen.getByPlaceholderText("Marktname"), "Herbstmarkt");

    expect(screen.getByRole("button", { name: "Markt erstellen" })).toBeEnabled();
  });
});

describe("markets/[id]/edit — Markt bearbeiten", () => {
  const renderEdit = () =>
    renderWithProviders(<EditMarketPage />, {
      route: "/markets/market-1/edit",
      params: { id: "market-1" },
    });

  it("rendert das befuellte Formular unveraendert", async () => {
    const { container } = renderEdit();

    await screen.findByRole("heading", { name: "Markt bearbeiten" });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("uebernimmt Stammdaten und Kosten des Marktes", async () => {
    renderEdit();

    await screen.findByRole("heading", { name: "Markt bearbeiten" });
    expect(screen.getByDisplayValue("Frühlingsmarkt")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Marktplatz Musterstadt")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-03-14")).toBeInTheDocument();
    // Standgebuehr 4500 Cent, Fahrtkosten 1200 Cent.
    expect(screen.getByDisplayValue("45,00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12,00")).toBeInTheDocument();
  });

  it("uebernimmt die hinterlegten Schnellverkaufs-Artikel", async () => {
    renderEdit();

    await screen.findByRole("heading", { name: "Markt bearbeiten" });
    expect(screen.getByDisplayValue("Tasse")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Schale")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Artikelname")).toHaveLength(2);
  });

  it("zeigt den gebuchten Status des Marktes", async () => {
    const { container } = renderEdit();

    await screen.findByRole("heading", { name: "Markt bearbeiten" });
    // Der Status entscheidet, ob Standgebuehr und Fahrtkosten als Ausgaben
    // gebucht werden (shouldBookMarketCosts). Ein stiller Wechsel hier waere
    // eine Aenderung an der EUER.
    const status = container.querySelector("select") as HTMLSelectElement;
    expect(status.value).toBe("confirmed");
  });
});

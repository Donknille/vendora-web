import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, stubFetch } from "@/test-utils/renderWithProviders";
import { routerMock } from "@/test-utils/nextNavigationMock";
import {
  FIXED_NOW,
  customersFixture,
  orderFixture,
  profileFixture,
} from "@/test-utils/fixtures";
import NewOrderPage from "@/app/(app)/orders/new/page";
import EditOrderPage from "@/app/(app)/orders/[id]/edit/page";

/**
 * Charakterisierungstests fuer die beiden Auftragsformulare
 * (Refactoring-Plan 0.5).
 *
 * Sie beschreiben nicht, was richtig waere, sondern was heute passiert. Von
 * 420 Zeilen in orders/new sind 384 Zeile fuer Zeile identisch mit
 * orders/[id]/edit; Phase 4.2 zieht daraus ein gemeinsames OrderForm. Diese
 * Datei ist der Vertrag, gegen den das geprueft wird: die Snapshots muessen
 * danach unveraendert sein.
 *
 * Ausdruecklich mit festgehaltener Uhr: orders/new setzt das Auftragsdatum auf
 * heute. Ohne setSystemTime waere der Snapshot ab morgen rot.
 */

const READ_ROUTES = {
  "/api/customers": customersFixture,
  "/api/profile": profileFixture,
  "/api/orders": [orderFixture],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FIXED_NOW);
  stubFetch(READ_ROUTES);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("orders/new — Auftrag anlegen", () => {
  it("rendert das leere Formular unveraendert", async () => {
    const { container } = renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    await screen.findByRole("heading", { name: "Neuer Auftrag" });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("setzt das Auftragsdatum auf heute", async () => {
    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    await screen.findByRole("heading", { name: "Neuer Auftrag" });
    expect(screen.getByDisplayValue("2026-03-15")).toBeInTheDocument();
  });

  it("uebernimmt die Versandkosten aus dem Firmenprofil", async () => {
    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    expect(await screen.findByDisplayValue("4,50")).toBeInTheDocument();
  });

  it("fuellt die Anschrift aus dem Kundenstamm, sobald der Name passt", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    await screen.findByRole("heading", { name: "Neuer Auftrag" });
    await user.type(screen.getByPlaceholderText("Kundenname"), "Anna Beispiel");

    expect(screen.getByDisplayValue("anna@example.org")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Musterstraße 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10115")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Berlin")).toBeInTheDocument();
  });

  it("rechnet Zwischensumme, Versand und Gesamt in Cent", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    await screen.findByRole("heading", { name: "Neuer Auftrag" });
    await user.type(screen.getByPlaceholderText("Artikelname"), "Vase");

    // Zwei Felder tragen den Platzhalter "0,00": der Positionspreis und die
    // Versandkosten. Gemeint ist der Preis, also das erste.
    const [itemPrice] = screen.getAllByPlaceholderText("0,00");
    await user.type(itemPrice, "25,50");

    // 1 x 25,50 Zwischensumme, dazu 4,50 Versand aus dem Firmenprofil.
    expect(screen.getByText("€25,50")).toBeInTheDocument();
    expect(screen.getByText("€30,00")).toBeInTheDocument();
  });

  it("nimmt weitere Positionen auf und entfernt sie wieder", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    await screen.findByRole("heading", { name: "Neuer Auftrag" });
    expect(screen.getAllByPlaceholderText("Artikelname")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Position|Artikel/i }));
    expect(screen.getAllByPlaceholderText("Artikelname")).toHaveLength(2);

    // Die letzte verbliebene Position traegt keinen Loeschknopf — das Formular
    // soll nie ganz ohne Zeile dastehen.
    const removeButtons = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("hover:text-red-400"));
    expect(removeButtons).toHaveLength(2);

    await user.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText("Artikelname")).toHaveLength(1);
  });

  it("verlangt Name, Strasse, PLZ und Ort, bevor gespeichert wird", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    await screen.findByRole("heading", { name: "Neuer Auftrag" });
    await user.click(screen.getByRole("button", { name: "Auftrag erstellen" }));

    expect(screen.getByText("Bitte gib einen Kundennamen ein.")).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("meldet fehlende Artikelnamen erst nach vollstaendiger Anschrift", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<NewOrderPage />, { route: "/orders/new" });

    await screen.findByRole("heading", { name: "Neuer Auftrag" });
    await user.type(screen.getByPlaceholderText("Kundenname"), "Anna Beispiel");
    await user.click(screen.getByRole("button", { name: "Auftrag erstellen" }));

    expect(screen.getByText("Bitte fülle alle Artikelnamen aus.")).toBeInTheDocument();
  });
});

describe("orders/[id]/edit — Auftrag bearbeiten", () => {
  const renderEdit = () =>
    renderWithProviders(<EditOrderPage />, {
      route: "/orders/order-1/edit",
      params: { id: "order-1" },
    });

  it("rendert das befuellte Formular unveraendert", async () => {
    const { container } = renderEdit();

    await screen.findByRole("heading", { name: "Auftrag bearbeiten" });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("uebernimmt alle Felder des Auftrags", async () => {
    renderEdit();

    await screen.findByRole("heading", { name: "Auftrag bearbeiten" });
    expect(screen.getByDisplayValue("Anna Beispiel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("anna@example.org")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Musterstraße 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-03-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-03-05")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bitte in Geschenkpapier einpacken.")).toBeInTheDocument();
  });

  it("zeigt die Positionen als Euro-Eingaben", async () => {
    renderEdit();

    await screen.findByRole("heading", { name: "Auftrag bearbeiten" });
    expect(screen.getByDisplayValue("Vase groß")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25,00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Untersetzer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2,50")).toBeInTheDocument();
  });

  it("uebernimmt die Versandkosten des Auftrags, nicht die des Profils", async () => {
    // Beide sind hier zufaellig 4,50 — deshalb wird geprueft, dass genau ein
    // Versandfeld existiert und es den Wert des Auftrags traegt. Ein Wechsel
    // auf den Profilwert waere eine stille Betragsaenderung an einem
    // bestehenden Auftrag.
    renderEdit();

    await screen.findByRole("heading", { name: "Auftrag bearbeiten" });
    const shipping = screen.getByLabelText("Versandkosten") as HTMLInputElement;
    expect(shipping.value).toBe("4,50");
  });

  it("bietet die Zahlungsarten an, die orders/new nicht kennt", async () => {
    const { container } = renderEdit();

    await screen.findByRole("heading", { name: "Auftrag bearbeiten" });

    // Nicht ueber die Rolle "combobox" gesucht: das Kundennamensfeld traegt ein
    // `list`-Attribut und zaehlt damit ebenfalls als combobox. Gemeint ist das
    // echte <select>.
    const selects = container.querySelectorAll("select");
    expect(selects).toHaveLength(1);
    const paymentMethod = selects[0] as HTMLSelectElement;

    expect(within(paymentMethod).getByRole("option", { name: "Bar" })).toBeInTheDocument();
    expect(within(paymentMethod).getByRole("option", { name: "Karte" })).toBeInTheDocument();
  });

  it("verlangt beim Bearbeiten nur den Kundennamen", async () => {
    // Festgehaltene Abweichung, kein Wunschverhalten: die Neu-Seite prueft
    // zusaetzlich Strasse, PLZ und Ort. Eine der beiden ist falsch — das zu
    // entscheiden ist eine fachliche Frage und gehoert nicht in ein
    // verhaltensneutrales Refactoring. Bis dahin haelt dieser Test den
    // Unterschied fest, damit ihn niemand versehentlich einebnet.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderEdit();

    await screen.findByRole("heading", { name: "Auftrag bearbeiten" });
    await user.clear(screen.getByDisplayValue("Musterstraße 1"));
    await user.clear(screen.getByDisplayValue("10115"));
    await user.clear(screen.getByDisplayValue("Berlin"));
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.queryByText("Bitte gib einen Kundennamen ein.")).not.toBeInTheDocument();
  });
});

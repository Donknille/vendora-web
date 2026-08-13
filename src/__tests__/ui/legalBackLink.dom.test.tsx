import { describe, it, expect, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { routerMock } from "@/test-utils/nextNavigationMock";
import { BackLink } from "@/components/legal/BackLink";

/**
 * Der Zurueck-Pfeil der Rechtsseiten war vorher ein
 * `<Link href="javascript:void(0)">` mit onClick. Zwei Fehler in einem:
 *
 *  - Die eigene CSP blockiert `javascript:`-URLs. Der Klick lief nur ueber den
 *    Handler und meldete jedes Mal einen Verstoss.
 *  - Wer direkt auf der Seite landet — Impressum aus einer Suchmaschine, oder
 *    ueber die Rechtstext-Links der Registrierung, die in einem NEUEN Tab
 *    oeffnen —, hat keine History. Der Pfeil tat schlicht nichts.
 *
 * Der zweite Fall ist der, den man im Browser leicht uebersieht: in einem
 * Automatisierungs-Tab steht history.length wegen der leeren Startseite schon
 * bei 2. Deshalb steht der Nachweis hier und nicht in einem Klickpfad.
 */

const setHistoryLength = (length: number) => {
  Object.defineProperty(window.history, "length", {
    value: length,
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(window.history, "length", {
    value: 1,
    configurable: true,
  });
});

describe("BackLink der Rechtsseiten", () => {
  it("springt zurueck, wenn es eine History gibt", async () => {
    setHistoryLength(3);
    renderWithProviders(<BackLink />, { route: "/legal/impressum" });

    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("geht auf die Startseite, wenn dieser Tab nur diese eine Seite kennt", async () => {
    setHistoryLength(1);
    renderWithProviders(<BackLink />, { route: "/legal/impressum" });

    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

    // "/" und nicht "/landing": der Proxy entscheidet anhand der Sitzung, ob
    // von dort das Dashboard oder die Landingpage kommt.
    expect(routerMock.push).toHaveBeenCalledWith("/");
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it("ist ein Knopf, kein Anker ohne Ziel", () => {
    const { container } = renderWithProviders(<BackLink />, { route: "/legal/impressum" });

    expect(container.querySelector("button")).not.toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
});

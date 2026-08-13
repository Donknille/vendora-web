import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, stubFetch } from "@/test-utils/renderWithProviders";
import LoginPage from "@/app/auth/login/page";
import RegisterPage from "@/app/auth/register/page";
import ResetPasswordPage from "@/app/auth/reset-password/page";
import UpdatePasswordPage from "@/app/auth/update-password/page";

/**
 * Nachtrag zu Refactoring-Plan 0.5.
 *
 * Die Auth-Seiten standen nicht in der urspruenglichen Liste, weil Phase 4 sie
 * nicht anfasst. Schritt 1.3 aber schon: neun der Eingabefelder, deren
 * Klassenkette dort zusammengefuehrt wird, liegen genau hier. Ohne Snapshot
 * waere das Ersetzen ungeprueft — und die Regel aus 0.5 lautet: erst der
 * Vertrag, dann der Umbau.
 */

beforeEach(() => {
  // Die Seiten rufen nichts ab; der Stub faengt nur ab, dass ein Klick
  // versehentlich ins Netz geht.
  stubFetch({});
});

describe("auth-Seiten — Snapshots vor der Styling-Zusammenfuehrung", () => {
  it("login", async () => {
    const { container } = renderWithProviders(<LoginPage />, { route: "/auth/login" });
    await screen.findByRole("button", { name: /anmelden/i });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("register", async () => {
    const { container } = renderWithProviders(<RegisterPage />, { route: "/auth/register" });
    await screen.findByRole("button", { name: /registrieren|konto/i });
    expect(container.firstChild).toMatchSnapshot();
  });

  it("reset-password", async () => {
    const { container } = renderWithProviders(<ResetPasswordPage />, {
      route: "/auth/reset-password",
    });
    await screen.findByRole("button");
    expect(container.firstChild).toMatchSnapshot();
  });

  it("update-password mit gueltigem Token", async () => {
    // Ohne token in der Query rendert die Seite den "Link ungueltig"-Zweig --
    // und damit gerade nicht die Eingabefelder, um die es in 1.3 geht.
    const { container } = renderWithProviders(<UpdatePasswordPage />, {
      route: "/auth/update-password",
      searchParams: { token: "test-token" },
    });
    await screen.findByRole("button");
    expect(container.firstChild).toMatchSnapshot();
  });

  it("update-password ohne Token", async () => {
    const { container } = renderWithProviders(<UpdatePasswordPage />, {
      route: "/auth/update-password",
    });
    await screen.findByRole("heading", { name: "Ungültiger Link" });
    expect(container.querySelector("input")).toBeNull();
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("auth-Seiten — die Felder, um die es in 1.3 geht", () => {
  it("login traegt E-Mail- und Passwortfeld", async () => {
    renderWithProviders(<LoginPage />, { route: "/auth/login" });
    expect(await screen.findByPlaceholderText(/e-?mail/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it("register traegt drei Eingabefelder", async () => {
    const { container } = renderWithProviders(<RegisterPage />, { route: "/auth/register" });
    await screen.findByRole("button", { name: /registrieren|konto/i });
    expect(container.querySelectorAll("input").length).toBeGreaterThanOrEqual(3);
  });
});

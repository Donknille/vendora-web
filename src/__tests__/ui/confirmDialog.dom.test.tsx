import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Regression: Nach einem ERFOLGREICHEN Bestätigen blieb `loading` auf true.
 * Der Dialog bleibt zwischen zwei Öffnungen gemountet, also öffnete der
 * zweite Dialog derselben Seite mit zwei deaktivierten Knöpfen und
 * blockiertem Escape — eine Löschung pro Seitenaufruf, mehr ging nicht.
 *
 * Mutation zum Rotfahren: das `finally { setLoading(false) }` und den Reset
 * im `open`-Effekt aus ConfirmDialog.tsx entfernen.
 */

function Harness({
  onConfirm,
  errorFallback,
}: {
  onConfirm: () => void | Promise<void>;
  errorFallback?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(0);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Öffnen</button>
      <span data-testid="count">{confirmed}</span>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await onConfirm();
          setConfirmed((n) => n + 1);
          setOpen(false);
        }}
        errorFallback={errorFallback}
        title="Wirklich löschen?"
        message="Das kann nicht rückgängig gemacht werden."
      />
    </div>
  );
}

/** Ein Fehler, wie ihn `apiRequest` aus einer abgelehnten Antwort baut. */
function apiError(message: string, status: number, code?: string) {
  const err: Error & { code?: string; status?: number } = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

describe("ConfirmDialog", () => {
  it("lässt sich auf derselben Seite mehrfach bestätigen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness onConfirm={async () => {}} />);

    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    // Zweites Öffnen: beide Knöpfe müssen wieder bedienbar sein.
    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    const confirm = screen.getByRole("button", { name: "Bestätigen" });
    expect(confirm).toBeEnabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeEnabled();

    await user.click(confirm);
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));
  });

  it("zeigt einen geworfenen Fehler an und bleibt bedienbar", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderWithProviders(
      <Harness
        errorFallback="Ausgabe konnte nicht gelöscht werden."
        onConfirm={async () => {
          if (fail) throw apiError("Expense not found", 404);
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ausgabe konnte nicht gelöscht werden.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bestätigen" })).toBeEnabled();

    // Abbrechen geht nach einem Fehler weiterhin.
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Und ein erneuter Versuch kann gelingen.
    fail = false;
    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
  });

  /**
   * Der Dialog zeigte die Server-Meldung woertlich an. Die ist englisch und
   * teils intern ("Expense not found", "Unauthorized") — genau das, was
   * apiError.ts fuer die uebrige Oberflaeche ausdruecklich ausschliesst.
   *
   * Mutation zum Rotfahren: in ConfirmDialog.tsx den apiErrorMessage-Aufruf
   * durch `err.message` ersetzen.
   */
  it("reicht die Server-Meldung nicht durch", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Harness
        errorFallback="Ausgabe konnte nicht gelöscht werden."
        onConfirm={async () => {
          throw apiError("Expense not found", 404);
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    await screen.findByRole("alert");
    expect(screen.queryByText(/Expense not found/)).not.toBeInTheDocument();
  });

  /**
   * Der Effekt, der den Dialog beim Oeffnen zuruecksetzt, hing an `onClose` —
   * und jede aufrufende Seite uebergibt dafuer eine Pfeilfunktion, die bei
   * jedem Elternrender neu entsteht. Genau im Fehlerfall rendert die Seite
   * neu (die Mutation wechselt von "laeuft" auf "gescheitert"), der Effekt
   * lief wieder und loeschte die eben gesetzte Meldung. Der Dialog stand
   * danach unveraendert da: kein Fehler, kein Hinweis, nichts.
   *
   * Mutation zum Rotfahren: in ConfirmDialog.tsx die Abhaengigkeiten des
   * Effekts wieder auf `[open, onClose]` setzen.
   */
  it("behält die Meldung, wenn die Seite darunter neu rendert", async () => {
    const user = userEvent.setup();

    // Eine echte Mutation, kein nachgestelltes setState: ihr Wechsel von
    // "laeuft" auf "gescheitert" erreicht die Seite erst NACH dem Render, in
    // dem der Dialog seine Meldung gesetzt hat. Auf diese Reihenfolge kommt
    // es an — mit einem setState im selben Takt bliebe der Fehler unbemerkt.
    function RerenderHarness() {
      const [open, setOpen] = useState(false);
      const failing = useMutation({
        mutationFn: async () => {
          throw apiError("Expense not found", 404);
        },
      });
      return (
        <div>
          <button onClick={() => setOpen(true)}>Öffnen</button>
          <span data-testid="settled">{failing.isError ? "1" : "0"}</span>
          <ConfirmDialog
            open={open}
            onClose={() => setOpen(false)}
            errorFallback="Ausgabe konnte nicht gelöscht werden."
            onConfirm={() => failing.mutateAsync()}
            title="Wirklich löschen?"
            message="Das kann nicht rückgängig gemacht werden."
          />
        </div>
      );
    }

    renderWithProviders(<RerenderHarness />);

    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    await waitFor(() => expect(screen.getByTestId("settled").textContent).toBe("1"));
    expect(screen.getByRole("alert")).toHaveTextContent("Ausgabe konnte nicht gelöscht werden.");
  });

  it("übersetzt einen bekannten Fehlercode statt den Fallback zu zeigen", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Harness
        errorFallback="Ausgabe konnte nicht gelöscht werden."
        onConfirm={async () => {
          throw apiError("Marktkosten werden über den Markt gepflegt.", 409, "DERIVED_EXPENSE");
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Diese Ausgabe gehört zu einem Markt und lässt sich nur dort ändern.",
    );
  });

  it("nimmt ohne errorFallback den allgemeinen Satz", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Harness
        onConfirm={async () => {
          throw apiError("Unauthorized", 401);
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ein Fehler ist aufgetreten.");
    expect(screen.queryByText("Unauthorized")).not.toBeInTheDocument();
  });

  it("ist als modaler Dialog ausgezeichnet und setzt den Fokus in den Dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness onConfirm={async () => {}} />);

    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    const dialog = screen.getByRole("dialog", { name: "Wirklich löschen?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Das kann nicht rückgängig gemacht werden.");
    expect(screen.getByRole("button", { name: "Abbrechen" })).toHaveFocus();

    // Escape schließt und gibt den Fokus an den Auslöser zurück.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Öffnen" })).toHaveFocus();
  });
});

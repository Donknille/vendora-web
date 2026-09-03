import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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

function Harness({ onConfirm }: { onConfirm: () => void | Promise<void> }) {
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
        title="Wirklich löschen?"
        message="Das kann nicht rückgängig gemacht werden."
      />
    </div>
  );
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
        onConfirm={async () => {
          if (fail) throw new Error("Server sagt nein");
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Öffnen" }));
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server sagt nein");
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

import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, stubFetch, TEST_USER_ID } from "@/test-utils/renderWithProviders";
import { queryClient } from "@/lib/api-client";
import { useDeleteOrder } from "@/lib/hooks/useOrders";
import { useCancelInvoice, useIssueInvoice } from "@/lib/hooks/useInvoices";
import { invalidateSubscription } from "@/lib/hooks/useSubscription";

/**
 * Welche Abfragen ein Schreibvorgang veraltet. Vorher blieb das Dashboard nach
 * dem Loeschen eines Auftrags fuenf Minuten bei den alten Zahlen, und
 * `invalidateSubscription` traf mit `["/api/subscription"]` gar keinen
 * Schluessel. Mutation zum Rotfahren: "/api/dashboard" aus
 * invalidateOrderScopedQueries entfernen.
 */
function invalidatedPaths(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map((c: unknown[]) => (c[0] as { queryKey?: unknown[] } | undefined)?.queryKey)
    .filter((k): k is unknown[] => Array.isArray(k))
    .map((k) => `${k[0]}:${k[1]}`);
}

function DeleteOrderHarness() {
  const del = useDeleteOrder();
  return <button onClick={() => del.mutate("o1")}>loeschen</button>;
}

function InvoiceHarness() {
  const issue = useIssueInvoice();
  const cancel = useCancelInvoice();
  return (
    <>
      <button onClick={() => issue.mutate("o1")}>ausstellen</button>
      <button onClick={() => cancel.mutate("i1")}>stornieren</button>
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Invalidierung nach Schreibvorgaengen", () => {
  it("Auftrag loeschen veraltet Liste, Kunden, Dashboard und Rechnungen", async () => {
    stubFetch({ "/api/orders": {} });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    renderWithProviders(<DeleteOrderHarness />);

    await user.click(screen.getByRole("button", { name: "loeschen" }));

    await waitFor(() => {
      const paths = invalidatedPaths(spy);
      for (const p of ["/api/orders", "/api/customers", "/api/dashboard", "/api/invoices"]) {
        expect(paths).toContain(`${TEST_USER_ID}:${p}`);
      }
    });
  });

  it("Rechnung ausstellen und stornieren veralten auch das Dashboard", async () => {
    stubFetch({ "/api/invoices": {} });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    renderWithProviders(<InvoiceHarness />);

    await user.click(screen.getByRole("button", { name: "ausstellen" }));
    await waitFor(() => expect(invalidatedPaths(spy)).toContain(`${TEST_USER_ID}:/api/dashboard`));

    spy.mockClear();
    await user.click(screen.getByRole("button", { name: "stornieren" }));
    await waitFor(() => expect(invalidatedPaths(spy)).toContain(`${TEST_USER_ID}:/api/dashboard`));
  });

  it("invalidateSubscription trifft den user-scoped Schluessel", () => {
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateSubscription("user-7");
    expect(invalidatedPaths(spy)).toEqual(["user-7:/api/subscription"]);
  });
});

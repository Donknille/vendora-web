import { describe, it, expect } from "vitest";
import { partitionSyncResults, type SyncResult } from "@/lib/offline/salesQueue";

/**
 * Guard for a data-loss bug: the sync loop used to delete EVERY clientId the
 * batch endpoint returned — including the ones it had rejected. A rejected sale
 * was gone from IndexedDB, absent on the server, and the register then showed
 * the "all synced" checkmark. A sale is money taken at the stall; only an
 * explicit "ok" may remove it from the queue.
 */
describe("partitionSyncResults", () => {
  it("confirms only sales the server stored", () => {
    const results: SyncResult[] = [
      { clientId: "a", status: "ok" },
      { clientId: "b", status: "error" },
      { clientId: "c", status: "ok" },
    ];

    const { confirmed, rejected } = partitionSyncResults(results);

    expect(confirmed).toEqual(["a", "c"]);
    expect(rejected).toEqual(["b"]);
  });

  it("never lets a rejected sale leave the queue", () => {
    const { confirmed, rejected } = partitionSyncResults([
      { clientId: "validation-failed", status: "error" },
      { clientId: "not-stored", status: "error" },
    ]);

    expect(confirmed).toEqual([]);
    expect(rejected).toEqual(["validation-failed", "not-stored"]);
  });

  it("handles an empty response", () => {
    expect(partitionSyncResults([])).toEqual({ confirmed: [], rejected: [] });
  });
});

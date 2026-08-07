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

    const { confirmed, rejected, invalid } = partitionSyncResults(results);

    expect(confirmed).toEqual(["a", "c"]);
    expect(rejected).toEqual(["b"]);
    expect(invalid).toEqual([]); // ohne permanent-Flag: erneut versuchen
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
    expect(partitionSyncResults([])).toEqual({ confirmed: [], rejected: [], invalid: [] });
  });

  it("trennt dauerhaft ungültige von vorübergehend gescheiterten", () => {
    // "permanent" heißt: der Server wird das nie annehmen. Solche Einträge
    // bleiben gespeichert und sichtbar, dürfen aber weder endlos erneut
    // gesendet werden noch im Tagesabschluss mitzählen — sonst zeigt die Kasse
    // dauerhaft Geld an, das nie gebucht wurde.
    const { confirmed, rejected, invalid } = partitionSyncResults([
      { clientId: "ok", status: "ok" },
      { clientId: "spaeter", status: "error", permanent: false },
      { clientId: "nie", status: "error", permanent: true },
    ]);

    expect(confirmed).toEqual(["ok"]);
    expect(rejected).toEqual(["spaeter", "nie"]);
    expect(invalid).toEqual(["nie"]);
  });
});

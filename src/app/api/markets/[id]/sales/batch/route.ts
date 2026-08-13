import { NextResponse } from "next/server";
// Ohne validationError: der Stapel-Endpunkt antwortet nie mit 400 fuer einen
// einzelnen Eintrag — ein fehlerhafter darf die uebrigen nicht mitreissen. Sein
// "Validation error" ist ein Status je Eintrag, keine HTTP-Antwort.
import { fail, withAuth } from "@/lib/server/route";
import {
  MAX_BATCH,
  batchSaleEntrySchema,
  batchSalesSchema,
} from "@/lib/schemas/market";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";

// Weiterhin von hier exportiert: der Test der Route prueft die Obergrenze
// gegen genau diesen Endpunkt.
export { MAX_BATCH };

export type BatchResult =
  | { clientId: string; status: "ok"; row: storage.MarketSaleResponse }
  // `permanent` unterscheidet "kann nie gespeichert werden" (Schema verletzt)
  // von "diesmal nicht". Der Client darf Ersteres nicht endlos erneut senden.
  | { clientId: string; status: "error"; message: string; permanent: boolean };

function clientIdOf(entry: unknown): string {
  if (entry && typeof entry === "object" && "clientId" in entry) {
    const c = (entry as { clientId: unknown }).clientId;
    if (typeof c === "string") return c;
  }
  return "";
}

export const POST = withAuth<{ id: string }>(
  "POST /api/markets/[id]/sales/batch",
  async ({ userId, request, params }) => {
    const { id: marketId } = params;

    const market = await storage.getMarket(userId, marketId);
    if (!market) return fail(404, "Market not found");

    const gate = await requireWriteAccess(userId);
    if (gate) return gate;

    const outer = batchSalesSchema.safeParse(await request.json());
    if (!outer.success) {
      return fail(400, `Batch must be an array of 1–${MAX_BATCH} entries`);
    }

    // Validate each entry independently — one bad entry must not sink the batch.
    const rawEntries = outer.data;
    const valid: storage.MarketSaleBatchEntry[] = [];
    const perEntry: (BatchResult | null)[] = rawEntries.map((raw) => {
      const parsed = batchSaleEntrySchema.safeParse(raw);
      if (!parsed.success) {
        return {
          clientId: clientIdOf(raw),
          status: "error",
          message: "Validation error",
          permanent: true,
        };
      }
      valid.push(parsed.data);
      return null; // filled in from server rows below
    });

    const rows = await storage.upsertMarketSalesBatch(userId, marketId, valid);
    const rowByClientId = new Map(rows.map((r) => [r.clientId, r]));

    const results: BatchResult[] = rawEntries.map((raw, i) => {
      const pre = perEntry[i];
      if (pre) return pre; // validation error
      const clientId = clientIdOf(raw);
      const row = rowByClientId.get(clientId);
      if (!row) {
        return { clientId, status: "error", message: "Not stored", permanent: false };
      }
      return { clientId, status: "ok", row };
    });

    return NextResponse.json(results, { status: 200 });
  }
);

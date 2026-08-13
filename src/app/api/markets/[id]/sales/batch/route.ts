import { NextResponse } from "next/server";
// Ohne validationError: der Stapel-Endpunkt antwortet nie mit 400 fuer einen
// einzelnen Eintrag — ein fehlerhafter darf die uebrigen nicht mitreissen. Sein
// "Validation error" ist ein Status je Eintrag, keine HTTP-Antwort.
import { fail, withAuth } from "@/lib/server/route";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

export const MAX_BATCH = 100;

// One queued offline sale. `clientId` is a client-generated UUID used as the
// idempotency key so a sale synced more than once is stored exactly once.
export const batchSaleEntrySchema = z.object({
  clientId: z.string().uuid(),
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().int().min(0).max(99999999), // cents
  quantity: z.number().int().min(1).max(9999).default(1),
  paymentMethod: z.enum(["cash", "card"]).nullish(),
  createdAt: z.string().datetime().optional(),
});

export const batchSalesSchema = z.array(z.unknown()).min(1).max(MAX_BATCH);

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
  if (!market) {
    return fail(404, "Market not found");
  }

  const gate = await requireWriteAccess(userId);
  if (gate) return gate;

  const body = await request.json();
  const outer = batchSalesSchema.safeParse(body);
  if (!outer.success) {
    return NextResponse.json(
      { message: `Batch must be an array of 1–${MAX_BATCH} entries` },
      { status: 400 }
    );
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

import { NextResponse } from "next/server";
import { getAuthUserId, requireActiveSubscription } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";
import {
  validateMarketSaleInput,
  type MarketSaleInput,
} from "@/lib/markets/saleValidation";

const MAX_BATCH = 100;

// Only the envelope is validated up front (an array of 1..100 items). Each
// entry is validated individually below so one bad entry never aborts the
// batch (Phase 2.2).
const batchBodySchema = z.array(z.unknown()).min(1).max(MAX_BATCH);

type BatchResult = {
  clientId: string | null;
  status: "ok" | "error";
  row?: storage.MarketSaleResponse;
  message?: string;
};

function extractClientId(raw: unknown): string | null {
  if (raw && typeof raw === "object" && "clientId" in raw) {
    const value = (raw as { clientId?: unknown }).clientId;
    if (typeof value === "string") return value;
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: marketId } = await params;

    // Auth + subscription checks exactly as the single route (Phase 2.2).
    const market = await storage.getMarket(userId, marketId);
    if (!market) {
      return NextResponse.json({ message: "Market not found" }, { status: 404 });
    }

    const subCheck = await requireActiveSubscription(userId);
    if (subCheck) return subCheck;

    const body = await request.json();
    const parsedBody = batchBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          message: `Body muss ein Array mit 1 bis ${MAX_BATCH} Einträgen sein`,
        },
        { status: 400 }
      );
    }

    const entries = parsedBody.data;
    const now = Date.now();
    const results: BatchResult[] = new Array(entries.length);
    const valid: { index: number; data: MarketSaleInput }[] = [];

    entries.forEach((raw, index) => {
      const validated = validateMarketSaleInput(raw, now);
      if (!validated.ok) {
        results[index] = {
          clientId: extractClientId(raw),
          status: "error",
          message: validated.message,
        };
        return;
      }
      valid.push({ index, data: validated.data });
    });

    if (valid.length > 0) {
      // Dedupe by clientId before the multi-row upsert: Postgres rejects an
      // INSERT that would affect the same conflict target twice. Duplicates in
      // the same batch map to the same resulting row.
      const uniqueByClientId = new Map<string, MarketSaleInput>();
      for (const { data } of valid) {
        if (!uniqueByClientId.has(data.clientId)) {
          uniqueByClientId.set(data.clientId, data);
        }
      }

      const rows = await storage.upsertMarketSalesBatch(userId, marketId, [
        ...uniqueByClientId.values(),
      ]);
      const rowByClientId = new Map(rows.map((row) => [row.clientId, row]));

      for (const { index, data } of valid) {
        const row = rowByClientId.get(data.clientId);
        results[index] = row
          ? { clientId: data.clientId, status: "ok", row }
          : {
              clientId: data.clientId,
              status: "error",
              message: "Insert fehlgeschlagen",
            };
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error("POST /api/markets/[id]/sales/batch error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

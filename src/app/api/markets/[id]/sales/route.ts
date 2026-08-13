import { NextResponse } from "next/server";
import { fail, validationError, withAuth } from "@/lib/server/route";
import { createMarketSaleSchema } from "@/lib/schemas/market";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";

export const GET = withAuth<{ id: string }>(
  "GET /api/markets/[id]/sales",
  async ({ userId, params }) => {
    const data = await storage.getMarketSales(userId, params.id);
    return NextResponse.json(data);
  }
);

export const POST = withAuth<{ id: string }>(
  "POST /api/markets/[id]/sales",
  async ({ userId, request, params }) => {
    const marketId = params.id;

    // Validate market exists and belongs to user
    const market = await storage.getMarket(userId, marketId);
    if (!market) return fail(404, "Market not found");

    const gate = await requireWriteAccess(userId);
    if (gate) return gate;

    const parsed = createMarketSaleSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);

    const sale = await storage.createMarketSale(userId, {
      marketId,
      ...parsed.data,
    });
    return NextResponse.json(sale, { status: 201 });
  }
);

import { NextResponse } from "next/server";
import { fail, validationError, withAuth } from "@/lib/server/route";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const createMarketSaleSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().int().min(0).max(99999999), // cents
  quantity: z.number().int().min(1).max(9999).default(1),
});

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

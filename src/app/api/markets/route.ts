import { NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { validationError, withAuth } from "@/lib/server/route";
import { createMarketSchema } from "@/lib/schemas/market";

export const GET = withAuth("GET /api/markets", async ({ userId }) => {
  const data = await storage.getMarkets(userId);
  return NextResponse.json(data);
});

export const POST = withAuth("POST /api/markets", async ({ userId, request }) => {
  // Creating a market requires PRO (FREE is read-only).
  const gate = await requireWriteAccess(userId);
  if (gate) return gate;

  const parsed = createMarketSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const market = await storage.createMarket(userId, parsed.data);
  return NextResponse.json(market, { status: 201 });
});

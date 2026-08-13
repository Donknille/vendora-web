import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { parsePagination } from "@/lib/server/pagination";
import { withAuth } from "@/lib/server/route";

export const GET = withAuth("GET /api/market-sales", async ({ userId, request }) => {
  const data = await storage.getAllMarketSales(userId, parsePagination(request));
  return NextResponse.json(data);
});

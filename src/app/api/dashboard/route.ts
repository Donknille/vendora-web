import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { withAuth } from "@/lib/server/route";

export const GET = withAuth("GET /api/dashboard", async ({ userId }) => {
  // Single auth check, parallel data fetch.
  // getExpenses without opts is the reporting path: every source (incl. the
  // derived market cost rows) and unpaginated, so the GuV/EÜR totals are not
  // silently truncated.
  const [orders, expenses, markets, marketSales] = await Promise.all([
    storage.getOrders(userId),
    storage.getExpenses(userId),
    storage.getMarkets(userId),
    storage.getAllMarketSales(userId),
  ]);

  return NextResponse.json({ orders, expenses, markets, marketSales });
});

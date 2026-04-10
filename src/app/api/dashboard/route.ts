import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Single auth check, parallel data fetch
    const [orders, expenses, markets, marketSales] = await Promise.all([
      storage.getOrders(userId),
      storage.getExpenses(userId),
      storage.getMarkets(userId),
      storage.getAllMarketSales(userId),
    ]);

    return NextResponse.json({ orders, expenses, markets, marketSales });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

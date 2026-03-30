import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const [orders, markets, marketSales, expenses, profile, settings] =
      await Promise.all([
        storage.getOrders(userId),
        storage.getMarkets(userId),
        storage.getAllMarketSales(userId),
        storage.getExpenses(userId),
        storage.getProfile(userId),
        storage.getSettings(userId),
      ]);

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      orders,
      markets,
      marketSales,
      expenses,
      profile,
      settings,
    });
  } catch (error) {
    console.error("GET /api/export error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

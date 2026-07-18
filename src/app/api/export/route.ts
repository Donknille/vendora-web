import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const [orders, markets, marketSales, expenses, profile, invoiceCounter] =
      await Promise.all([
        storage.getOrders(userId),
        storage.getMarkets(userId),
        storage.getAllMarketSales(userId),
        storage.getExpenses(userId),
        storage.getProfile(userId),
        storage.getInvoiceCounter(userId),
      ]);

    return NextResponse.json({
      schemaVersion: 2, // money as integer cents
      exportedAt: new Date().toISOString(),
      orders,
      markets,
      marketSales,
      expenses,
      profile,
      invoiceCounter,
    });
  } catch (error) {
    console.error("GET /api/export error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

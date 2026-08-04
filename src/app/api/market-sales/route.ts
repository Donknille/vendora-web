import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { parsePagination } from "@/lib/server/pagination";

export async function GET(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await storage.getAllMarketSales(userId, parsePagination(request));
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/market-sales error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

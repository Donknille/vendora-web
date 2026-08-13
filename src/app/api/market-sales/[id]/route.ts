import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { fail, withAuth } from "@/lib/server/route";

export const DELETE = withAuth<{ id: string }>(
  "DELETE /api/market-sales/[id]",
  async ({ userId, params }) => {
    const deleted = await storage.deleteMarketSale(userId, params.id);
    if (!deleted) return fail(404, "Market sale not found");
    return NextResponse.json({ message: "Market sale deleted" });
  }
);

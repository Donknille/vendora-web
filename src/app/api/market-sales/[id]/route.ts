import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Idempotent: deleting an already-removed (or synced-then-deleted) booking
    // still returns 200 so a replayed delete op from the offline queue never
    // becomes a hard failure. `deleted` reports whether a row was removed.
    const deleted = await storage.deleteMarketSale(userId, id);
    return NextResponse.json({ message: "Market sale deleted", deleted });
  } catch (error) {
    console.error("DELETE /api/market-sales/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

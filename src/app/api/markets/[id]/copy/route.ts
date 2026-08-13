import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { today } from "@/lib/date";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // A copy creates a new market → requires PRO (FREE is read-only).
    const gate = await requireWriteAccess(userId);
    if (gate) return gate;

    const { id } = await params;
    const original = await storage.getMarket(userId, id);
    if (!original) {
      return NextResponse.json({ message: "Market not found" }, { status: 404 });
    }

    const copy = await storage.createMarket(userId, {
      name: original.name,
      date: today(),
      location: original.location,
      standFee: original.standFee,
      travelCost: original.travelCost,
      notes: original.notes,
      quickItems: original.quickItems ?? undefined,
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    console.error("POST /api/markets/[id]/copy error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

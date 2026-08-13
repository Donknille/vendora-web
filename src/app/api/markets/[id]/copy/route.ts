import { NextResponse } from "next/server";
import { fail, withAuth } from "@/lib/server/route";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { today } from "@/lib/date";

export const POST = withAuth<{ id: string }>(
  "POST /api/markets/[id]/copy",
  async ({ userId, params }) => {
    // A copy creates a new market → requires PRO (FREE is read-only).
    const gate = await requireWriteAccess(userId);
    if (gate) return gate;

    const original = await storage.getMarket(userId, params.id);
    if (!original) return fail(404, "Market not found");

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
  }
);

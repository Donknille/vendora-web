import { NextResponse } from "next/server";
import { getAuthUserId, requireActiveSubscription } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import {
  marketSaleInputSchema,
  checkCreatedAtPlausible,
} from "@/lib/markets/saleValidation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: marketId } = await params;
    const data = await storage.getMarketSales(userId, marketId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/markets/[id]/sales error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: marketId } = await params;

    // Validate market exists and belongs to user
    const market = await storage.getMarket(userId, marketId);
    if (!market) {
      return NextResponse.json({ message: "Market not found" }, { status: 404 });
    }

    const subCheck = await requireActiveSubscription(userId);
    if (subCheck) return subCheck;

    const body = await request.json();
    const parsed = marketSaleInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // V2: reject implausible sale times outright (400, no retry on the client).
    const plausible = checkCreatedAtPlausible(parsed.data.createdAt);
    if (!plausible.ok) {
      return NextResponse.json({ message: plausible.message }, { status: 400 });
    }

    // V1: idempotent upsert. 201 on first insert, 200 on replay; the full row
    // is returned in both cases.
    const { row, inserted } = await storage.upsertMarketSale(
      userId,
      marketId,
      parsed.data
    );
    return NextResponse.json(row, { status: inserted ? 201 : 200 });
  } catch (error) {
    console.error("POST /api/markets/[id]/sales error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const createMarketSaleSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0),
  quantity: z.number().int().min(1).default(1),
});

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

    const user = await storage.getUser(userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const sub = storage.getSubscriptionStatus(user);
    if (!sub.isActive) {
      return NextResponse.json(
        { message: "Subscription required", code: "SUBSCRIPTION_REQUIRED", subscription: sub },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createMarketSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const sale = await storage.createMarketSale(userId, {
      marketId,
      ...parsed.data,
    });
    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("POST /api/markets/[id]/sales error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

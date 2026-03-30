import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const quickItemSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
});

const createMarketSchema = z.object({
  name: z.string().min(1, "Market name is required"),
  date: z.string().min(1, "Date is required"),
  location: z.string().default(""),
  standFee: z.number().min(0).default(0),
  travelCost: z.number().min(0).default(0),
  notes: z.string().default(""),
  status: z.string().optional(),
  quickItems: z.array(quickItemSchema).optional(),
});

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await storage.getMarkets(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/markets error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
    const parsed = createMarketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const market = await storage.createMarket(userId, parsed.data);
    return NextResponse.json(market, { status: 201 });
  } catch (error) {
    console.error("POST /api/markets error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

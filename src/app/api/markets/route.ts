import { NextResponse } from "next/server";
import { getAuthUserId, requireActiveSubscription } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const quickItemSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().min(0).max(999999.99),
});

const createMarketSchema = z.object({
  name: z.string().min(1, "Market name is required").max(200),
  date: z.string().min(1, "Date is required").max(50),
  location: z.string().max(300).default(""),
  standFee: z.number().min(0).max(99999.99).default(0),
  travelCost: z.number().min(0).max(99999.99).default(0),
  notes: z.string().max(5000).default(""),
  status: z.string().max(50).optional(),
  quickItems: z.array(quickItemSchema).max(50).optional(),
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

    const subCheck = await requireActiveSubscription(userId);
    if (subCheck) return subCheck;

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
